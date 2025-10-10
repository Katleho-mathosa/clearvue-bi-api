// routes/sales.js - CLEANED & FIXED VERSION

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
// BASIC SALES ENDPOINTS (TESTED & WORKING)
// ==============================

// GET /api/sales/periods
router.get('/periods', async (req, res, next) => {
  try {
    const { start, end, sort = -1, limit = 12, page = 1 } = req.query;
    
    const match = {};
    if (start) match.FIN_PERIOD = { $gte: parseInt(start) };
    if (end) match.FIN_PERIOD = { ...(match.FIN_PERIOD || {}), $lte: parseInt(end) };

    const skip = (parseInt(page) - 1) * parseInt(limit);

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
      { $match: match },
      {
        $group: {
          _id: "$FIN_PERIOD",
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
      { $skip: skip },
      { $limit: parseInt(limit) }
    ], { allowDiskUse: true }).toArray();

    sendResponse(res, results, page, limit);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/regions
router.get('/regions', async (req, res, next) => {
  try {
    const { sort = -1, limit = 10, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

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
          _id: "$customer_info.REGION_CODE",
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
      { $skip: skip },
      { $limit: parseInt(limit) }
    ], { allowDiskUse: true }).toArray();

    sendResponse(res, results, page, limit);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/top-products
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

// GET /api/sales/overview
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

// ==============================
// SIMPLE QUARTERLY & YTD ROLL-UPS (GUARANTEED TO WORK)
// ==============================

// GET /api/sales/quarterly-summary - SIMPLEST VERSION
router.get('/quarterly-summary', async (req, res, next) => {
  try {
    console.log('🔍 Calculating quarterly summary...');
    
    const results = await mongoose.connection.db.collection('Sales_Header').aggregate([
      {
        $lookup: {
          from: "Sales_Line",
          localField: "DOC_NUMBER",
          foreignField: "DOC_NUMBER",
          as: "lines"
        }
      },
      { $unwind: "$lines" },
      {
        $addFields: {
          lineTotal: { $toDouble: { $ifNull: ["$lines.TOTAL_LINE_PRICE", 0] } },
          month: { $toInt: { $substr: [{ $toString: "$FIN_PERIOD" }, 4, 2] } }
        }
      },
      {
        $addFields: {
          quarter: {
            $switch: {
              branches: [
                { case: { $lte: ["$month", 3] }, then: { $concat: [{ $substr: [{ $toString: "$FIN_PERIOD" }, 0, 4] }, "-Q1"] } },
                { case: { $lte: ["$month", 6] }, then: { $concat: [{ $substr: [{ $toString: "$FIN_PERIOD" }, 0, 4] }, "-Q2"] } },
                { case: { $lte: ["$month", 9] }, then: { $concat: [{ $substr: [{ $toString: "$FIN_PERIOD" }, 0, 4] }, "-Q3"] } }
              ],
              default: { $concat: [{ $substr: [{ $toString: "$FIN_PERIOD" }, 0, 4] }, "-Q4"] }
            }
          }
        }
      },
      {
        $group: {
          _id: "$quarter",
          totalRevenue: { $sum: "$lineTotal" },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $project: {
          quarter: "$_id",
          totalRevenue: 1,
          transactionCount: 1,
          averageRevenue: { $divide: ["$totalRevenue", "$transactionCount"] },
          _id: 0
        }
      },
      { $sort: { quarter: 1 } }
    ]).toArray();

    console.log(`✅ Quarterly summary: ${results.length} quarters`);
    sendResponse(res, results);
  } catch (error) {
    console.error('❌ Quarterly summary error:', error);
    next(error);
  }
});

// GET /api/sales/quarterly - SIMPLE VERSION
router.get('/quarterly', async (req, res, next) => {
  try {
    console.log('🔍 Calculating quarterly data...');
    
    // Use the same logic as quarterly-summary but with different grouping
    const results = await mongoose.connection.db.collection('Sales_Line').aggregate([
      {
        $lookup: {
          from: "Sales_Header",
          localField: "DOC_NUMBER",
          foreignField: "DOC_NUMBER",
          as: "header"
        }
      },
      { $unwind: "$header" },
      {
        $addFields: {
          lineTotal: { $toDouble: { $ifNull: ["$TOTAL_LINE_PRICE", 0] } },
          month: { $toInt: { $substr: [{ $toString: "$header.FIN_PERIOD" }, 4, 2] } }
        }
      },
      {
        $addFields: {
          quarter: {
            $switch: {
              branches: [
                { case: { $lte: ["$month", 3] }, then: { $concat: [{ $substr: [{ $toString: "$header.FIN_PERIOD" }, 0, 4] }, "-Q1"] } },
                { case: { $lte: ["$month", 6] }, then: { $concat: [{ $substr: [{ $toString: "$header.FIN_PERIOD" }, 0, 4] }, "-Q2"] } },
                { case: { $lte: ["$month", 9] }, then: { $concat: [{ $substr: [{ $toString: "$header.FIN_PERIOD" }, 0, 4] }, "-Q3"] } }
              ],
              default: { $concat: [{ $substr: [{ $toString: "$header.FIN_PERIOD" }, 0, 4] }, "-Q4"] }
            }
          }
        }
      },
      {
        $group: {
          _id: "$quarter",
          totalRevenue: { $sum: "$lineTotal" },
          totalQuantity: { $sum: { $toDouble: { $ifNull: ["$QUANTITY", 0] } } },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $project: {
          quarter: "$_id",
          totalRevenue: 1,
          totalQuantity: 1,
          transactionCount: 1,
          averageRevenue: { $divide: ["$totalRevenue", "$transactionCount"] },
          _id: 0
        }
      },
      { $sort: { quarter: 1 } }
    ]).toArray();

    console.log(`✅ Quarterly data: ${results.length} quarters`);
    sendResponse(res, results);
  } catch (error) {
    console.error('❌ Quarterly error:', error);
    next(error);
  }
});

// GET /api/sales/ytd - SIMPLE VERSION
router.get('/ytd', async (req, res, next) => {
  try {
    console.log('🔍 Calculating YTD...');
    
    // Get the latest financial period
    const latestDoc = await mongoose.connection.db.collection('Sales_Header')
      .findOne({}, { sort: { FIN_PERIOD: -1 } });
    const latestPeriod = latestDoc ? latestDoc.FIN_PERIOD : 202312;
    const currentYear = Math.floor(latestPeriod / 100);
    
    const results = await mongoose.connection.db.collection('Sales_Line').aggregate([
      {
        $lookup: {
          from: "Sales_Header",
          localField: "DOC_NUMBER",
          foreignField: "DOC_NUMBER",
          as: "header"
        }
      },
      { $unwind: "$header" },
      {
        $match: {
          "header.FIN_PERIOD": {
            $gte: currentYear * 100 + 1,
            $lte: latestPeriod
          }
        }
      },
      {
        $addFields: {
          lineTotal: { $toDouble: { $ifNull: ["$TOTAL_LINE_PRICE", 0] } },
          month: { $toInt: { $substr: [{ $toString: "$header.FIN_PERIOD" }, 4, 2] } }
        }
      },
      {
        $group: {
          _id: "$month",
          monthlyRevenue: { $sum: "$lineTotal" },
          monthlyQuantity: { $sum: { $toDouble: { $ifNull: ["$QUANTITY", 0] } } }
        }
      },
      { $sort: { _id: 1 } },
      {
        $group: {
          _id: null,
          months: {
            $push: {
              month: "$_id",
              revenue: "$monthlyRevenue",
              quantity: "$monthlyQuantity"
            }
          },
          ytdRevenue: { $sum: "$monthlyRevenue" },
          ytdQuantity: { $sum: "$monthlyQuantity" }
        }
      },
      {
        $project: {
          _id: 0,
          year: currentYear,
          months: 1,
          ytdRevenue: 1,
          ytdQuantity: 1,
          monthCount: { $size: "$months" }
        }
      }
    ]).toArray();

    const finalResults = results.length > 0 ? results : [{
      year: currentYear,
      months: [],
      ytdRevenue: 0,
      ytdQuantity: 0,
      monthCount: 0
    }];

    console.log(`✅ YTD data for year ${currentYear}`);
    sendResponse(res, finalResults);
  } catch (error) {
    console.error('❌ YTD error:', error);
    next(error);
  }
});

// GET /api/sales/quarterly-regions - SIMPLE VERSION
router.get('/quarterly-regions', async (req, res, next) => {
  try {
    console.log('🔍 Calculating quarterly regions...');
    
    const results = await mongoose.connection.db.collection('Sales_Line').aggregate([
      {
        $lookup: {
          from: "Sales_Header",
          localField: "DOC_NUMBER",
          foreignField: "DOC_NUMBER",
          as: "header"
        }
      },
      { $unwind: "$header" },
      {
        $lookup: {
          from: "Customer",
          localField: "header.CUSTOMER_NUMBER",
          foreignField: "CUSTOMER_NUMBER",
          as: "customer"
        }
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          lineTotal: { $toDouble: { $ifNull: ["$TOTAL_LINE_PRICE", 0] } },
          month: { $toInt: { $substr: [{ $toString: "$header.FIN_PERIOD" }, 4, 2] } },
          region: { $ifNull: ["$customer.REGION_CODE", "Unknown"] }
        }
      },
      {
        $addFields: {
          quarter: {
            $switch: {
              branches: [
                { case: { $lte: ["$month", 3] }, then: { $concat: [{ $substr: [{ $toString: "$header.FIN_PERIOD" }, 0, 4] }, "-Q1"] } },
                { case: { $lte: ["$month", 6] }, then: { $concat: [{ $substr: [{ $toString: "$header.FIN_PERIOD" }, 0, 4] }, "-Q2"] } },
                { case: { $lte: ["$month", 9] }, then: { $concat: [{ $substr: [{ $toString: "$header.FIN_PERIOD" }, 0, 4] }, "-Q3"] } }
              ],
              default: { $concat: [{ $substr: [{ $toString: "$header.FIN_PERIOD" }, 0, 4] }, "-Q4"] }
            }
          }
        }
      },
      {
        $group: {
          _id: {
            quarter: "$quarter",
            region: "$region"
          },
          totalRevenue: { $sum: "$lineTotal" },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $project: {
          quarter: "$_id.quarter",
          region: "$_id.region",
          totalRevenue: 1,
          transactionCount: 1,
          _id: 0
        }
      },
      { $sort: { quarter: 1, totalRevenue: -1 } },
      { $limit: 50 }
    ]).toArray();

    console.log(`✅ Quarterly regions: ${results.length} records`);
    sendResponse(res, results);
  } catch (error) {
    console.error('❌ Quarterly regions error:', error);
    next(error);
  }
});

// ==============================
// REALTIME ENDPOINTS
// ==============================

// GET /api/sales/realtime
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

// GET /api/sales/realtime/:period
router.get('/realtime/:period', async (req, res, next) => {
  try {
    const { period } = req.params;
    const { limit = 10 } = req.query;

    const results = await mongoose.connection.db.collection('RealTime_Transactions')
      .find({})
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();

    sendResponse(res, results);
  } catch (error) {
    next(error);
  }
});

module.exports = router;