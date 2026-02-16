import mongoose from 'mongoose';

const medicalReportSchema = new mongoose.Schema({
  patientName: {
    type: String,
    default: 'Unknown'
  },
  uploadedImage: {
    type: String, // Base64 string
    required: true
  },
  extractedText: {
    type: String,
    required: true
  },
  aiAnalysis: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  reportType: {
    type: String,
    default: 'Medical Report'
  }
}, {
  timestamps: true
});

const MedicalReport = mongoose.model('MedicalReport', medicalReportSchema);

export default MedicalReport;
