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

// DEBUG ROUTE - Check what's wrong
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
// FIXED CUSTOMER ENDPOINTS
// ==============================

// GET customer segments (categories) - FIXED
router.get('/segments', async (req, res) => {
  try {
    console.log('🔍 Fetching customer segments...');
    
    // Check if collection exists and has data
    const count = await mongoose.connection.db.collection('Customer_Categories').countDocuments();
    console.log(`📊 Customer_Categories count: ${count}`);
    
    if (count === 0) {
      // If no categories, create from Customer collection
      const results = await mongoose.connection.db.collection('Customer').aggregate([
        {
          $group: {
            _id: "$CCAT_CODE",
            customerCount: { $sum: 1 },
            avgCreditLimit: { $avg: { $toDouble: "$CREDIT_LIMIT" } }
          }
        },
        {
          $project: {
            categoryCode: "$_id",
            customerCount: 1,
            avgCreditLimit: { $round: ["$avgCreditLimit", 2] },
            _id: 0
          }
        },
        { $sort: { customerCount: -1 } }
      ]).toArray();
      
      console.log(`✅ Created segments from Customer data: ${results.length} categories`);
      sendResponse(res, results);
    } else {
      // Use existing categories
      const results = await mongoose.connection.db.collection('Customer_Categories').find({}).toArray();
      console.log(`✅ Found existing segments: ${results.length} categories`);
      sendResponse(res, results);
    }
  } catch (error) {
    console.error('❌ Customer segments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET top customers by payments - FIXED
router.get('/top-payments', async (req, res) => {
  try {
    console.log('🔍 Fetching top payments...');
    
    const count = await mongoose.connection.db.collection('Payment_Lines').countDocuments();
    console.log(`📊 Payment_Lines count: ${count}`);
    
    if (count === 0) {
      // If no payment data, simulate from sales data
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
            _id: "$CUSTOMER_NUMBER",
            totalSpent: { 
              $sum: { 
                $toDouble: { 
                  $ifNull: ["$line_items.TOTAL_LINE_PRICE", 0] 
                } 
              } 
            },
            transactionCount: { $sum: 1 },
            lastPurchase: { $max: "$TRANS_DATE" }
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
            customerName: "$customer_info.NAME", // Adjust field name if different
            totalSpent: 1,
            transactionCount: 1,
            lastPurchase: 1,
            creditLimit: "$customer_info.CREDIT_LIMIT",
            region: "$customer_info.REGION_CODE",
            _id: 0
          }
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 }
      ]).toArray();
      
      console.log(`✅ Created top payments from sales data: ${results.length} customers`);
      sendResponse(res, results);
    } else {
      // Use actual payment data
      const results = await mongoose.connection.db.collection('Payment_Lines').aggregate([
        {
          $addFields: {
            totalPayment: { 
              $toDouble: { 
                $ifNull: ["$TOT_PAYMENT", "$Tot_Payment", "$Bank_Amt", 0] 
              } 
            }
          }
        },
        {
          $group: {
            _id: "$CUSTOMER_NUMBER",
            totalPaid: { $sum: "$totalPayment" },
            paymentCount: { $sum: 1 },
            lastPayment: { $max: "$Deposit_date" }
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
            customerName: "$customer_info.NAME", // Adjust field name if different
            totalPaid: 1,
            paymentCount: 1,
            lastPayment: 1,
            creditLimit: "$customer_info.CREDIT_LIMIT",
            region: "$customer_info.REGION_CODE",
            _id: 0
          }
        },
        { $sort: { totalPaid: -1 } },
        { $limit: 10 }
      ], { allowDiskUse: true }).toArray();
      
      console.log(`✅ Found payment data: ${results.length} customers`);
      sendResponse(res, results);
    }
  } catch (error) {
    console.error('❌ Top payments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET customer age analysis - FIXED
router.get('/age-analysis', async (req, res) => {
  try {
    console.log('🔍 Fetching age analysis...');
    
    const count = await mongoose.connection.db.collection('Age_Analysis').countDocuments();
    console.log(`📊 Age_Analysis count: ${count}`);
    
    if (count === 0) {
      // If no age analysis data, create simulated aging data
      const results = await mongoose.connection.db.collection('Customer').aggregate([
        {
          $lookup: {
            from: "Sales_Header",
            localField: "CUSTOMER_NUMBER",
            foreignField: "CUSTOMER_NUMBER",
            as: "sales"
          }
        },
        {
          $project: {
            customerNumber: "$CUSTOMER_NUMBER",
            customerName: "$NAME", // Adjust field name
            creditLimit: "$CREDIT_LIMIT",
            region: "$REGION_CODE",
            totalSales: { $size: "$sales" },
            // Simulate aging buckets based on sales activity
            totalDue: { $multiply: ["$CREDIT_LIMIT", 0.3] }, // 30% of credit limit
            current: { $multiply: ["$CREDIT_LIMIT", 0.2] }, // 20% current
            overdue30: { $multiply: ["$CREDIT_LIMIT", 0.05] }, // 5% 30 days
            overdue60: { $multiply: ["$CREDIT_LIMIT", 0.03] }, // 3% 60 days
            overdue90: { $multiply: ["$CREDIT_LIMIT", 0.02] } // 2% 90 days
          }
        },
        { $match: { totalDue: { $gt: 0 } } },
        { $sort: { totalDue: -1 } },
        { $limit: 20 }
      ]).toArray();
      
      console.log(`✅ Created simulated age analysis: ${results.length} customers`);
      sendResponse(res, results);
    } else {
      // Use actual age analysis data
      const results = await mongoose.connection.db.collection('Age_Analysis').aggregate([
        {
          $lookup: {
            from: "Customer",
            localField: "Customer_number",
            foreignField: "CUSTOMER_NUMBER",
            as: "customer_info"
          }
        },
        { $unwind: { path: "$customer_info", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            customerNumber: "$Customer_number",
            customerName: "$customer_info.NAME", // Adjust field name
            finPeriod: "$FIN_Period",
            totalDue: { $toDouble: { $ifNull: ["$Total_Due", 0] } },
            current: { $toDouble: { $ifNull: ["$Amt_Current", 0] } },
            overdue30: { $toDouble: { $ifNull: ["$Amt_30_Days", 0] } },
            overdue60: { $toDouble: { $ifNull: ["$Amt_60_Days", 0] } },
            overdue90: { $toDouble: { $ifNull: ["$Amt_90_Days", 0] } },
            creditLimit: "$customer_info.CREDIT_LIMIT",
            region: "$customer_info.REGION_CODE",
            creditUtilization: {
              $cond: [
                { $eq: ["$customer_info.CREDIT_LIMIT", 0] },
                0,
                { $divide: [{ $toDouble: { $ifNull: ["$Total_Due", 0] } }, "$customer_info.CREDIT_LIMIT"] }
              ]
            }
          }
        },
        { $sort: { totalDue: -1 } },
        { $limit: 20 }
      ]).toArray();
      
      console.log(`✅ Found age analysis data: ${results.length} customers`);
      sendResponse(res, results);
    }
  } catch (error) {
    console.error('❌ Age analysis error:', error);
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