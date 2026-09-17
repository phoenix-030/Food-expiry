const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Fetch calls include credentials so the browser sends and receives the
 * httpOnly session cookie. localStorage only stores profile data for instant UI.
 */

const jsonHeaders = { 'Content-Type': 'application/json' };

// ─── Auth ────────────────────────────────────────────────────────────────────

export const api = {

  // POST /api/auth/register
  register: async (name, email, password, role) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: jsonHeaders,
      credentials: 'include',          // receive httpOnly cookie
      body: JSON.stringify({ name, email, password, role })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed.');
    // Store user profile in localStorage for instant display
    localStorage.setItem('freshtrack_user', JSON.stringify(data.user));
    return data; // { message, user }
  },

  // POST /api/auth/login
  login: async (email, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: jsonHeaders,
      credentials: 'include',          // receive httpOnly cookie
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid email or password.');
    // Store user profile in localStorage for instant display
    localStorage.setItem('freshtrack_user', JSON.stringify(data.user));
    return data; // { message, user }
  },

  // POST /api/auth/logout  →  server clears cookie
  logout: async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch { /* ignore network errors on logout */ }
    localStorage.removeItem('freshtrack_user');
  },

  // GET /api/auth/me  →  validate cookie on page refresh
  getCurrentUser: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include'         // send httpOnly cookie automatically
      });
      if (!res.ok) return null;
      const data = await res.json();
      // Keep localStorage in sync
      localStorage.setItem('freshtrack_user', JSON.stringify(data.user));
      return data.user;
    } catch {
      return null;
    }
  },

  // PUT /api/auth/profile
  updateProfile: async ({ name, email, avatar_url }) => {
    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: jsonHeaders,
      credentials: 'include',
      body: JSON.stringify({ name, email, avatar_url })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update profile.');
    localStorage.setItem('freshtrack_user', JSON.stringify(data.user));
    return data.user;
  },

  // ─── Products ──────────────────────────────────────────────────────────────

  // GET /api/products?category=&search=&page=1&limit=10
  getProducts: async ({ category, search, page = 1, limit = 10 } = {}) => {
    const q = new URLSearchParams({ page, limit });
    if (category) q.append('category', category);
    if (search)   q.append('search', search);

    const res = await fetch(`${API_BASE_URL}/products?${q}`, {
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch products.');
    return data; // { products, pagination }
  },

  // POST /api/products
  addProduct: async (productData) => {
    const res = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: jsonHeaders,
      credentials: 'include',
      body: JSON.stringify(productData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add product.');
    return data; // { message, product }
  },

  // PUT /api/products/:id
  updateProduct: async (id, productData) => {
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      credentials: 'include',
      body: JSON.stringify(productData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update product.');
    return data;
  },

  // DELETE /api/products/:id
  deleteProduct: async (id) => {
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete product.');
    return data;
  },

  // GET /api/products/notifications
  getNotifications: async () => {
    const res = await fetch(`${API_BASE_URL}/products/notifications`, {
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch notifications.');
    return data; // { notifications, summary }
  },

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  // GET /api/dashboard/stats
  getDashboardStats: async () => {
    const res = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch dashboard stats.');
    return data;
  },

  // ─── Open Food Facts ───────────────────────────────────────────────────────

  // Lookup barcode with backend proxy and automatic direct client fallback
  lookupBarcode: async (barcode) => {
    const cleanCode = String(barcode).trim();
    if (!cleanCode) throw new Error('Invalid barcode');

    // 1. Try backend proxy
    try {
      const res = await fetch(`${API_BASE_URL}/products/openfoodfacts/barcode/${encodeURIComponent(cleanCode)}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.found) return data;
      }
    } catch {
      // Backend request failed, fallback to client fetch
    }

    // 2. Direct fallback to Open Food Facts API v2
    try {
      const directUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanCode)}.json`;
      const res = await fetch(directUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 1 && data.product) {
          const p = data.product;
          const name = p.product_name || p.product_name_en || p.generic_name || '';
          const brand = p.brands || '';
          const fullName = brand && name ? `${brand} - ${name}` : (name || brand || `Product ${cleanCode}`);
          const categories = p.categories || '';
          const quantity = p.quantity || '1 unit';
          const imageUrl = p.image_front_url || p.image_url || p.image_front_small_url || '';

          // Simple category guess
          const text = `${fullName} ${categories}`.toLowerCase();
          let category = 'Other';
          let location = 'Pantry';

          const MAP = {
            Dairy: ['milk', 'cheese', 'dairy', 'yogurt', 'butter', 'cream', 'curd', 'ghee'],
            Vegetables: ['vegetable', 'greens', 'spinach', 'salad', 'carrot', 'tomato', 'potato', 'onion'],
            Fruits: ['fruit', 'berry', 'apple', 'banana', 'strawberry', 'orange', 'lemon', 'grape', 'mango'],
            Bakery: ['bread', 'bakery', 'loaf', 'croissant', 'cake', 'cookie', 'flour', 'biscuit', 'toast'],
            Meat: ['meat', 'beef', 'chicken', 'pork', 'sausage', 'ham', 'turkey', 'fish', 'seafood']
          };

          for (const [catName, keywords] of Object.entries(MAP)) {
            if (keywords.some((k) => text.includes(k))) {
              category = catName;
              location = ['Dairy', 'Meat', 'Vegetables'].includes(catName) ? 'Fridge' : 'Pantry';
              break;
            }
          }

          const shelfMap = { Dairy: 7, Bakery: 5, Vegetables: 7, Fruits: 10, Meat: 3, Other: 14 };
          const shelfLifeDays = shelfMap[category] || 7;

          return {
            found: true,
            barcode: cleanCode,
            name: fullName,
            brand,
            category,
            location,
            quantity,
            imageUrl,
            shelfLifeDays
          };
        }
      }
    } catch {
      // Direct call also failed
    }

    return {
      found: false,
      barcode: cleanCode,
      name: `Scanned Product ${cleanCode}`,
      category: 'Other',
      location: 'Pantry',
      quantity: '1 unit',
      shelfLifeDays: 7
    };
  },

  // Search Open Food Facts catalog
  searchOpenFoodFacts: async (query, page = 1) => {
    if (!query || !query.trim()) return { products: [], count: 0 };
    try {
      const res = await fetch(`${API_BASE_URL}/products/openfoodfacts/search?q=${encodeURIComponent(query.trim())}&page=${page}`, {
        credentials: 'include'
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to client query
    }

    try {
      const directUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query.trim())}&search_simple=1&action=process&json=1&page=${page}&page_size=20`;
      const res = await fetch(directUrl);
      if (res.ok) {
        const data = await res.json();
        const products = (data.products || [])
          .filter((p) => p.code && (p.product_name || p.product_name_en || p.brands))
          .map((p) => {
            const name = p.product_name || p.product_name_en || '';
            const brand = p.brands || '';
            return {
              barcode: p.code,
              name: brand && name ? `${brand} - ${name}` : (name || brand || `Product ${p.code}`),
              brand,
              category: 'Other',
              location: 'Pantry',
              quantity: p.quantity || '1 unit',
              imageUrl: p.image_front_small_url || p.image_front_url || '',
              shelfLifeDays: 7
            };
          });
        return { products, count: data.count || products.length };
      }
    } catch {
      // Ignore
    }

    return { products: [], count: 0 };
  },

  // ─── AI Barcode & Product Intelligence ─────────────────────────────────────

  // Identify barcode or product details with AI
  identifyBarcodeWithAI: async (barcode, hint = '') => {
    const cleanCode = String(barcode || '').trim();
    try {
      const res = await fetch(`${API_BASE_URL}/products/ai-identify`, {
        method: 'POST',
        headers: jsonHeaders,
        credentials: 'include',
        body: JSON.stringify({ barcode: cleanCode, hint })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Backend error
    }

    // Client-side fallback heuristics
    return {
      success: true,
      barcode: cleanCode,
      isProduct: cleanCode.length >= 6,
      confidence: 'low',
      suggestedName: hint ? hint : `Product ${cleanCode}`,
      category: 'Other',
      location: 'Pantry',
      shelfLifeDays: 7,
      explanation: 'Scanned code identified using offline heuristics.'
    };
  }
};
