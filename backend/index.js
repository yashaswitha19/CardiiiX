import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tesseract from 'node-tesseract-ocr';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import MedicalReport from './MedicalReport.js';
import Groq from 'groq-sdk';

dotenv.config();

// ES Module setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS Configuration
app.use(cors({
  origin: [
    "http://localhost:3000",                  // Local frontend
    process.env.FRONTEND_URL || ""            // Deployed frontend
  ],
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

// Body parsers
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vivitsu_health';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Tesseract OCR Config
const ocrConfig = { lang: 'eng', oem: 1, psm: 3 };

// Helper: Run local Python medical analysis
async function analyzeMedicalReport(extractedText) {
  return new Promise((resolve, reject) => {
    const pythonScript = join(__dirname, 'medical_analyzer.py');
    const python = spawn('python', [pythonScript]);

    let output = '', errorOutput = '';

    python.stdin.write(extractedText);
    python.stdin.end();

    python.stdout.on('data', data => output += data.toString());
    python.stderr.on('data', data => errorOutput += data.toString());

    python.on('close', code => {
      if (code !== 0) reject(new Error(`Python failed: ${errorOutput}`));
      else resolve(output.trim() || "Analysis completed, no output");
    });

    python.on('error', err => reject(new Error(`Python execution failed: ${err.message}`)));

    setTimeout(() => {
      python.kill();
      reject(new Error('Medical analysis timed out (120s)'));
    }, 120000);
  });
}

// Routes ---------------------------------------------------

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'Vivitsu Medical AI Backend',
    version: '2.0.0',
    status: 'running'
  });
});

// OCR + Medical Analysis
app.post('/api/medical/analyze', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image || !mimeType) return res.status(400).json({ success: false, error: "Missing image or mimeType" });

    const supportedTypes = ['image/png','image/jpeg','image/jpg','image/webp'];
    if (!supportedTypes.includes(mimeType)) return res.status(400).json({ success: false, error: "Unsupported file type" });

    const imageBuffer = Buffer.from(image, 'base64');

    // OCR extraction
    let extractedText;
    try { extractedText = await tesseract.recognize(imageBuffer, ocrConfig); }
    catch (ocrError) { return res.status(500).json({ success: false, error: "OCR failed", details: ocrError.message }); }

    if (!extractedText || extractedText.trim().length < 20)
      return res.status(400).json({ success: false, error: "Insufficient text extracted", extractedText });

    // Local AI analysis
    let analysis;
    try { analysis = await analyzeMedicalReport(extractedText); }
    catch (analysisError) { return res.status(500).json({ success: false, error: "AI analysis failed", details: analysisError.message }); }

    // Save to MongoDB
    try {
      const newReport = new MedicalReport({
        uploadedImage: image.substring(0,50000),
        extractedText: extractedText.trim(),
        aiAnalysis: analysis,
        uploadedAt: new Date()
      });
      const savedReport = await newReport.save();
      return res.status(200).json({ success: true, extractedText: extractedText.trim(), analysis, reportId: savedReport._id });
    } catch (dbError) {
      return res.status(200).json({ success: true, extractedText: extractedText.trim(), analysis, dbWarning: "Analysis completed but DB save failed" });
    }

  } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
});

// Get Reports
app.get('/api/medical/reports', async (req, res) => {
  try {
    const reports = await MedicalReport.find().select('-uploadedImage').sort({ uploadedAt: -1 }).limit(50);
    res.json({ success: true, count: reports.length, reports });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Get Single Report
app.get('/api/medical/reports/:id', async (req, res) => {
  try {
    const report = await MedicalReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
    res.json({ success: true, report });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Delete Report
app.delete('/api/medical/reports/:id', async (req, res) => {
  try {
    const deletedReport = await MedicalReport.findByIdAndDelete(req.params.id);
    if (!deletedReport) return res.status(404).json({ success: false, error: 'Report not found' });
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ESP32 Health Data
const healthDataSchema = new mongoose.Schema({
  bpm: Number,
  spo2: Number,
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });
const HealthData = mongoose.model('HealthData', healthDataSchema);

app.post('/data', async (req,res)=>{
  try{
    const { bpm, spo2 } = req.body;
    const newData = new HealthData({ bpm, spo2 });
    await newData.save();
    res.status(200).json({ message: 'Data saved successfully' });
  } catch(err){ res.status(500).json({ error: 'Error saving data' }); }
});

app.get('/data', async (req,res)=>{
  try{
    const data = await HealthData.find().sort({ timestamp:-1 }).limit(50);
    res.status(200).json(data);
  } catch(err){ res.status(500).json({ error: 'Failed to fetch data' }); }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 ESP32 Data Endpoint: /data`);
});
