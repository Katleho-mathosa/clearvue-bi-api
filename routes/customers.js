const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const sendResponse = (res, data, page = 1, limit = 0) => {
  res.json({
    success: true,
    data,
    meta: {
      total: Array.isArray(data) ? data.length : (data ? 1 : 0),
      page: parseInt(page),
      limit: parseInt(limit)
    }
  });
};

// GET customers - FIXED
router.get('/', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const results = await mongoose.connection.db.collection('Customer') // ACTUAL collection name
      .find({})
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
      
    sendResponse(res, results, page, limit);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET customer regions - FIXED
router.get('/regions', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Customer_Regions').find({}).toArray();
    sendResponse(res, results);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// SIMPLE TEST
router.get('/test', async (req, res) => {
  try {
    const customerCount = await mongoose.connection.db.collection('Customer').countDocuments();
    res.json({
      success: true,
      message: "Customers API working!",
      data: { total_customers: customerCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;