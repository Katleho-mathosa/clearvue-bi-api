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

// GET all products (with optional pagination)
router.get('/', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const results = await mongoose.connection.db.collection('Products')
      .find({})
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    sendResponse(res, results, page, limit);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET top 10 products by stock or sales (aggregated)
router.get('/top', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Sales_Line').aggregate([
      { $set: { Total_Line_Price: { $toDouble: { $ifNull: ["$Total_Line_Price", 0] } } } },
      { $group: { _id: "$Inventory_code", totalSales: { $sum: "$Total_Line_Price" }, totalQty: { $sum: "$Quantity" } } },
      { $sort: { totalSales: -1 } },
      { $limit: 10 }
    ]).toArray();
    sendResponse(res, results);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET product categories
router.get('/categories', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Product_Categories').find({}).toArray();
    sendResponse(res, results);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET product brands
router.get('/brands', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Product_Brands').find({}).toArray();
    sendResponse(res, results);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET top categories by revenue
router.get('/top-categories', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Sales_Line').aggregate([
      { $lookup: { from: "Products", localField: "Inventory_code", foreignField: "Inventory_code", as: "product" } },
      { $unwind: "$product" },
      { $group: { _id: "$product.ProCAT_code", totalRevenue: { $sum: "$Total_Line_Price" } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]).toArray();
    sendResponse(res, results);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
