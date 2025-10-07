const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Helper for consistent responses
const sendResponse = (res, data, page = 1, limit = 0) => {
  res.json({
    success: true,
    data,
    meta: {
      total: data.length,
      page: parseInt(page),
      limit: parseInt(limit)
    }
  });
};

// GET all customers (with optional pagination)
router.get('/', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const results = await mongoose.connection.db.collection('Customer_Regions')
      .find({})
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    sendResponse(res, results, page, limit);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET customer segments
router.get('/segments', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Customer_Categories').find({}).toArray();
    sendResponse(res, results);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET top customers by payments
router.get('/top-payments', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Payment_Lines').aggregate([
      { $set: { totalPayment: { $toDouble: { $ifNull: ["$Tot_Payment", 0] } } } },
      { $group: { _id: "$Customer_number", totalPaid: { $sum: "$totalPayment" }, transactionCount: { $sum: 1 } } },
      { $sort: { totalPaid: -1 } },
      { $limit: 10 }
    ]).toArray();
    sendResponse(res, results);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET customer age analysis
router.get('/age-analysis', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Age_Analysis').aggregate([
      {
        $project: {
          Customer_number: 1,
          FIN_Period: 1,
          Total_Due: 1,
          Amt_Current: 1,
          Amt_30_Days: 1,
          Amt_60_Days: 1,
          Amt_90_Days: 1,
          Amt_120_Days: 1,
          Amt_150_Days: 1,
          Amt_180_Days: 1,
          Amt_210_Days: 1,
          Amt_240_Days: 1,
          Amt_270_Days: 1,
          Amt_300_Days: 1
        }
      }
    ]).toArray();
    sendResponse(res, results);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;