const { SESSION_COOKIE_NAME, findSessionUser } = require('../utils/sessionStore');

const authMiddleware = async (req, res, next) => {
  let token = req.cookies?.[SESSION_COOKIE_NAME];

  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please log in.' });
  }

  try {
    const user = await findSessionUser(token);

    if (!user) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    req.user = user;
    return next();
  } catch (err) {
    console.error('Session verification error:', err);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
};

module.exports = authMiddleware;
