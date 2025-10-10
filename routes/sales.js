// routes/sales.js - UPDATED VERSION

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

// ==============================
// FIXED SALES ENDPOINTS
// ==============================

// GET /api/sales/periods - FIXED
router.get('/periods', async (req, res, next) => {
  try {
    const { start, end, sort = -1, limit = 12, page = 1 } = req.query;
    
    // Use AGGREGATION instead of pre-computed collection
    const results = await mongoose.connection.db.collection('Sales_Header').aggregate([
      {
        $lookup: {
          from: "Sales_Line",
          localField: "DOC_NUMBER",
          foreignField: "DOC_NUMBER",
          as: "line_items"
        }
      },
      { $unwind: "$line_items" },
      {
        $group: {
          _id: "$FIN_PERIOD", // Use ACTUAL field name from your data
          totalRevenue: { 
            $sum: { 
              $toDouble: { 
                $ifNull: ["$line_items.TOTAL_LINE_PRICE", 0] 
              } 
            } 
          },
          transactionCount: { $sum: 1 }
        }
      },
      { 
        $project: {
          financialPeriod: "$_id",
          totalRevenue: 1,
          transactionCount: 1,
          _id: 0
        }
      },
      { $sort: { financialPeriod: parseInt(sort) } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ], { allowDiskUse: true }).toArray();

    sendResponse(res, results, page, limit);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/regions - FIXED
router.get('/regions', async (req, res, next) => {
  try {
    const { sort = -1, limit = 10, page = 1 } = req.query;

    const results = await mongoose.connection.db.collection('Sales_Header').aggregate([
      {
        $lookup: {
          from: "Sales_Line",
          localField: "DOC_NUMBER",
          foreignField: "DOC_NUMBER",
          as: "line_items"
        }
      },
      {
        $lookup: {
          from: "Customer",
          localField: "CUSTOMER_NUMBER", 
          foreignField: "CUSTOMER_NUMBER",
          as: "customer_info"
        }
      },
      { $unwind: "$line_items" },
      { $unwind: "$customer_info" },
      {
        $group: {
          _id: "$customer_info.REGION_CODE", // Use actual field name
          totalRevenue: { 
            $sum: { 
              $toDouble: { 
                $ifNull: ["$line_items.TOTAL_LINE_PRICE", 0] 
              } 
            } 
          },
          customerCount: { $addToSet: "$CUSTOMER_NUMBER" }
        }
      },
      {
        $project: {
          region: "$_id",
          totalRevenue: 1,
          customerCount: { $size: "$customerCount" },
          _id: 0
        }
      },
      { $sort: { totalRevenue: parseInt(sort) } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ], { allowDiskUse: true }).toArray();

    sendResponse(res, results, page, limit);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/top-products - FIXED
router.get('/top-products', async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const results = await mongoose.connection.db.collection('Sales_Line').aggregate([
      {
        $group: {
          _id: "$INVENTORY_CODE",
          totalRevenue: { 
            $sum: { 
              $toDouble: { 
                $ifNull: ["$TOTAL_LINE_PRICE", 0] 
              } 
            } 
          },
          totalQuantity: { 
            $sum: { 
              $toDouble: { 
                $ifNull: ["$QUANTITY", 0] 
              } 
            } 
          },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $project: {
          productCode: "$_id",
          totalRevenue: 1,
          totalQuantity: 1,
          transactionCount: 1,
          _id: 0
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) }
    ], { allowDiskUse: true }).toArray();

    sendResponse(res, results);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/overview - NEW
router.get('/overview', async (req, res, next) => {
  try {
    const [periods, regions, topProducts] = await Promise.all([
      // Periods summary
      mongoose.connection.db.collection('Sales_Header').aggregate([
        { $lookup: { from: "Sales_Line", localField: "DOC_NUMBER", foreignField: "DOC_NUMBER", as: "line_items" } },
        { $unwind: "$line_items" },
        {
          $group: {
            _id: "$FIN_PERIOD",
            totalRevenue: { $sum: { $toDouble: { $ifNull: ["$line_items.TOTAL_LINE_PRICE", 0] } } },
            transactionCount: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } },
        { $limit: 6 }
      ]).toArray(),

      // Regions summary  
      mongoose.connection.db.collection('Sales_Header').aggregate([
        { $lookup: { from: "Sales_Line", localField: "DOC_NUMBER", foreignField: "DOC_NUMBER", as: "line_items" } },
        { $lookup: { from: "Customer", localField: "CUSTOMER_NUMBER", foreignField: "CUSTOMER_NUMBER", as: "customer_info" } },
        { $unwind: "$line_items" },
        { $unwind: "$customer_info" },
        {
          $group: {
            _id: "$customer_info.REGION_CODE",
            totalRevenue: { $sum: { $toDouble: { $ifNull: ["$line_items.TOTAL_LINE_PRICE", 0] } } }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 }
      ]).toArray(),

      // Top products
      mongoose.connection.db.collection('Sales_Line').aggregate([
        {
          $group: {
            _id: "$INVENTORY_CODE",
            totalRevenue: { $sum: { $toDouble: { $ifNull: ["$TOTAL_LINE_PRICE", 0] } } }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 }
      ]).toArray()
    ]);

    sendResponse(res, {
      periods,
      regions, 
      topProducts,
      summary: {
        totalPeriods: periods.length,
        totalRegions: regions.length,
        totalProducts: topProducts.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/realtime - FIXED
router.get('/realtime', async (req, res, next) => {
  try {
    const results = await mongoose.connection.db.collection('RealTime_Transactions')
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    
    sendResponse(res, results);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/realtime/:period - NEW
router.get('/realtime/:period', async (req, res, next) => {
  try {
    const { period } = req.params;
    const { limit = 10 } = req.query;

    const results = await mongoose.connection.db.collection('RealTime_Transactions')
      .find({ 
        // Simulate filtering by period - adjust based on your real-time data structure
        $expr: {
          $eq: [
            { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            period
          ]
        }
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();

    sendResponse(res, results);
  } catch (error) {
    next(error);
  }
});

module.exports = router;