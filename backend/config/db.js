const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const isSslEnabled =
  process.env.DB_SSL === 'true' ||
  process.env.DB_SSL === '1' ||
  (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com')) ||
  (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('tidbcloud.com'));

const poolConfig = process.env.DATABASE_URL
  ? {
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: isSslEnabled ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'expire_reminder',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: isSslEnabled ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined
    };

const pool = mysql.createPool(poolConfig);
const promisePool = pool.promise();

// Ensure all tables and required columns exist before the HTTP server accepts
// requests. This prevents a newly deployed service from serving registration
// requests while its database is still empty.
let initializeDatabasePromise;

const initializeDatabase = () => {
  if (initializeDatabasePromise) return initializeDatabasePromise;

  initializeDatabasePromise = (async () => {
    // 1. Users table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        avatar_url MEDIUMTEXT DEFAULT NULL,
        role VARCHAR(100) DEFAULT 'Household Lead',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 2. User sessions table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        INDEX idx_user_sessions_user_id (user_id),
        INDEX idx_user_sessions_expires_at (expires_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 3. Products table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        barcode VARCHAR(100) DEFAULT NULL,
        purchase_date DATE NOT NULL,
        expiry_date DATE NOT NULL,
        location VARCHAR(100) DEFAULT 'Fridge',
        quantity VARCHAR(100) DEFAULT NULL,
        quantity_count INT NOT NULL DEFAULT 1,
        image_url TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 4. Scanned history table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS scanned_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 5. Sustainability stats table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS sustainability_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        utilization_rate DECIMAL(5,2) DEFAULT 0.00,
        co2_saved_kg DECIMAL(10,2) DEFAULT 0.00,
        budget_saved_usd DECIMAL(10,2) DEFAULT 0.00,
        month_year VARCHAR(50) NOT NULL,
        UNIQUE KEY unique_user_month (user_id, month_year),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Check specific columns on products table
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
    console.log('Database initialization complete.');
  })();

  return initializeDatabasePromise;
};

module.exports = promisePool;
module.exports.initializeDatabase = initializeDatabase;
