const path = require("path");
const fs = require("fs");
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const { initializeDatabase } = require('./config/db');

const app = express();

// Middleware
app.use(compression());

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true   // ← required to allow cookies cross-origin
}));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ message: 'Welcome to Expire Reminder API', status: 'ok' });
});
app.get('/api/health', (req, res) => {
  res.json({ message: 'Welcome to Expire Reminder API', status: 'ok' });
});

// API Routes
app.use('/api/auth',      require('./routes/authRoutes'));
app.use('/api/products',  require('./routes/productRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

// 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

// Serve frontend build if dist folder exists
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback for Express 5: any unmatched route serves index.html
  app.use((req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // Health check fallback for API-only mode
  app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Expire Reminder API', status: 'ok' });
  });
  // 404
  app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Database initialization failed:', err);
    process.exit(1);
  }
};

startServer();
