const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Helper for consistent responses
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

// GET top 10 products by sales
router.get('/top', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Sales_Line').aggregate([
      {
        $addFields: {
          lineTotal: { $toDouble: { $ifNull: ["$TOTAL_LINE_PRICE", "$LINE_TOTAL", 0] } },
          qty: { $toDouble: { $ifNull: ["$QUANTITY", "$QTY", 0] } }
        }
      },
      {
        $group: {
          _id: "$INVENTORY_CODE",
          totalSales: { $sum: "$lineTotal" },
          totalQty: { $sum: "$qty" }
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 }
    ], { allowDiskUse: true }).toArray();
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

// GET top categories by revenue (join Products -> Sales_Line)
router.get('/top-categories', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Sales_Line').aggregate([
      {
        $addFields: {
          lineTotal: { $toDouble: { $ifNull: ["$TOTAL_LINE_PRICE", "$LINE_TOTAL", 0] } }
        }
      },
      {
        $lookup: {
          from: "Products",
          localField: "INVENTORY_CODE",
          foreignField: "INVENTORY_CODE",
          as: "product"
        }
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$product.PRODCAT_CODE",
          totalRevenue: { $sum: "$lineTotal" },
          productCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ], { allowDiskUse: true }).toArray();
    sendResponse(res, results);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
