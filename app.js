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
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 20000, // Wait up to 20 seconds before timing out
})
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err.message));

// Listen for Mongoose connection events
mongoose.connection.on('connected', () => {
  console.log('🟢 Mongoose connected to database');
});

mongoose.connection.on('disconnected', () => {
  console.warn('🟠 Mongoose disconnected');
});

mongoose.connection.on('error', err => {
  console.error('🔴 Mongoose connection error:', err);
});

// Routes
app.use('/api/sales', require('./routes/sales'));
app.use('/api/products', require('./routes/products'));
app.use('/api/customers', require('./routes/customers'));

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '📊 ClearVue BI API',
    version: '1.0',
    endpoints: {
      sales: [
        '/api/sales/periods',
        '/api/sales/regions',
        '/api/sales/top-products',
        '/api/sales/realtime',
        '/api/sales/realtime/:period'
      ],
      products: [
        '/api/products/top',
        '/api/products/categories',
        '/api/products/stock-status'
      ],
      customers: [
        '/api/customers/top-payments',
        '/api/customers/age-analysis',
        '/api/customers/parameters',
        '/api/customers/regions'
      ]
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    endpoint: req.originalUrl
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
