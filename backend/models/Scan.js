import mongoose from 'mongoose';

const scanSchema = new mongoose.Schema({
  heartRate: {
    type: Number,
    required: true
  },
  hrv: {
    type: Number,
    required: true
  },
  bloodPressure: {
    systolic: { type: Number, required: true },
    diastolic: { type: Number, required: true }
  },
  stressIndex: {
    type: Number,
    default: 0
  },
  aiInterpretation: {
    type: String,
    default: 'Scan completed successfully.'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  userId: {
    type: String,
    default: 'default-user'
  }
}, { timestamps: true });

const Scan = mongoose.model('Scan', scanSchema);

export default Scan;
