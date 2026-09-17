const db = require('../config/db');

// GET /api/dashboard/stats
const getDashboardStats = async (req, res) => {
  const userId = req.user.id;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);
    const sevenDaysStr = sevenDaysLater.toISOString().split('T')[0];

    const twoDaysLater = new Date(today);
    twoDaysLater.setDate(today.getDate() + 2);
    const twoDaysStr = twoDaysLater.toISOString().split('T')[0];

    const currentDay = today.getDay(); // 0=Sun
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + distanceToMonday);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startStr = startOfWeek.toISOString().split('T')[0];
    const endStr = endOfWeek.toISOString().split('T')[0];

    const currentMonthYear = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Execute all database operations concurrently
    const [
      [[countsRow]],
      [criticalRows],
      [weeklyRows],
      [scannedRows],
      [statsRows]
    ] = await Promise.all([
      db.query(
        `SELECT 
          COUNT(*) AS total,
          COALESCE(SUM(expiry_date > ?), 0) AS fresh,
          COALESCE(SUM(expiry_date >= ? AND expiry_date <= ?), 0) AS expiringSoon,
          COALESCE(SUM(expiry_date < ?), 0) AS expired
         FROM products WHERE user_id = ?`,
        [sevenDaysStr, todayStr, sevenDaysStr, todayStr, userId]
      ),
      db.query(
        `SELECT id, name, category, barcode, purchase_date, expiry_date, location, quantity, image_url FROM products
         WHERE user_id = ? AND expiry_date <= ?
         ORDER BY expiry_date ASC LIMIT 10`,
        [userId, twoDaysStr]
      ),
      db.query(
        `SELECT name, expiry_date FROM products
         WHERE user_id = ? AND expiry_date BETWEEN ? AND ?`,
        [userId, startStr, endStr]
      ),
      db.query(
        `SELECT id, name, scanned_at FROM scanned_history
         WHERE user_id = ? ORDER BY scanned_at DESC LIMIT 3`,
        [userId]
      ),
      db.query(
        'SELECT * FROM sustainability_stats WHERE user_id = ? AND month_year = ?',
        [userId, currentMonthYear]
      )
    ]);

    const total = Number(countsRow?.total || 0);
    const fresh = Number(countsRow?.fresh || 0);
    const expiringSoon = Number(countsRow?.expiringSoon || 0);
    const expired = Number(countsRow?.expired || 0);

    const criticalItems = criticalRows.map(p => {
      const expDate = new Date(p.expiry_date);
      expDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      let statusText = '';
      if (diffDays < 0) statusText = 'Expired';
      else if (diffDays === 0) statusText = 'Expiring Today';
      else statusText = `Expiring in ${diffDays}d`;
      return { 
        id: p.id, 
        name: p.name, 
        category: p.category,
        barcode: p.barcode,
        purchase_date: p.purchase_date,
        expiry_date: p.expiry_date,
        location: p.location, 
        quantity: p.quantity,
        image_url: p.image_url,
        statusText, 
        diffDays 
      };
    });

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weeklyExpiry = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };
    weeklyRows.forEach(p => {
      const d = new Date(p.expiry_date);
      const dayName = daysOfWeek[d.getDay()];
      if (weeklyExpiry[dayName] !== undefined) {
        weeklyExpiry[dayName].push(p.name);
      }
    });

    const recentlyScanned = scannedRows.map(s => {
      const diffMs = Date.now() - new Date(s.scanned_at).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      let timeAgo = '';
      if (diffMins < 1) timeAgo = 'Just now';
      else if (diffMins < 60) timeAgo = `${diffMins} mins ago`;
      else if (diffMins < 1440) timeAgo = `${Math.floor(diffMins / 60)} hours ago`;
      else timeAgo = `${Math.floor(diffMins / 1440)} days ago`;
      return { id: s.id, name: s.name, timeAgo };
    });
    const sustainability = {
      utilizationRate: total > 0 ? Math.round((fresh / total) * 100) : 0,
      co2SavedKg: statsRows[0]?.co2_saved_kg ?? null,
      budgetSavedUsd: statsRows[0]?.budget_saved_usd ?? null
    };

    return res.status(200).json({
      metrics: { totalProducts: total, freshProducts: fresh, expiringSoon, expired },
      criticalItems,
      weeklyExpiry,
      sustainability,
      recentlyScanned,
      recipe: {
        name: 'Use Up Salad',
        ingredients: 'Strawberries, Spinach, Feta',
        btnText: 'Get Recipe'
      }
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    return res.status(500).json({ error: 'Server error fetching dashboard stats.' });
  }
};

module.exports = { getDashboardStats };
