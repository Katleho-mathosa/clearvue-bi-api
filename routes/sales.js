const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Helper function for standardized response
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

// GET /api/sales/periods?start=YYYYMM&end=YYYYMM&sort=-1&limit=12&page=1
router.get('/periods', async (req, res, next) => {
  try {
    const { start, end, sort = -1, limit = 12, page = 1 } = req.query;
    const match = {};
    if (start) match.calculated_FIN_PERIOD = { $gte: parseInt(start) };
    if (end) match.calculated_FIN_PERIOD = { ...(match.calculated_FIN_PERIOD || {}), $lte: parseInt(end) };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const results = await mongoose.connection.db
      .collection('sales_summary_period')
      .find(match)
      .sort({ calculated_FIN_PERIOD: parseInt(sort) })
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

// GET /api/sales/realtime/:period?region=REGION_CODE
router.get('/realtime/:period', async (req, res, next) => {
  try {
    const { period } = req.params;
    const { region } = req.query;

    const matchStage = { calculated_FIN_PERIOD: parseInt(period) };
    if (region) matchStage.Region_code = region;

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "Sales_Line",
          localField: "DOC_NUMBER",
          foreignField: "DOC_NUMBER",
          as: "line_items"
        }
      },
      { $unwind: { path: "$line_items", preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          lineValue: {
            $toDouble: {
              $ifNull: ["$line_items.TOTAL_LINE_PRICE", "$line_items.LINE_TOTAL", 0]
            }
          },
          lineQty: {
            $toDouble: {
              $ifNull: ["$line_items.QUANTITY", "$line_items.QTY", 0]
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$lineValue" },
          totalQuantity: { $sum: "$lineQty" },
          transactionCount: { $sum: 1 }
        }
      }
    ];

    const results = await mongoose.connection.db
      .collection('Sales_Header')
      .aggregate(pipeline, { allowDiskUse: true })
      .toArray();

    sendResponse(res, results[0] ? [results[0]] : []);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/realtime (simulated realtime transactions)
router.get('/realtime', async (req, res) => {
  try {
    const { since } = req.query;
    const query = since ? { Deposit_date: { $gte: new Date(since) } } : {};
    const results = await mongoose.connection.db
      .collection('RealTime_Transactions')
      .find(query)
      .sort({ Deposit_date: -1 })
      .toArray();

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('❌ Realtime API error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/sales/overview
router.get('/overview', async (req, res) => {
  try {
    const periods = await mongoose.connection.db.collection('sales_summary_period').find({}).toArray();
    const regions = await mongoose.connection.db.collection('sales_summary_region').find({}).toArray();
    res.json({ success: true, data: { periods, regions } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/sales/top-products
// corrected to use provided field names and fallbacks
router.get('/top-products', async (req, res) => {
  try {
    const result = await mongoose.connection.db.collection('Sales_Line').aggregate([
      {
        $addFields: {
          lineValue: {
            $toDouble: { $ifNull: ["$TOTAL_LINE_PRICE", "$LINE_TOTAL", 0] }
          },
          qty: { $toDouble: { $ifNull: ["$QUANTITY", "$QTY", 0] } }
        }
      },
      { $group: { _id: "$INVENTORY_CODE", totalSales: { $sum: "$lineValue" }, totalQty: { $sum: "$qty" } } },
      { $sort: { totalSales: -1 } },
      { $limit: 10 }
    ]).toArray();

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================================
// NEW DASHBOARD / ANALYTICS ENDPOINTS
// ==========================================================

/**
 * 1️⃣ Top 10 Products by Total Revenue (detailed)
 */
router.get('/top-products-revenue', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Sales_Line').aggregate([
      {
        $addFields: {
          lineTotal: {
            $toDouble: { $ifNull: ["$TOTAL_LINE_PRICE", "$LINE_TOTAL", 0] }
          },
          qty: { $toDouble: { $ifNull: ["$QUANTITY", "$QTY", 0] } }
        }
      },
      {
        $group: {
          _id: "$INVENTORY_CODE",
          totalRevenue: { $sum: "$lineTotal" },
          totalQty: { $sum: "$qty" }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ], { allowDiskUse: true }).toArray();

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 2️⃣ Top 10 Customers by Total Spending
 */
router.get('/top-customers', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Sales_Header').aggregate([
      {
        $lookup: {
          from: "Sales_Line",
          localField: "DOC_NUMBER",
          foreignField: "DOC_NUMBER",
          as: "lines"
        }
      },
      { $unwind: { path: "$lines", preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          lineTotal: {
            $toDouble: { $ifNull: ["$lines.TOTAL_LINE_PRICE", "$lines.LINE_TOTAL", 0] }
          }
        }
      },
      {
        $group: {
          _id: "$CUSTOMER_NUMBER",
          totalSpent: { $sum: "$lineTotal" },
          transactionCount: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ], { allowDiskUse: true }).toArray();

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 3️⃣ Revenue per Month (FIN_PERIOD)
 */
router.get('/revenue-per-month', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Sales_Header').aggregate([
      {
        $lookup: {
          from: "Sales_Line",
          localField: "DOC_NUMBER",
          foreignField: "DOC_NUMBER",
          as: "lines"
        }
      },
      { $unwind: { path: "$lines", preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          lineTotal: { $toDouble: { $ifNull: ["$lines.TOTAL_LINE_PRICE", "$lines.LINE_TOTAL", 0] } }
        }
      },
      {
        $group: {
          _id: "$FIN_PERIOD",
          totalRevenue: { $sum: "$lineTotal" }
        }
      },
      { $sort: { _id: 1 } }
    ], { allowDiskUse: true }).toArray();

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 4️⃣ Quantity Sold per Month
 */
router.get('/qty-per-month', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Sales_Header').aggregate([
      {
        $lookup: {
          from: "Sales_Line",
          localField: "DOC_NUMBER",
          foreignField: "DOC_NUMBER",
          as: "lines"
        }
      },
      { $unwind: { path: "$lines", preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          qty: { $toDouble: { $ifNull: ["$lines.QUANTITY", "$lines.QTY", 0] } }
        }
      },
      {
        $group: {
          _id: "$FIN_PERIOD",
          totalQty: { $sum: "$qty" }
        }
      },
      { $sort: { _id: 1 } }
    ], { allowDiskUse: true }).toArray();

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 5️⃣ Profit Margin per Product
 */
router.get('/profit-margin', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Sales_Line').aggregate([
      {
        $addFields: {
          lineTotal: { $toDouble: { $ifNull: ["$TOTAL_LINE_PRICE", "$LINE_TOTAL", 0] } },
          cost: { $toDouble: { $ifNull: ["$LAST_COST", 0] } }
        }
      },
      {
        $group: {
          _id: "$INVENTORY_CODE",
          totalRevenue: { $sum: "$lineTotal" },
          totalCost: { $sum: "$cost" }
        }
      },
      {
        $addFields: {
          profitMargin: { $subtract: ["$totalRevenue", "$totalCost"] },
          profitPct: {
            $cond: [{ $eq: ["$totalRevenue", 0] }, 0, { $multiply: [{ $divide: [{ $subtract: ["$totalRevenue", "$totalCost"] }, "$totalRevenue"] }, 100] }]
          }
        }
      },
      { $sort: { profitMargin: -1 } }
    ], { allowDiskUse: true }).toArray();

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 6️⃣ Top 5 Regions by Revenue
 */
router.get('/top-regions', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Sales_Header').aggregate([
      {
        $lookup: {
          from: "Sales_Line",
          localField: "DOC_NUMBER",
          foreignField: "DOC_NUMBER",
          as: "lines"
        }
      },
      { $unwind: { path: "$lines", preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          lineTotal: { $toDouble: { $ifNull: ["$lines.TOTAL_LINE_PRICE", "$lines.LINE_TOTAL", 0] } }
        }
      },
      {
        $group: {
          _id: "$Region_code",
          totalRevenue: { $sum: "$lineTotal" }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 }
    ], { allowDiskUse: true }).toArray();

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 7️⃣ Optional: Real-Time Simulated Latest Sales
 */
router.get('/realtime-latest', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('RealTime_Transactions')
      .find({})
      .sort({ Deposit_date: -1 })
      .limit(5)
      .toArray();
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 8️⃣ Optional: Aggregated Overview (Periods + Regions)
 */
router.get('/overview-aggregated', async (req, res) => {
  try {
    const periods = await mongoose.connection.db.collection('sales_summary_period').find({}).toArray();
    const regions = await mongoose.connection.db.collection('sales_summary_region').find({}).toArray();
    res.json({ success: true, data: { periods, regions } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
