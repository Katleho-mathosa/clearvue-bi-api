const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

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

// GET /api/products/top?page=1&limit=10
router.get('/top', async (req, res, next) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const results = await mongoose.connection.db
      .collection('sales_summary_products')
      .find({})
      .sort({ totalRevenue: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    sendResponse(res, results, page, limit);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/categories
router.get('/categories', async (req, res, next) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: "$category",
          totalRevenue: { $sum: "$totalRevenue" },
          productCount: { $sum: 1 },
          averagePrice: { $avg: "$averagePrice" }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ];

    const results = await mongoose.connection.db
      .collection('sales_summary_products')
      .aggregate(pipeline)
      .toArray();

    sendResponse(res, results);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
