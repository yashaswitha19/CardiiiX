import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tesseract from 'node-tesseract-ocr';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import MedicalReport from './MedicalReport.js';
import bodyParser from 'body-parser';
import Groq from 'groq-sdk';

// Initialize Groq client


// ES Module setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "https://your-frontend-name.vercel.app"
}));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vivitsu_health';
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ 
  limit: '50mb', 
  extended: true, 
  parameterLimit: 50000 
}));
// Middleware
app.use(cors({
  origin: '*', // Allow all origins in development
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// OCR Configuration
const ocrConfig = {
  lang: 'eng',
  oem: 1,
  psm: 3
};

// Medical Analysis Function using LOCAL Hugging Face
async function analyzeMedicalReport(extractedText) {
  return new Promise((resolve, reject) => {
    console.log('🤖 Starting LOCAL Hugging Face medical analysis...');
    
    // Path to Python script
    const pythonScript = join(__dirname, 'medical_analyzer.py');
    
    console.log('📂 Python script path:', pythonScript);
    
    // Spawn Python process
    const python = spawn('python', [pythonScript]);
    
    let output = '';
    let errorOutput = '';
    
    // Send extracted text to Python
    python.stdin.write(extractedText);
    python.stdin.end();
    
    // Collect stdout (the analysis result)
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    // Collect stderr (progress messages)
    python.stderr.on('data', (data) => {
      const message = data.toString();
      console.log('  Python:', message.trim());
      errorOutput += message;
    });

    // Handle process completion
    python.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Python script failed with code:', code);
        console.error('Error output:', errorOutput);
        reject(new Error(`Medical analysis failed: ${errorOutput}`));
      } else {
        console.log('✅ Local medical analysis complete!');
        resolve(output.trim() || "Analysis completed but no output generated");
      }
    });
    
    // Handle process errors
    python.on('error', (err) => {
      console.error('❌ Failed to start Python process:', err.message);
      reject(new Error(`Python execution failed: ${err.message}. Make sure Python is in PATH.`));
    });
    
    // Timeout after 2 minutes (increased for slower systems)
    setTimeout(() => {
      python.kill();
      reject(new Error('Medical analysis timed out after 120 seconds'));
    }, 120000);
  });
}

const healthDataSchema = new mongoose.Schema({
  bpm: {
    type: Number,
    required: true
  },
  spo2: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true  // Adds createdAt and updatedAt automatically
});

const HealthData = mongoose.model('HealthData', healthDataSchema);

// API Endpoint to receive data from ESP32
app.post('/data', async (req, res) => {
  try {
    const { bpm, spo2 } = req.body;
    
    const newData = new HealthData({
      bpm: bpm,
      spo2: spo2
    });
    
    await newData.save();
    res.status(200).json({ message: 'Data saved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error saving data' });
  }
});

