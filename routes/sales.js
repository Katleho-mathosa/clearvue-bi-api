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

// ==========================================================
// EXISTING ENDPOINTS
// ==========================================================

// GET /api/sales/periods?start=YYYYMM&end=YYYYMM&sort=-1&limit=12&page=1
router.get('/periods', async (req, res, next) => {
  try {
    const { start, end, sort = -1, limit = 12, page = 1 } = req.query;
    const match = {};
    if (start) match.FIN_period = { $gte: parseInt(start) };
    if (end) match.FIN_period = { ...(match.FIN_period || {}), $lte: parseInt(end) };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const results = await mongoose.connection.db
      .collection('sales_summary_period')
      .find(match)
      .sort({ FIN_period: parseInt(sort) })
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

    const pipeline = [
      { $match: { FIN_period: parseInt(period) } },
      {
        $lookup: {
          from: "Sales_Line",
          localField: "Doc_number",
          foreignField: "Doc_Number",
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
        totalRevenue: { $sum: "$line_items.Total_Line_Price" },
        totalQuantity: { $sum: "$line_items.Quantity" },
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
router.get('/top-products', async (req, res) => {
  try {
    const result = await mongoose.connection.db.collection('Sales_Line').aggregate([
      { $group: { _id: "$Inventory_code", totalSales: { $sum: "$Total_Line_Price" }, totalQty: { $sum: "$Quantity" } } },
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
 * 1️⃣ Top 10 Products by Total Revenue
 */
router.get('/top-products-revenue', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Sales_Line').aggregate([
      { $set: { LINE_TOTAL: { $toDouble: { $ifNull: ["$Total_Line_Price", 0] } } } },
      { $group: { _id: "$Inventory_code", totalRevenue: { $sum: "$LINE_TOTAL" }, totalQty: { $sum: "$Quantity" } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]).toArray();
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
      { $lookup: { from: "Sales_Line", localField: "Doc_number", foreignField: "Doc_Number", as: "lines" } },
      { $unwind: "$lines" },
      { $set: { lineTotal: { $toDouble: { $ifNull: ["$lines.Total_Line_Price", 0] } } } },
      { $group: { _id: "$Customer_number", totalSpent: { $sum: "$lineTotal" }, transactionCount: { $sum: 1 } } },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]).toArray();
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 3️⃣ Revenue per Month
 */
router.get('/revenue-per-month', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Sales_Header').aggregate([
      { $set: { FIN_period: { $toString: "$FIN_period" } } },
      { $lookup: { from: "Sales_Line", localField: "Doc_number", foreignField: "Doc_Number", as: "lines" } },
      { $unwind: "$lines" },
      { $set: { lineTotal: { $toDouble: { $ifNull: ["$lines.Total_Line_Price", 0] } } } },
      { $group: { _id: "$FIN_period", totalRevenue: { $sum: "$lineTotal" } } },
      { $sort: { _id: 1 } }
    ]).toArray();
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
      { $lookup: { from: "Sales_Line", localField: "Doc_number", foreignField: "Doc_Number", as: "lines" } },
      { $unwind: "$lines" },
      { $set: { qty: { $toInt: { $ifNull: ["$lines.Quantity", 1] } }, FIN_period: 1 } },
      { $group: { _id: "$FIN_period", totalQty: { $sum: "$qty" } } },
      { $sort: { _id: 1 } }
    ]).toArray();
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
      { $set: { lineTotal: { $toDouble: { $ifNull: ["$Total_Line_Price", 0] } }, cost: { $toDouble: { $ifNull: ["$Last_cost", 0] } } } },
      { $group: { _id: "$Inventory_code", totalRevenue: { $sum: "$lineTotal" }, totalCost: { $sum: "$cost" } } },
      { $set: { profitMargin: { $subtract: ["$totalRevenue", "$totalCost"] } } },
      { $sort: { profitMargin: -1 } }
    ]).toArray();
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
      { $lookup: { from: "Sales_Line", localField: "Doc_number", foreignField: "Doc_Number", as: "lines" } },
      { $unwind: "$lines" },
      { $set: { lineTotal: { $toDouble: { $ifNull: ["$lines.Total_Line_Price", 0] } } } },
      { $group: { _id: "$Region_code", totalRevenue: { $sum: "$lineTotal" } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 }
    ]).toArray();
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
