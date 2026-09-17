const crypto = require('crypto');
const db = require('../config/db');

const SESSION_COOKIE_NAME = 'freshtrack_session';
const SESSION_TTL_DAYS = 10;

const SESSION_COOKIE_BASE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production'
};

const SESSION_COOKIE_OPTS = {
  ...SESSION_COOKIE_BASE_OPTS,
  maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
};

let ensureSessionTablePromise;

const ensureSessionTable = () => {
  if (!ensureSessionTablePromise) {
    ensureSessionTablePromise = db.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_sessions_user_id (user_id),
        INDEX idx_user_sessions_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  return ensureSessionTablePromise;
};

const createRawToken = () => crypto.randomBytes(32).toString('hex');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createSession = async (userId) => {
  await ensureSessionTable();

  const token = createRawToken();
  await db.query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
    [userId, hashToken(token), SESSION_TTL_DAYS]
  );

  return token;
};

const findSessionUser = async (token) => {
  if (!token) return null;

  await ensureSessionTable();

  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.avatar_url, u.created_at
     FROM user_sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [hashToken(token)]
  );

  return rows[0] || null;
};

const deleteSession = async (token) => {
  if (!token) return;

  await ensureSessionTable();
  await db.query('DELETE FROM user_sessions WHERE token_hash = ?', [hashToken(token)]);
};

module.exports = {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_BASE_OPTS,
  SESSION_COOKIE_OPTS,
  createSession,
  deleteSession,
  findSessionUser
};