app.get('/data', async (req, res) => {
  try {
    const data = await HealthData.find().sort({ timestamp: -1 }).limit(50);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});
// Medical Analysis Endpoint with MongoDB Save
app.post('/api/medical/analyze', async (req, res) => {
  console.log('\n🔵 === NEW MEDICAL ANALYSIS REQUEST ===');
  
  try {
    const { image, mimeType } = req.body;
    
    if (!image || !mimeType) {
      console.error('❌ Missing image or mimeType');
      return res.status(400).json({ 
        error: "Missing required fields: image and mimeType",
        success: false
      });
    }
    
    console.log('📥 Request received:', { 
      mimeType, 
      imageSize: `${(image.length / 1024).toFixed(2)} KB` 
    });
    
    const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!supportedTypes.includes(mimeType)) {
      console.error('❌ Unsupported file type:', mimeType);
      return res.status(400).json({ 
        error: `Unsupported file type: ${mimeType}`,
        success: false
      });
    }
    
    console.log('🔍 Starting OCR extraction...');
    const imageBuffer = Buffer.from(image, 'base64');
    
    let extractedText;
    try {
      extractedText = await tesseract.recognize(imageBuffer, ocrConfig);
      console.log('✅ OCR complete. Extracted', extractedText?.length || 0, 'characters');
      console.log('📝 Preview:', extractedText?.substring(0, 100));
    } catch (ocrError) {
      console.error('❌ OCR Error:', ocrError.message);
      return res.status(500).json({ 
        error: "OCR extraction failed. Make sure Tesseract is installed.",
        details: ocrError.message,
        success: false
      });
    }
    
    if (!extractedText || extractedText.trim().length < 20) {
      console.error('❌ Insufficient text extracted');
      return res.status(400).json({ 
        error: "Could not extract sufficient text. Please use a clearer image.",
        extractedText: extractedText || "",
        success: false
      });
    }
    
    console.log('🤖 Starting LOCAL AI analysis...');
    let analysis;
    try {
      analysis = await analyzeMedicalReport(extractedText);
      console.log('✅ AI analysis complete!');
    } catch (analysisError) {
      console.error('❌ Analysis Error:', analysisError.message);
      return res.status(500).json({ 
        error: "AI analysis failed",
        details: analysisError.message,
        extractedText: extractedText.trim(),
        success: false
      });
    }
    
    // Save to MongoDB
    console.log('💾 Saving to MongoDB...');
    try {
      const newReport = new MedicalReport({
        uploadedImage: image.substring(0, 50000), // Limit to 50KB for storage
        extractedText: extractedText.trim(),
        aiAnalysis: analysis,
        uploadedAt: new Date()
      });
      
      const savedReport = await newReport.save();
      console.log('✅ Report saved to database! ID:', savedReport._id);
      
      console.log('✅ Sending successful response');
      
      return res.status(200).json({ 
        extractedText: extractedText.trim(),
        analysis: analysis,
        reportId: savedReport._id,
        success: true,
        processedAt: new Date().toISOString()
      });
      
    } catch (dbError) {
      console.error('❌ Database Error:', dbError.message);
      // Still return the analysis even if DB save fails
      console.log('⚠️  Sending response without DB save');
      
      return res.status(200).json({ 
        extractedText: extractedText.trim(),
        analysis: analysis,
        success: true,
        dbWarning: "Analysis completed but failed to save to database",
        processedAt: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error("❌ Unexpected Error:", error);
    return res.status(500).json({ 
      error: "Server error during analysis",
      details: error.message,
      success: false
    });
  }
});

// Get All Reports (Latest 50)
app.get('/api/medical/reports', async (req, res) => {
  try {
    const reports = await MedicalReport.find()
      .select('-uploadedImage') // Exclude image data for performance
      .sort({ uploadedAt: -1 })
      .limit(50);
    
    console.log(`📋 Retrieved ${reports.length} reports`);
    
    res.json({ 
      success: true, 
      count: reports.length,
      reports 
    });
  } catch (error) {
    console.error('❌ Error fetching reports:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get Single Report by ID
app.get('/api/medical/reports/:id', async (req, res) => {
  try {
    const report = await MedicalReport.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        error: 'Report not found' 
      });
    }
    
    console.log(`📄 Retrieved report: ${req.params.id}`);
    
    res.json({ 
      success: true, 
      report 
    });
  } catch (error) {
    console.error('❌ Error fetching report:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Delete Report
app.delete('/api/medical/reports/:id', async (req, res) => {
  try {
    const deletedReport = await MedicalReport.findByIdAndDelete(req.params.id);
    
    if (!deletedReport) {
      return res.status(404).json({ 
        success: false, 
        error: 'Report not found' 
      });
    }
    
    console.log(`🗑️  Deleted report: ${req.params.id}`);
    
    res.json({ 
      success: true, 
      message: 'Report deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Error deleting report:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Vivitsu Medical AI Backend',
    version: '2.0.0',
    status: 'running',
    features: {
      ocr: 'Tesseract OCR',
      ai: 'Local Hugging Face (No quotas)',
      privacy: 'All data processed locally',
      database: 'MongoDB'
    },
    endpoints: {
      medicalAnalysis: 'POST /api/medical/analyze',
      getAllReports: 'GET /api/medical/reports',
      getSingleReport: 'GET /api/medical/reports/:id',
      deleteReport: 'DELETE /api/medical/reports/:id'
    }
  });
});





app.post('/api/chat/message', async (req, res) => {
  try {
    const { messages, medicalReports } = req.body;
    
    // Build context
    let context = "PATIENT'S MEDICAL HISTORY:\n\n";
    if (medicalReports && medicalReports.length > 0) {
      medicalReports.slice(0, 3).forEach((report, i) => {
        context += `Report ${i + 1}: ${report.aiAnalysis.substring(0, 300)}...\n\n`;
      });
    }
    
    const systemPrompt = `You are Vivitsu, an AI health assistant with access to patient's medical history.

${context}

Provide helpful, accurate health advice. Always end with: "⚠️ This is AI-generated advice. Consult a healthcare professional."`;
    
    // Prepare messages for Groq
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ 
        role: m.role === 'model' ? 'assistant' : m.role, 
        content: m.text 
      }))
    ];
    
    // Call Groq API
    const chatCompletion = await groq.chat.completions.create({
      messages: chatMessages,
      model: 'llama-3.3-70b-versatile', // Fast, accurate medical model
      temperature: 0.7,
      max_tokens: 1024
    });
    
    const response = chatCompletion.choices[0]?.message?.content || 
                    "I'm sorry, I couldn't process that.";
    
    res.json({ success: true, response });
    
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



// Diet Plan Endpoint
app.post('/api/chat/diet-plan', async (req, res) => {
  try {
    const { goal, medicalReports } = req.body;
    
    let context = "";
    if (medicalReports && medicalReports.length > 0) {
      context = "Patient's Medical History:\n";
      medicalReports.slice(0, 3).forEach((report, i) => {
        context += `${report.aiAnalysis.substring(0, 200)}...\n`;
      });
    }
    
    const prompt = `${context}

Create a 7-day personalized diet plan for: ${goal}

Include:
- Daily meals (Breakfast, Lunch, Dinner, 2 Snacks)
- Nutritional considerations
- Foods to avoid based on medical conditions
- Hydration tips

Format with clear headings. End with disclaimer.`;
    
    // Groq API call
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: 'You are a certified nutritionist and medical diet expert. Create detailed, safe, and personalized meal plans based on patient medical history.' 
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 1,
      stream: false
    });
    
    const response = chatCompletion.choices[0]?.message?.content || 
                    "Failed to generate diet plan. Please try again.";
    
    res.json({ 
      success: true, 
      response 
    });
    
  } catch (error) {
    console.error('Diet Plan API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});



// Health Insights Endpoint
app.post('/api/chat/insights', async (req, res) => {
  try {
    const { medicalReports } = req.body;
    
    if (!medicalReports || medicalReports.length === 0) {
      return res.json({ 
        success: true, 
        response: "No medical reports available for analysis." 
      });
    }
    
    let context = "Patient's Medical Reports:\n\n";
    medicalReports.forEach((report, i) => {
      context += `Report ${i + 1}: ${report.aiAnalysis}\n\n`;
    });
    
    const prompt = `${context}

Analyze the patient's medical history and provide:

### Key Health Trends
### Risk Factors
### Preventive Measures
### Lifestyle Recommendations
### Follow-up Suggestions

Be specific and reference findings from reports. End with disclaimer.`;
    
    // Groq API call
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: 'You are a senior medical analyst and clinical advisor. Analyze patient medical history, identify patterns, assess risks, and provide evidence-based health insights and recommendations.' 
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.6,
      max_tokens: 2048,
      top_p: 1,
      stream: false
    });
    
    const response = chatCompletion.choices[0]?.message?.content || 
                    "Failed to generate health insights. Please try again.";
    
    res.json({ 
      success: true, 
      response 
    });
    
  } catch (error) {
    console.error('Insights API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});


// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 ESP32 can access at: http://172.20.10.2:${PORT}`);
  console.log(`🤖 AI Model: Local Hugging Face (Unlimited)`);
  console.log(`💾 Database: MongoDB`);
  console.log(`🏥 Medical Analysis: http://localhost:${PORT}/api/medical/analyze`);
  console.log(`📊 ESP32 Data Endpoint: http://172.20.10.2:${PORT}/data\n`);
  
  // Check Python availability
  import('child_process').then(({ exec }) => {
    exec('python --version', (error, stdout) => {
      if (error) {
        console.log('⚠️  Python not found in PATH!');
      } else {
        console.log('✅ Python installed:', stdout.trim());
      }
    });
  });
});

