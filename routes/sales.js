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

// Add to the top of sales.js
const { getFinancialQuarter, isYearToDate, getCurrentFinancialPeriod } = require('../utils/financialCalendar');

// ==============================
// QUARTERLY & YTD ROLL-UPS
// ==============================

// GET /api/sales/quarterly
router.get('/quarterly', async (req, res, next) => {
  try {
    const { year, sort = -1 } = req.query;
    
    const match = {};
    if (year) {
      match.FIN_PERIOD = { 
        $gte: parseInt(year) * 100 + 1,  // YYYY01
        $lte: parseInt(year) * 100 + 12  // YYYY12
      };
    }

    const results = await mongoose.connection.db.collection('Sales_Header').aggregate([
      { $match: match },
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
        $addFields: {
          lineTotal: { 
            $toDouble: { 
              $ifNull: ["$line_items.TOTAL_LINE_PRICE", 0] 
            } 
          },
          financialQuarter: {
            $function: {
              body: function(finPeriod) {
                const periodStr = finPeriod.toString();
                const year = parseInt(periodStr.substring(0, 4));
                const month = parseInt(periodStr.substring(4, 6));
                
                if (month >= 1 && month <= 3) return `${year}-Q1`;
                if (month >= 4 && month <= 6) return `${year}-Q2`;
                if (month >= 7 && month <= 9) return `${year}-Q3`;
                if (month >= 10 && month <= 12) return `${year}-Q4`;
                return `${year}-Unknown`;
              },
              args: ["$FIN_PERIOD"],
              lang: "js"
            }
          }
        }
      },
      {
        $group: {
          _id: "$financialQuarter",
          totalRevenue: { $sum: "$lineTotal" },
          transactionCount: { $sum: 1 },
          totalQuantity: { $sum: { $toDouble: { $ifNull: ["$line_items.QUANTITY", 0] } } },
          uniqueCustomers: { $addToSet: "$CUSTOMER_NUMBER" },
          uniqueProducts: { $addToSet: "$line_items.INVENTORY_CODE" }
        }
      },
      {
        $project: {
          quarter: "$_id",
          totalRevenue: 1,
          transactionCount: 1,
          totalQuantity: 1,
          uniqueCustomerCount: { $size: "$uniqueCustomers" },
          uniqueProductCount: { $size: "$uniqueProducts" },
          averageTransaction: { $divide: ["$totalRevenue", "$transactionCount"] },
          _id: 0
        }
      },
      { $sort: { quarter: parseInt(sort) } }
    ], { allowDiskUse: true }).toArray();

    sendResponse(res, results);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/ytd
router.get('/ytd', async (req, res, next) => {
  try {
    const { year } = req.query;
    const currentYear = year || Math.floor(getCurrentFinancialPeriod() / 100);
    
    const results = await mongoose.connection.db.collection('Sales_Header').aggregate([
      { 
        $match: { 
          FIN_PERIOD: { 
            $gte: parseInt(currentYear) * 100 + 1,  // YYYY01
            $lte: getCurrentFinancialPeriod()       // Current period
          }
        } 
      },
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
        $addFields: {
          lineTotal: { 
            $toDouble: { 
              $ifNull: ["$line_items.TOTAL_LINE_PRICE", 0] 
            } 
          },
          month: {
            $function: {
              body: function(finPeriod) {
                return parseInt(finPeriod.toString().substring(4, 6));
              },
              args: ["$FIN_PERIOD"],
              lang: "js"
            }
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $substr: [{ $toString: "$FIN_PERIOD" }, 0, 4] },
            month: "$month"
          },
          monthlyRevenue: { $sum: "$lineTotal" },
          monthlyTransactions: { $sum: 1 },
          monthlyQuantity: { $sum: { $toDouble: { $ifNull: ["$line_items.QUANTITY", 0] } } }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $group: {
          _id: "$_id.year",
          months: {
            $push: {
              month: "$_id.month",
              revenue: "$monthlyRevenue",
              transactions: "$monthlyTransactions",
              quantity: "$monthlyQuantity"
            }
          },
          ytdRevenue: { $sum: "$monthlyRevenue" },
          ytdTransactions: { $sum: "$monthlyTransactions" },
          ytdQuantity: { $sum: "$monthlyQuantity" }
        }
      },
      {
        $project: {
          year: "$_id",
          months: 1,
          ytdRevenue: 1,
          ytdTransactions: 1,
          ytdQuantity: 1,
          averageMonthlyRevenue: { $divide: ["$ytdRevenue", { $size: "$months" }] },
          averageTransactionValue: { $divide: ["$ytdRevenue", "$ytdTransactions"] },
          _id: 0
        }
      }
    ], { allowDiskUse: true }).toArray();

    sendResponse(res, results);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/quarterly-regions
router.get('/quarterly-regions', async (req, res, next) => {
  try {
    const { year, quarter } = req.query;
    
    const match = {};
    if (year) {
      const startMonth = quarter === 'Q1' ? 1 : quarter === 'Q2' ? 4 : quarter === 'Q3' ? 7 : 10;
      const endMonth = quarter === 'Q1' ? 3 : quarter === 'Q2' ? 6 : quarter === 'Q3' ? 9 : 12;
      
      match.FIN_PERIOD = { 
        $gte: parseInt(year) * 100 + startMonth,
        $lte: parseInt(year) * 100 + endMonth
      };
    }

    const results = await mongoose.connection.db.collection('Sales_Header').aggregate([
      { $match: match },
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
        $addFields: {
          lineTotal: { 
            $toDouble: { 
              $ifNull: ["$line_items.TOTAL_LINE_PRICE", 0] 
            } 
          },
          quarter: {
            $function: {
              body: function(finPeriod) {
                const periodStr = finPeriod.toString();
                const year = parseInt(periodStr.substring(0, 4));
                const month = parseInt(periodStr.substring(4, 6));
                
                if (month >= 1 && month <= 3) return `${year}-Q1`;
                if (month >= 4 && month <= 6) return `${year}-Q2`;
                if (month >= 7 && month <= 9) return `${year}-Q3`;
                if (month >= 10 && month <= 12) return `${year}-Q4`;
                return `${year}-Unknown`;
              },
              args: ["$FIN_PERIOD"],
              lang: "js"
            }
          }
        }
      },
      {
        $group: {
          _id: {
            quarter: "$quarter",
            region: "$customer_info.REGION_CODE"
          },
          totalRevenue: { $sum: "$lineTotal" },
          transactionCount: { $sum: 1 },
          uniqueCustomers: { $addToSet: "$CUSTOMER_NUMBER" }
        }
      },
      {
        $project: {
          quarter: "$_id.quarter",
          region: "$_id.region",
          totalRevenue: 1,
          transactionCount: 1,
          uniqueCustomerCount: { $size: "$uniqueCustomers" },
          marketSharePercentage: { 
            $multiply: [
              { 
                $divide: [
                  "$totalRevenue",
                  { 
                    $sum: "$totalRevenue" 
                  }
                ] 
              },
              100
            ] 
          },
          _id: 0
        }
      },
      { $sort: { quarter: 1, totalRevenue: -1 } }
    ], { allowDiskUse: true }).toArray();

    sendResponse(res, results);
  } catch (error) {
    next(error);
  }
});

module.exports = router;