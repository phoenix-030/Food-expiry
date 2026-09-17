const bcrypt = require('bcryptjs');
const db = require('../config/db');
const {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_BASE_OPTS,
  SESSION_COOKIE_OPTS,
  createSession,
  deleteSession
} = require('../utils/sessionStore');

const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const userRole = role || 'Household Lead';

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashed, userRole]
    );

    const user = { id: result.insertId, name, email, role: userRole, avatar_url: null };
    const sessionToken = await createSession(user.id);

    res.cookie(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTS);
    return res.status(201).json({ message: 'Registration successful.', user });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error during registration.' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const dbUser = rows[0];
    const isMatch = await bcrypt.compare(password, dbUser.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      avatar_url: dbUser.avatar_url
    };
    const sessionToken = await createSession(user.id);

    res.cookie(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTS);
    return res.status(200).json({ message: 'Login successful.', user });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
};

const getMe = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    return res.status(200).json({ user: rows[0] });
  } catch (err) {
    console.error('GetMe error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
};

const updateProfile = async (req, res) => {
  const { name, email, avatar_url } = req.body;
  const trimmedName = name?.trim();
  const trimmedEmail = email?.trim().toLowerCase();
  const trimmedAvatarUrl = avatar_url?.trim() || null;

  if (!trimmedName || !trimmedEmail) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (trimmedAvatarUrl && trimmedAvatarUrl.length > 4_000_000) {
    return res.status(400).json({ error: 'Profile image must be smaller than 3 MB.' });
  }

  try {
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [trimmedEmail, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'That email address is already in use.' });
    }

    await db.query(
      'UPDATE users SET name = ?, email = ?, avatar_url = ? WHERE id = ?',
      [trimmedName, trimmedEmail, trimmedAvatarUrl, req.user.id]
    );
    const [rows] = await db.query(
      'SELECT id, name, email, role, avatar_url FROM users WHERE id = ?',
      [req.user.id]
    );

    return res.status(200).json({ message: 'Profile updated successfully.', user: rows[0] });
  } catch (err) {
    console.error('UpdateProfile error:', err);
    return res.status(500).json({ error: 'Server error updating profile.' });
  }
};

const logout = async (req, res) => {
  try {
    await deleteSession(req.cookies?.[SESSION_COOKIE_NAME]);
  } catch (err) {
    console.error('Logout session cleanup error:', err);
  }

  res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_BASE_OPTS);
  return res.status(200).json({ message: 'Logged out successfully.' });
};
                                                                                               
module.exports = { register, login, getMe, updateProfile, logout };
                   