require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Custom request logger + response time middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`📌 ${req.method} ${req.originalUrl} - ${res.statusCode} [${duration}ms]`);
  });
  next();
});

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/sales', require('./routes/sales'));
app.use('/api/products', require('./routes/products'));
app.use('/api/customers', require('./routes/customers')); // optional

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'ClearVue BI API',
    version: '1.0',
    endpoints: [
      '/api/sales/periods',
      '/api/sales/regions',
      '/api/products/top',
      '/api/customers/segments'
    ]
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('❌ API Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 BI API Server running on port ${PORT}`);
});
