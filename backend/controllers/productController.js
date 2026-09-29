








const db = require('../config/db');

// GET /api/products
// Query: ?category=Dairy&search=milk&page=1&limit=10
const getProducts = async (req, res) => {
  const userId = req.user.id;
  const { category, search, page = 1, limit = 10 } = req.query;

  try {
    let whereClauses = ['p.user_id = ?'];
    let params = [userId];

    if (category) {
      whereClauses.push('p.category = ?');
      params.push(category);
    }
    if (search) {
      whereClauses.push('(p.name LIKE ? OR p.barcode LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSQL = whereClauses.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Fetch total count and paginated products concurrently
    const [[countRows], [products]] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total FROM products p WHERE ${whereSQL}`, params),
      db.query(
        `SELECT * FROM products p WHERE ${whereSQL} ORDER BY p.expiry_date ASC LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      )
    ]);
    const total = countRows[0].total;

    return res.status(200).json({
      products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('getProducts error:', err);
    return res.status(500).json({ error: 'Server error fetching products.' });
  }
};

// POST /api/products
const addProduct = async (req, res) => {
  const userId = req.user.id;
  const { name, category, barcode, purchase_date, expiry_date, location, quantity, quantity_count, image_url } = req.body;

  if (!name || !category || !purchase_date || !expiry_date) {
    return res.status(400).json({ error: 'Name, category, purchase_date, and expiry_date are required.' });
  }

  try {
    const quantityToAdd = Math.max(1, parseInt(quantity_count, 10) || 1);
    let savedProduct;

    if (barcode) {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [existingProducts] = await connection.query(
          'SELECT * FROM products WHERE user_id = ? AND barcode = ? AND expiry_date = ? AND location = ? LIMIT 1 FOR UPDATE',
          [userId, barcode, expiry_date, location || 'Fridge']
        );

        if (existingProducts.length > 0) {
          const existingProduct = existingProducts[0];
          await connection.query(
            'UPDATE products SET quantity_count = COALESCE(quantity_count, 1) + ? WHERE id = ? AND user_id = ?',
            [quantityToAdd, existingProduct.id, userId]
          );
          const [updatedProducts] = await connection.query('SELECT * FROM products WHERE id = ?', [existingProduct.id]);
          savedProduct = updatedProducts[0];
        } else {
          const [result] = await connection.query(
            `INSERT INTO products (user_id, name, category, barcode, purchase_date, expiry_date, location, quantity, quantity_count, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, name, category, barcode, purchase_date, expiry_date, location || 'Fridge', quantity || null, quantityToAdd, image_url || null]
          );
          const [newProducts] = await connection.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
          savedProduct = newProducts[0];
        }

        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } else {
      const [result] = await db.query(
        `INSERT INTO products (user_id, name, category, barcode, purchase_date, expiry_date, location, quantity, quantity_count, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, category, null, purchase_date, expiry_date, location || 'Fridge', quantity || null, quantityToAdd, image_url || null]
      );
      const [newProducts] = await db.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
      savedProduct = newProducts[0];
    }

    // Also add to scanned_history
    await db.query(
      'INSERT INTO scanned_history (user_id, name) VALUES (?, ?)',
      [userId, name]
    );

    return res.status(201).json({
      message: 'Product added successfully.',
      product: savedProduct
    });
  } catch (err) {
    console.error('addProduct error:', err);
    return res.status(500).json({ error: 'Server error adding product.' });
  }
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
  const userId = req.user.id;
  const productId = req.params.id;
  const { name, category, barcode, purchase_date, expiry_date, location, quantity, quantity_count, image_url } = req.body;

  try {
    // Verify ownership
    const [rows] = await db.query('SELECT id FROM products WHERE id = ? AND user_id = ?', [productId, userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found or access denied.' });
    }

    await db.query(
      `UPDATE products SET name=?, category=?, barcode=?, purchase_date=?, expiry_date=?, location=?, quantity=?, quantity_count=?, image_url=?
       WHERE id = ? AND user_id = ?`,
      [name, category, barcode || null, purchase_date, expiry_date, location, quantity || null, Math.max(1, parseInt(quantity_count, 10) || 1), image_url || null, productId, userId]
    );

    const [updated] = await db.query('SELECT * FROM products WHERE id = ?', [productId]);
    return res.status(200).json({ message: 'Product updated.', product: updated[0] });
  } catch (err) {
    console.error('updateProduct error:', err);
    return res.status(500).json({ error: 'Server error updating product.' });
  }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  const userId = req.user.id;
  const productId = req.params.id;

  try {
    const [rows] = await db.query('SELECT id FROM products WHERE id = ? AND user_id = ?', [productId, userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found or access denied.' });
    }

    await db.query('DELETE FROM products WHERE id = ? AND user_id = ?', [productId, userId]);
    return res.status(200).json({ message: 'Product deleted successfully.' });
  } catch (err) {
    console.error('deleteProduct error:', err);
    return res.status(500).json({ error: 'Server error deleting product.' });
  }
};

// ─── Open Food Facts Integration ─────────────────────────────────────────────

const OPEN_FOOD_FACTS_USER_AGENT = 'ExpireReminderApp - Web - Version 1.0 - contact@expirereminder.local';

const guessCategoryAndLocation = (name = '', categories = '') => {
  const text = `${name} ${categories}`.toLowerCase();
  const MAP = {
    'Dairy': ['milk', 'cheese', 'dairy', 'yogurt', 'butter', 'cream', 'curd', 'paneer', 'lait', 'fromage', 'ghee'],
    'Vegetables': ['vegetable', 'greens', 'spinach', 'salad', 'carrot', 'tomato', 'potato', 'onion', 'cucumber', 'pepper', 'legume'],
    'Fruits': ['fruit', 'berry', 'apple', 'banana', 'strawberry', 'avocado', 'orange', 'lemon', 'grape', 'peach', 'mango'],
    'Bakery': ['bread', 'bakery', 'loaf', 'croissant', 'cake', 'cookie', 'flour', 'sourdough', 'toast', 'biscuit', 'cracker'],
    'Meat': ['meat', 'beef', 'chicken', 'pork', 'sausage', 'ham', 'turkey', 'fish', 'seafood', 'salmon', 'tuna', 'viande', 'poisson']
  };

  let cat = 'Other';
  let loc = 'Pantry';

  for (const [catName, keywords] of Object.entries(MAP)) {
    if (keywords.some(k => text.includes(k))) {
      cat = catName;
      loc = ['Dairy', 'Meat', 'Vegetables'].includes(catName) ? 'Fridge' : 'Pantry';
      break;
    }
  }

  return { category: cat, location: loc };
};

const getShelfLifeDays = (category) => {
  const map = {
    'Dairy': 7,
    'Bakery': 5,
    'Vegetables': 7,
    'Fruits': 10,
    'Meat': 3,
    'Other': 14
  };
  return map[category] || 7;
};

// In-Memory Performance Caches with TTL
const barcodeCache = new Map();
const searchCache = new Map();
const BARCODE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const SEARCH_TTL = 60 * 60 * 1000;       // 1 hour

// GET /api/products/openfoodfacts/barcode/:barcode
const lookupOpenFoodFactsBarcode = async (req, res) => {
  const { barcode } = req.params;
  if (!barcode) {
    return res.status(400).json({ error: 'Barcode is required.' });
  }

  const cleanCode = barcode.trim();

  // Instant cache hit check (<1ms)
  const cached = barcodeCache.get(cleanCode);
  if (cached && Date.now() - cached.timestamp < BARCODE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    // 1. Try Open Food Facts API v2
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanCode)}.json`;
    const response = await fetch(url, {
      headers: { 'User-Agent': OPEN_FOOD_FACTS_USER_AGENT }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const name = p.product_name || p.product_name_en || p.generic_name || '';
        const brand = p.brands || '';
        const fullName = brand && name ? `${brand} - ${name}` : (name || brand || `Product ${cleanCode}`);
        const categories = p.categories || '';
        const quantity = p.quantity || '1 unit';
        const imageUrl = p.image_front_url || p.image_url || p.image_front_small_url || '';
        
        const { category, location } = guessCategoryAndLocation(fullName, categories);
        const shelfLifeDays = getShelfLifeDays(category);

        const resultData = {
          found: true,
          barcode: cleanCode,
          name: fullName,
          rawName: name,
          brand,
          category,
          location,
          quantity,
          imageUrl,
          shelfLifeDays,
          ingredients: p.ingredients_text || '',
          nutritionScore: p.nutrition_grades || null
        };

        // Store in memory cache
        barcodeCache.set(cleanCode, { timestamp: Date.now(), data: resultData });

        return res.status(200).json(resultData);
      }
    }

    // 2. Fallback attempt to v0 if v2 didn't find
    const fallbackUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(cleanCode)}.json`;
    const fallbackRes = await fetch(fallbackUrl, {
      headers: { 'User-Agent': OPEN_FOOD_FACTS_USER_AGENT }
    });

    if (fallbackRes.ok) {
      const fbData = await fallbackRes.json();
      if (fbData.status === 1 && fbData.product) {
        const p = fbData.product;
        const name = p.product_name || p.product_name_en || p.generic_name || '';
        const brand = p.brands || '';
        const fullName = brand && name ? `${brand} - ${name}` : (name || brand || `Product ${cleanCode}`);
        const categories = p.categories || '';
        const quantity = p.quantity || '1 unit';
        const imageUrl = p.image_front_url || p.image_url || p.image_front_small_url || '';
        
        const { category, location } = guessCategoryAndLocation(fullName, categories);
        const shelfLifeDays = getShelfLifeDays(category);

        return res.status(200).json({
          found: true,
          barcode: cleanCode,
          name: fullName,
          rawName: name,
          brand,
          category,
          location,
          quantity,
          imageUrl,
          shelfLifeDays,
          ingredients: p.ingredients_text || ''
        });
      }
    }

    return res.status(404).json({
      found: false,
      error: 'Product not found in Open Food Facts database.',
      barcode: cleanCode
    });
  } catch (err) {
    console.error('lookupOpenFoodFactsBarcode error:', err);
    return res.status(500).json({ error: 'Failed to contact Open Food Facts service.' });
  }
};

// GET /api/products/openfoodfacts/search?q=...
const searchOpenFoodFacts = async (req, res) => {
  const { q = '', page = 1 } = req.query;
  if (!q.trim()) {
    return res.status(400).json({ error: 'Search query is required.' });
  }

  const searchKey = `${q.trim().toLowerCase()}_p${page}`;
  const cached = searchCache.get(searchKey);
  if (cached && Date.now() - cached.timestamp < SEARCH_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q.trim())}&search_simple=1&action=process&json=1&page=${page}&page_size=20`;
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': OPEN_FOOD_FACTS_USER_AGENT }
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to query Open Food Facts.' });
    }

    const data = await response.json();
    const rawProducts = data.products || [];
    
    const products = rawProducts
      .filter(p => p.code && (p.product_name || p.product_name_en || p.brands))
      .map(p => {
        const name = p.product_name || p.product_name_en || p.generic_name || '';
        const brand = p.brands || '';
        const fullName = brand && name ? `${brand} - ${name}` : (name || brand || `Product ${p.code}`);
        const categories = p.categories || '';
        const { category, location } = guessCategoryAndLocation(fullName, categories);

        return {
          barcode: p.code,
          name: fullName,
          brand,
          category,
          location,
          quantity: p.quantity || '1 unit',
          imageUrl: p.image_front_small_url || p.image_front_url || p.image_url || '',
          shelfLifeDays: getShelfLifeDays(category)
        };
      });

    const searchResult = {
      count: data.count || products.length,
      page: parseInt(page),
      products
    };

    searchCache.set(searchKey, { timestamp: Date.now(), data: searchResult });

    return res.status(200).json(searchResult);
  } catch (err) {
    console.error('searchOpenFoodFacts error:', err);
    return res.status(500).json({ error: 'Failed to search Open Food Facts.' });
  }
};

// GS1 Prefix Dictionary for Country and Code Type Resolution
const getGS1Country = (barcode) => {
  const digits = String(barcode).replace(/\D/g, '');
  if (digits.length < 3) return null;
  const p3 = parseInt(digits.slice(0, 3), 10);

  if (p3 >= 0 && p3 <= 19) return 'United States & Canada';
  if (p3 >= 30 && p3 <= 39) return 'United States (Drugs)';
  if (p3 >= 300 && p3 <= 379) return 'France';
  if (p3 >= 400 && p3 <= 440) return 'Germany';
  if (p3 >= 450 && p3 <= 459) return 'Japan';
  if (p3 >= 490 && p3 <= 499) return 'Japan';
  if (p3 >= 500 && p3 <= 509) return 'United Kingdom';
  if (p3 >= 520 && p3 <= 521) return 'Greece';
  if (p3 >= 590 && p3 <= 599) return 'Poland';
  if (p3 >= 690 && p3 <= 699) return 'China';
  if (p3 >= 730 && p3 <= 739) return 'Sweden';
  if (p3 >= 760 && p3 <= 769) return 'Switzerland';
  if (p3 >= 800 && p3 <= 839) return 'Italy';
  if (p3 >= 840 && p3 <= 849) return 'Spain';
  if (p3 >= 870 && p3 <= 879) return 'Netherlands';
  if (p3 === 880) return 'South Korea';
  if (p3 === 890) return 'India';
  if (p3 >= 900 && p3 <= 919) return 'Austria';
  if (p3 >= 930 && p3 <= 939) return 'Australia';
  if (p3 >= 940 && p3 <= 949) return 'New Zealand';
  return 'International GS1';
};

// POST /api/products/ai-identify
const identifyBarcodeWithAI = async (req, res) => {
  const { barcode, hint = '' } = req.body;
  const cleanCode = String(barcode || '').trim();

  if (!cleanCode) {
    return res.status(400).json({ error: 'Barcode is required.' });
  }

  // 1. Basic format validation
  const isNumeric = /^\d+$/.test(cleanCode);
  const length = cleanCode.length;
  const isValidFormat = (isNumeric && [8, 12, 13, 14].includes(length)) || cleanCode.length >= 4;
  const originCountry = getGS1Country(cleanCode);

  // 2. Check if GEMINI_API_KEY is available in environment
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are an AI grocery, supermarket inventory, and barcode assistant.
The user scanned a barcode: "${cleanCode}".
Optional user hint / food name: "${hint}".
Origin country indicated by GS1 prefix: "${originCountry || 'Unknown'}".

Determine:
1. Is this a real consumer or food product? (true/false)
2. Likely product name or brand
3. Category: Choose one of ["Dairy", "Vegetables", "Fruits", "Bakery", "Meat", "Other"]
4. Location: Choose one of ["Fridge", "Freezer", "Pantry", "Cabinet"]
5. Recommended shelf life in days (number)
6. Brief explanation for the user.

Respond ONLY with valid JSON with keys:
{
  "isProduct": true,
  "confidence": "high",
  "suggestedName": "Example Name",
  "brand": "Example Brand",
  "category": "Dairy",
  "location": "Fridge",
  "shelfLifeDays": 7,
  "explanation": "Brief reasoning"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      const responseText = response.text || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.status(200).json({
          success: true,
          barcode: cleanCode,
          originCountry,
          aiEngine: 'gemini-2.5-flash',
          ...parsed
        });
      }
    } catch (aiErr) {
      console.warn('Gemini AI call failed, falling back to heuristic AI engine:', aiErr.message);
    }
  }

  // 3. Fallback Heuristic AI Engine (works offline & without API key!)
  const { category, location } = guessCategoryAndLocation(hint, '');
  const shelfLifeDays = getShelfLifeDays(category);

  // If barcode doesn't look like any standard barcode format
  if (!isValidFormat || cleanCode.length < 5) {
    return res.status(200).json({
      success: true,
      barcode: cleanCode,
      isProduct: false,
      confidence: 'high',
      originCountry: null,
      suggestedName: '',
      brand: '',
      category: 'Other',
      location: 'Pantry',
      shelfLifeDays: 7,
      explanation: `Barcode "${cleanCode}" is too short or invalid to be a standard retail product barcode.`
    });
  }

  const suggestedName = hint.trim()
    ? hint.trim()
    : (originCountry ? `${originCountry} Product (${cleanCode})` : `Product ${cleanCode}`);

  return res.status(200).json({
    success: true,
    barcode: cleanCode,
    isProduct: true,
    confidence: hint.trim() ? 'medium' : 'low',
    originCountry,
    suggestedName,
    brand: '',
    category: hint.trim() ? category : 'Other',
    location: hint.trim() ? location : 'Pantry',
    shelfLifeDays,
    explanation: originCountry 
      ? `GS1 Barcode prefix indicates origin: ${originCountry}. Standard ${length}-digit format.`
      : `Format matches a standard retail barcode (${length} digits).`
  });
};

// GET /api/products/notifications
const getExpiringNotifications = async (req, res) => {
  const userId = req.user.id;
  try {
    // Fetch all products that have expired or will expire in the next 14 days
    const [products] = await db.query(
      `SELECT id, name, category, barcode, purchase_date, expiry_date, location, quantity, image_url
       FROM products
       WHERE user_id = ? AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)
       ORDER BY expiry_date ASC`,
      [userId]
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = products.map((p) => {
      const expDate = new Date(p.expiry_date);
      expDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      
      let urgency = 'normal'; // 'expired' | 'today' | 'critical' | 'soon'
      let urgencyLabel = '';
      if (diffDays < 0) {
        urgency = 'expired';
        urgencyLabel = `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`;
      } else if (diffDays === 0) {
        urgency = 'today';
        urgencyLabel = 'Expires Today!';
      } else if (diffDays === 1) {
        urgency = 'critical';
        urgencyLabel = 'Expires Tomorrow!';
      } else if (diffDays <= 3) {
        urgency = 'critical';
        urgencyLabel = `Expires in ${diffDays} days`;
      } else {
        urgency = 'soon';
        urgencyLabel = `Expires in ${diffDays} days`;
      }

      return {
        ...p,
        diffDays,
        urgency,
        urgencyLabel,
        location: p.location || 'Fridge'
      };
    });

    const summary = {
      totalAlerts: enriched.length,
      expiredCount: enriched.filter((i) => i.diffDays < 0).length,
      criticalCount: enriched.filter((i) => i.diffDays >= 0 && i.diffDays <= 2).length,
      upcomingCount: enriched.filter((i) => i.diffDays > 2).length
    };

    return res.status(200).json({
      notifications: enriched,
      summary
    });
  } catch (err) {
    console.error('getExpiringNotifications error:', err);
    return res.status(500).json({ error: 'Failed to fetch expiring notifications.' });
  }
};

module.exports = {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getExpiringNotifications,
  lookupOpenFoodFactsBarcode,
  searchOpenFoodFacts,
  identifyBarcodeWithAI
};


