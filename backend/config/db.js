const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'expire_reminder',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

// Auto-migrate: Ensure image_url column exists in products table
(async () => {
  try {
    const [quantityCountCols] = await promisePool.query("SHOW COLUMNS FROM products LIKE 'quantity_count'");
    if (quantityCountCols.length === 0) {
      await promisePool.query("ALTER TABLE products ADD COLUMN quantity_count INT NOT NULL DEFAULT 1 AFTER quantity");
      console.log("✅ Auto-migration: Added quantity_count column to products table.");
    }

    const [cols] = await promisePool.query("SHOW COLUMNS FROM products LIKE 'image_url'");
    if (cols.length === 0) {
      await promisePool.query("ALTER TABLE products ADD COLUMN image_url TEXT DEFAULT NULL AFTER quantity");
      console.log("✅ Auto-migration: Added image_url column to products table.");
    }
  } catch (err) {
    // Table might not exist yet if fresh DB
    console.warn("Database column check notice:", err.message);
  }
})();

module.exports = promisePool;