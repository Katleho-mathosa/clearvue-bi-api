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

// DEBUG ROUTE - Keep this for testing
router.get('/debug', async (req, res) => {
  try {
    const collections = ['Customer_Categories', 'Payment_Lines', 'Age_Analysis', 'Customer'];
    const results = {};
    
    for (const collName of collections) {
      try {
        const count = await mongoose.connection.db.collection(collName).countDocuments();
        const sample = await mongoose.connection.db.collection(collName).findOne({});
        results[collName] = {
          exists: true,
          documentCount: count,
          sampleFields: sample ? Object.keys(sample) : 'No documents',
          sampleData: sample
        };
      } catch (err) {
        results[collName] = {
          exists: false,
          error: err.message
        };
      }
    }
    
    res.json({ success: true, debug: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==============================
// FIXED CUSTOMER ENDPOINTS WITH CORRECT FIELD NAMES
// ==============================

// GET customer segments (categories) - FIXED
router.get('/segments', async (req, res) => {
  try {
    console.log('🔍 Fetching customer segments...');
    
    const results = await mongoose.connection.db.collection('Customer_Categories')
      .find({})
      .sort({ CCAT_CODE: 1 })
      .toArray();
    
    console.log(`✅ Found customer segments: ${results.length} categories`);
    sendResponse(res, results);
  } catch (error) {
    console.error('❌ Customer segments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET top customers by payments - FIXED
router.get('/top-payments', async (req, res) => {
  try {
    console.log('🔍 Fetching top payments...');
    
    const results = await mongoose.connection.db.collection('Payment_Lines').aggregate([
      {
        $match: {
          TOT_PAYMENT: { $gt: 0 } // Only positive payments (ignore negative/refunds)
        }
      },
      {
        $group: {
          _id: "$CUSTOMER_NUMBER",
          totalPaid: { 
            $sum: { 
              $toDouble: { 
                $ifNull: ["$TOT_PAYMENT", 0] 
              } 
            } 
          },
          paymentCount: { $sum: 1 },
          lastPayment: { $max: "$DEPOSIT_DATE" },
          avgPayment: { $avg: { $toDouble: { $ifNull: ["$TOT_PAYMENT", 0] } } }
        }
      },
      {
        $lookup: {
          from: "Customer",
          localField: "_id",
          foreignField: "CUSTOMER_NUMBER",
          as: "customer_info"
        }
      },
      { $unwind: { path: "$customer_info", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          customerNumber: "$_id",
          totalPaid: 1,
          paymentCount: 1,
          lastPayment: 1,
          avgPayment: { $round: ["$avgPayment", 2] },
          creditLimit: "$customer_info.CREDIT_LIMIT",
          region: "$customer_info.REGION_CODE",
          category: "$customer_info.CCAT_CODE",
          _id: 0
        }
      },
      { $sort: { totalPaid: -1 } },
      { $limit: 10 }
    ], { allowDiskUse: true }).toArray();
    
    console.log(`✅ Found top payments: ${results.length} customers`);
    sendResponse(res, results);
  } catch (error) {
    console.error('❌ Top payments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET customer age analysis - FIXED
router.get('/age-analysis', async (req, res) => {
  try {
    console.log('🔍 Fetching age analysis...');
    
    const { limit = 20, period } = req.query;
    
    let match = {};
    if (period) {
      match.FIN_PERIOD = parseInt(period);
    }
    
    const results = await mongoose.connection.db.collection('Age_Analysis').aggregate([
      { $match: match },
      {
        $lookup: {
          from: "Customer",
          localField: "CUSTOMER_NUMBER",
          foreignField: "CUSTOMER_NUMBER",
          as: "customer_info"
        }
      },
      { $unwind: { path: "$customer_info", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          customerNumber: "$CUSTOMER_NUMBER",
          finPeriod: "$FIN_PERIOD",
          totalDue: { $toDouble: { $ifNull: ["$TOTAL_DUE", 0] } },
          current: { $toDouble: { $ifNull: ["$AMT_CURRENT", 0] } },
          overdue30: { $toDouble: { $ifNull: ["$AMT_30_DAYS", 0] } },
          overdue60: { $toDouble: { $ifNull: ["$AMT_60_DAYS", 0] } },
          overdue90: { $toDouble: { $ifNull: ["$AMT_90_DAYS", 0] } },
          overdue120: { $toDouble: { $ifNull: ["$AMT_120_DAYS", 0] } },
          creditLimit: "$customer_info.CREDIT_LIMIT",
          region: "$customer_info.REGION_CODE",
          category: "$customer_info.CCAT_CODE",
          creditUtilization: {
            $cond: [
              { $or: [{ $eq: ["$customer_info.CREDIT_LIMIT", 0] }, { $eq: ["$customer_info.CREDIT_LIMIT", null] }] },
              0,
              { 
                $multiply: [
                  { $divide: [{ $toDouble: { $ifNull: ["$TOTAL_DUE", 0] } }, { $toDouble: "$customer_info.CREDIT_LIMIT" }] },
                  100
                ]
              }
            ]
          },
          riskCategory: {
            $switch: {
              branches: [
                { case: { $gt: [{ $toDouble: { $ifNull: ["$TOTAL_DUE", 0] } }, { $multiply: [{ $toDouble: "$customer_info.CREDIT_LIMIT" }, 0.8] }] }, then: "High Risk" },
                { case: { $gt: [{ $toDouble: { $ifNull: ["$TOTAL_DUE", 0] } }, { $multiply: [{ $toDouble: "$customer_info.CREDIT_LIMIT" }, 0.5] }] }, then: "Medium Risk" }
              ],
              default: "Low Risk"
            }
          }
        }
      },
      { $match: { totalDue: { $gt: 0 } } }, // Only customers with outstanding balances
      { $sort: { totalDue: -1 } },
      { $limit: parseInt(limit) }
    ]).toArray();
    
    console.log(`✅ Found age analysis data: ${results.length} customers`);
    sendResponse(res, results);
  } catch (error) {
    console.error('❌ Age analysis error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET customer payment trends - NEW ENDPOINT
router.get('/payment-trends', async (req, res) => {
  try {
    const results = await mongoose.connection.db.collection('Payment_Lines').aggregate([
      {
        $match: {
          TOT_PAYMENT: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: "$FIN_PERIOD",
          totalPayments: { 
            $sum: { 
              $toDouble: { 
                $ifNull: ["$TOT_PAYMENT", 0] 
              } 
            } 
          },
          paymentCount: { $sum: 1 },
          uniqueCustomers: { $addToSet: "$CUSTOMER_NUMBER" }
        }
      },
      {
        $project: {
          period: "$_id",
          totalPayments: 1,
          paymentCount: 1,
          uniqueCustomerCount: { $size: "$uniqueCustomers" },
          avgPayment: { $divide: ["$totalPayments", "$paymentCount"] },
          _id: 0
        }
      },
      { $sort: { period: 1 } },
      { $limit: 12 }
    ], { allowDiskUse: true }).toArray();
    
    sendResponse(res, results);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// EXISTING ROUTES (keep these)
router.get('/', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const results = await mongoose.connection.db.collection('Customer_Regions')
      .find({})
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    sendResponse(res, results, page, limit);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;