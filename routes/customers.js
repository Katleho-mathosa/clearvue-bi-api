const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GET all customer segments
router.get('/segments', async (req, res) => {
  try {
    const pipeline = [
      {
        $lookup: {
          from: 'Sales_Header',
          localField: 'CUSTOMER_NUMBER',
          foreignField: 'CUSTOMER_NUMBER',
          as: 'sales'
        }
      },
      { $unwind: '$sales' },
      {
        $lookup: {
          from: 'Sales_Line',
          localField: 'sales.DOC_NUMBER',
          foreignField: 'DOC_NUMBER',
          as: 'line_items'
        }
      },
      { $unwind: '$line_items' },
      {
        $group: {
          _id: '$CUSTOMER_NUMBER',
          totalRevenue: { $sum: '$line_items.TOTAL_LINE_PRICE' },
          transactionCount: { $sum: 1 },
          averageOrderValue: { $avg: '$line_items.TOTAL_LINE_PRICE' },
          region: { $first: '$REGION_CODE' }
        }
      },
      {
        $addFields: {
          segment: {
            $switch: {
              branches: [
                { case: { $gte: ['$totalRevenue', 50000] }, then: 'High Value' },
                { case: { $gte: ['$totalRevenue', 10000] }, then: 'Medium Value' }
              ],
              default: 'Low Value'
            }
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ];

    const results = await mongoose.connection.db
      .collection('Customer')
      .aggregate(pipeline)
      .toArray();

    res.json({ success: true, data: results, total: results.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET customers by segment
router.get('/segments/:segment', async (req, res) => {
  try {
    const { segment } = req.params;

    const pipeline = [
      {
        $lookup: {
          from: 'Sales_Header',
          localField: 'CUSTOMER_NUMBER',
          foreignField: 'CUSTOMER_NUMBER',
          as: 'sales'
        }
      },
      { $unwind: '$sales' },
      {
        $lookup: {
          from: 'Sales_Line',
          localField: 'sales.DOC_NUMBER',
          foreignField: 'DOC_NUMBER',
          as: 'line_items'
        }
      },
      { $unwind: '$line_items' },
      {
        $group: {
          _id: '$CUSTOMER_NUMBER',
          totalRevenue: { $sum: '$line_items.TOTAL_LINE_PRICE' },
          transactionCount: { $sum: 1 },
          averageOrderValue: { $avg: '$line_items.TOTAL_LINE_PRICE' },
          region: { $first: '$REGION_CODE' }
        }
      },
      {
        $addFields: {
          segment: {
            $switch: {
              branches: [
                { case: { $gte: ['$totalRevenue', 50000] }, then: 'High Value' },
                { case: { $gte: ['$totalRevenue', 10000] }, then: 'Medium Value' }
              ],
              default: 'Low Value'
            }
          }
        }
      },
      { $match: { segment: segment } },
      { $sort: { totalRevenue: -1 } }
    ];

    const results = await mongoose.connection.db
      .collection('Customer')
      .aggregate(pipeline)
      .toArray();

    res.json({ success: true, data: results, total: results.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
