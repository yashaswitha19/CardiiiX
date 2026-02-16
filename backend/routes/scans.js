import express from 'express';
import Scan from '../models/Scan.js';

const router = express.Router();

// GET all scans
router.get('/scans', async (req, res) => {
  try {
    const scans = await Scan.find().sort({ timestamp: -1 }).limit(50);
    res.json(scans);
  } catch (error) {
    console.error('Error fetching scans:', error);
    res.status(500).json({ error: 'Failed to fetch scans', details: error.message });
  }
});

// GET single scan by ID
router.get('/scans/:id', async (req, res) => {
  try {
    const scan = await Scan.findById(req.params.id);
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    res.json(scan);
  } catch (error) {
    console.error('Error fetching scan:', error);
    res.status(500).json({ error: 'Failed to fetch scan', details: error.message });
  }
});

// POST new scan
router.post('/scans', async (req, res) => {
  try {
    const scanData = req.body;
    
    // Validate required fields
    if (!scanData.heartRate || !scanData.bloodPressure) {
      return res.status(400).json({ error: 'Missing required fields: heartRate and bloodPressure' });
    }

    const newScan = new Scan(scanData);
    const savedScan = await newScan.save();
    
    console.log('Scan saved to MongoDB:', savedScan._id);
    res.status(201).json(savedScan);
  } catch (error) {
    console.error('Error saving scan:', error);
    res.status(500).json({ error: 'Failed to save scan', details: error.message });
  }
});

// DELETE scan
router.delete('/scans/:id', async (req, res) => {
  try {
    const deletedScan = await Scan.findByIdAndDelete(req.params.id);
    if (!deletedScan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    res.json({ message: 'Scan deleted successfully', deletedScan });
  } catch (error) {
    console.error('Error deleting scan:', error);
    res.status(500).json({ error: 'Failed to delete scan', details: error.message });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'API is running', timestamp: new Date() });
});

export default router;
