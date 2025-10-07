const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Helper function for standardized response
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

// GET /api/sales/periods?start=YYYYMM&end=YYYYMM&sort=-1&limit=12&page=1
router.get('/periods', async (req, res, next) => {
  try {
    const { start, end, sort = -1, limit = 12, page = 1 } = req.query;
    const match = {};

    if (start) match.financialPeriod = { $gte: parseInt(start) };
    if (end) match.financialPeriod = { ...(match.financialPeriod || {}), $lte: parseInt(end) };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const results = await mongoose.connection.db
      .collection('sales_summary_period')
      .find(match)
      .sort({ financialPeriod: parseInt(sort) })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    sendResponse(res, results, page, limit);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/regions?sort=-1&limit=10&page=1
router.get('/regions', async (req, res, next) => {
  try {
    const { sort = -1, limit = 10, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const results = await mongoose.connection.db
      .collection('sales_summary_region')
      .find({})
      .sort({ totalRevenue: parseInt(sort) })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    sendResponse(res, results, page, limit);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/realtime/:period?region=REGIONCODE
router.get('/realtime/:period', async (req, res, next) => {
  try {
    const { period } = req.params;
    const { region } = req.query;

    const pipeline = [
      { $match: { FIN_PERIOD: parseInt(period) } },
      {
        $lookup: {
          from: "Sales_Line",
          localField: "DOC_NUMBER",
          foreignField: "DOC_NUMBER",
          as: "line_items"
        }
      },
      { $unwind: "$line_items" }
    ];

    if (region) {
      pipeline.push({ $match: { REGION_CODE: region } });
    }

    pipeline.push({
      $group: {
        _id: null,
        totalRevenue: { $sum: "$line_items.TOTAL_LINE_PRICE" },
        totalQuantity: { $sum: "$line_items.QUANTITY" },
        transactionCount: { $sum: 1 }
      }
    });

    const results = await mongoose.connection.db
      .collection('Sales_Header')
      .aggregate(pipeline)
      .toArray();

    sendResponse(res, results[0] ? [results[0]] : []);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/realtime
router.get('/realtime', async (req, res) => {
  try {
    const { since } = req.query;
    const query = since ? { createdAt: { $gte: new Date(since) } } : {};

    const results = await mongoose.connection.db
      .collection('RealTime_Transactions')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('❌ Realtime API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/sales/overview
router.get('/overview', async (req, res) => {
  try {
    const periods = await mongoose.connection.db
      .collection('sales_summary_period')
      .find({})
      .toArray();

    const regions = await mongoose.connection.db
      .collection('sales_summary_region')
      .find({})
      .toArray();

    res.json({
      success: true,
      data: {
        periods,
        regions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
