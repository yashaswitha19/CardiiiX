import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tesseract from 'node-tesseract-ocr';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyC7xaZ_rs4OnPpFJT0DycoSS1Ff6S37H6E";

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

// Medical Analysis Function
async function analyzeMedicalReport(extractedText) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a medical assistant. Analyze this medical report and provide:

1. **Summary**: Brief overview of the report (2-3 sentences)
2. **Key Findings**: Important medical observations, test results, diagnoses
3. **Values & Measurements**: Extract all numerical values with their units and reference ranges
4. **Patient Information**: Name, age, date, hospital/clinic (if present)
5. **Recommendations**: Any prescribed medications, follow-up instructions, or warnings
6. **Abnormalities**: Flag any values outside normal ranges

Medical Report Text:
${extractedText}`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        })
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
    }
    
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated";
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}

// Chat with context endpoint
app.post('/api/chat/message', async (req, res) => {
  try {
    const { messages, medicalReports } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || !lastMessage.text) {
      return res.status(400).json({ error: 'Last message must have text' });
    }

    // Build context from medical reports
    let context = '';
    if (medicalReports && medicalReports.length > 0) {
      context = '\n\nMedical Context:\n' + medicalReports.map(report => 
        `Report from ${report.uploadedAt}:\n${report.extractedText}\nAI Analysis: ${report.aiAnalysis}`
      ).join('\n\n');
    }

    const prompt = `You are a helpful medical AI assistant. ${context ? 'Use the provided medical context to inform your response.' : ''}

User: ${lastMessage.text}

Provide a helpful, accurate response. If discussing medical topics, remind users to consult healthcare professionals.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "I apologize, but I couldn't generate a response at this time.";

    res.json({ success: true, response: aiResponse });
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: 'Failed to process chat message', success: false });
  }
});

// Analyze image endpoint (for eye analysis)
app.post('/api/chat/analyze-image', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    
    if (!image || !mimeType) {
      return res.status(400).json({ error: 'Image and mimeType are required', success: false });
    }

    // For eye analysis, use Gemini Vision directly
    const prompt = `You are a medical AI assistant specializing in ophthalmology. Analyze this eye image and provide:

1. **Visual Assessment**: Describe what you can observe in the image
2. **Potential Findings**: Any visible abnormalities, conditions, or normal features
3. **Recommendations**: Suggestions for the patient or when to see a doctor
4. **Important Note**: This is AI analysis only - consult an eye care professional for proper diagnosis

Please be thorough but remember this is not a substitute for professional medical advice.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini Vision API error: ${response.status}`);
    }

    const result = await response.json();
    const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to analyze the image at this time.";

    res.json({ success: true, response: analysis });
  } catch (error) {
    console.error('Image Analysis Error:', error);
    res.status(500).json({ error: 'Failed to analyze image', success: false });
  }
});

// Diet plan endpoint
app.post('/api/chat/diet-plan', async (req, res) => {
  try {
    const { goal, medicalReports } = req.body;
    
    let context = '';
    if (medicalReports && medicalReports.length > 0) {
      context = '\n\nMedical Context:\n' + medicalReports.map(report => 
        `Report: ${report.extractedText}\nAnalysis: ${report.aiAnalysis}`
      ).join('\n\n');
    }

    const prompt = `Create a personalized diet plan for: ${goal}

${context}

Provide:
1. Daily meal suggestions
2. Nutritional focus
3. Foods to include/avoid
4. Portion guidelines
5. Important disclaimers

⚠️ This is general advice. Consult a healthcare professional for medical conditions.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.4,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const dietPlan = result.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to generate diet plan.";

    res.json({ success: true, response: dietPlan });
  } catch (error) {
    console.error('Diet Plan Error:', error);
    res.status(500).json({ error: 'Failed to generate diet plan', success: false });
  }
});

// Health insights endpoint
app.post('/api/chat/insights', async (req, res) => {
  try {
    const { medicalReports } = req.body;
    
    if (!medicalReports || medicalReports.length === 0) {
      return res.status(400).json({ error: 'Medical reports are required', success: false });
    }

    const context = medicalReports.map(report => 
      `Report from ${report.uploadedAt}:\n${report.extractedText}\nAI Analysis: ${report.aiAnalysis}`
    ).join('\n\n');

    const prompt = `Analyze these medical reports and provide health insights:

${context}

Provide:
1. Overall health trends
2. Key patterns or concerns
3. Recommendations for improvement
4. When to consult healthcare providers

⚠️ This is AI analysis only. Consult medical professionals for health decisions.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const insights = result.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to generate insights.";

    res.json({ success: true, response: insights });
  } catch (error) {
    console.error('Insights Error:', error);
    res.status(500).json({ error: 'Failed to generate insights', success: false });
  }
});

// Medical reports endpoint
app.get('/api/medical/reports', async (req, res) => {
  try {
    // For now, return empty array since we don't have a database for reports
    // In a real app, you'd fetch from database
    res.json({ reports: [] });
  } catch (error) {
    console.error('Reports Error:', error);
    res.status(500).json({ error: 'Failed to fetch reports', success: false });
  }
});

// Medical Analysis Endpoint
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
    
    console.log('🤖 Starting Gemini AI analysis...');
    let analysis;
    try {
      analysis = await analyzeMedicalReport(extractedText);
      console.log('✅ AI analysis complete!');
    } catch (geminiError) {
      console.error('❌ Gemini Error:', geminiError.message);
      return res.status(500).json({ 
        error: "AI analysis failed",
        details: geminiError.message,
        extractedText: extractedText.trim(),
        success: false
      });
    }
    
    console.log('✅ Sending successful response');
    
    return res.status(200).json({ 
      extractedText: extractedText.trim(),
      analysis: analysis,
      success: true,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Unexpected Error:", error);
    return res.status(500).json({ 
      error: "Server error during analysis",
      details: error.message,
      success: false
    });
  }
});


// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Vivitsu Medical AI Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      medicalAnalysis: 'POST /api/medical/analyze',
      chatMessage: 'POST /api/chat/message',
      analyzeImage: 'POST /api/chat/analyze-image',
      dietPlan: 'POST /api/chat/diet-plan',
      healthInsights: 'POST /api/chat/insights',
      medicalReports: 'GET /api/medical/reports'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔑 Gemini API: ${GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`🏥 Medical Analysis: http://localhost:${PORT}/api/medical/analyze\n`);
});
