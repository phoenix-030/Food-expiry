# Expire Reminder

Expire Reminder is a full-stack inventory and expiry tracking application designed for households and small businesses. It helps users store grocery and household items, track expiry dates, scan product barcodes, monitor expiring inventory, and get quick product insights through Open Food Facts and AI-assisted product recognition.

## Project Overview

This project combines:

- A React + Vite frontend for the user interface
- An Express.js backend for authentication, inventory APIs, dashboard analytics, and barcode lookup services
- A MySQL database for user and product data
- Barcode scanning support using HTML5 QR code libraries
- Open Food Facts integration for product recognition and database lookup
- AI-assisted product identification fallback for unknown items

The goal is to reduce food waste by alerting users before products expire and making product intake faster through scanning.

---

## Main Features

- User registration and login with secure session cookies
- Protected routes for authenticated users only
- Inventory management for products with category, expiry date, location, quantity, and image
- Barcode scanning from live camera or uploaded product image
- Product lookup via Open Food Facts database
- AI-assisted identification for unrecognized barcode items
- Dashboard summaries with expiry metrics and sustainability indicators
- Expiring item alerts and recent activity tracking
- Multi-page dashboard UI with theme and language support

---

## Tech Stack

### Frontend
- React 19
- Vite
- React Router DOM
- HTML5 QR Code
- Lucide React
- CSS Modules / custom stylesheet architecture

### Backend
- Node.js
- Express.js
- MySQL2
- bcryptjs
- cookie-parser
- cors
- dotenv
- compression

### Database
- MySQL

### External Integrations
- Open Food Facts API
- AI-based product identification endpoint (backend-supported fallback logic)

---

## Application Architecture

The project is split into two main parts:

1. Frontend application
   - Handles UI, routing, authentication state, barcode scanning, inventory actions, and dashboard views.

2. Backend API
   - Manages authentication, database access, inventory operations, security middleware, and Open Food Facts/AI lookup endpoints.

The frontend talks to the backend through REST APIs with credentials enabled for secure session cookies.

---

## Folder Structure

```text
expire_reminder/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── dashboardController.js
│   │   └── productController.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── dashboardRoutes.js
│   │   └── productRoutes.js
│   ├── utils/
│   │   └── sessionStore.js
│   ├── package.json
│   ├── requirements.txt
│   ├── schema.sql
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── styles/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
├── pyrightconfig.json
└── README.md
```

---

## Database Design

The backend uses MySQL, with schema definitions in [backend/schema.sql](backend/schema.sql).

### Core tables

- users
  - Stores account information and session ownership
- user_sessions
  - Stores server-side authentication tokens and expiry timestamps
- products
  - Stores product inventory records with category, barcode, dates, quantity, and image URL
- scanned_history
  - Stores recently scanned item names for dashboard activity
- sustainability_stats
  - Tracks monthly utilization rate, CO2 saved, and budget saved metrics

### Example schema details

```sql
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
  image_url TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## Backend API Overview

The backend server is started from [backend/server.js](backend/server.js).

### Base URL

```text
http://localhost:5000/api
```

### Auth routes

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- PUT /api/auth/profile

### Product routes

- GET /api/products
- POST /api/products
- PUT /api/products/:id
- DELETE /api/products/:id
- GET /api/products/notifications
- GET /api/products/openfoodfacts/barcode/:barcode
- GET /api/products/openfoodfacts/search
- POST /api/products/ai-identify

### Dashboard routes

- GET /api/dashboard/stats

### Notes

- Protected routes require a valid session cookie.
- Product and dashboard routes are protected by authentication middleware.
- Open Food Facts and AI endpoints are exposed to support lookup and product recognition.

---

## Frontend Overview

The frontend is built in [frontend/src/App.jsx](frontend/src/App.jsx) and includes routing to the following screens:

- Login
- Register
- Dashboard
- Scanner
- Products
- Notifications
- Analytics
- Settings
- History

The app uses:

- Context providers for auth, theme, and language
- Route guards to redirect unauthenticated users
- Lazy loading for page-level code splitting
- A centralized API service in [frontend/src/services/api.js](frontend/src/services/api.js)

---

## Scanner Functionality

The scanner page in [frontend/src/pages/Scanner.jsx](frontend/src/pages/Scanner.jsx) supports:

- Live barcode scanning using camera and Html5Qrcode
- Image upload for barcode decoding
- Manual barcode entry
- Session-based scanned item summaries
- Open Food Facts database search integration
- AI-assisted product identification when no match is found
- Save-to-inventory workflow with name, category, expiry, location, and quantity

This is the main operational flow of the application: scan → detect product → verify → save → track expiry.

---

## Authentication Flow

Authentication uses session cookies rather than localStorage tokens for the session itself.

- The server creates a secure session token and stores it in MySQL.
- The cookie is sent to the browser with credentials enabled.
- Frontend stores only lightweight user profile data in localStorage for UI state.
- Protected routes validate the user on page load through /api/auth/me.

This pattern helps keep user sessions secure and reduces direct token exposure in the browser.

---

## Environment Configuration

### Backend environment variables

Create a .env file inside the [backend](backend) directory with values similar to:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=expire_reminder
PORT=5000
```

### Frontend environment variables

The frontend uses `VITE_API_BASE_URL` when available. Example:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

If not set, it defaults to:

```text
http://localhost:5000/api
```

---

## Setup and Run Instructions

### 1. Install MySQL

Make sure MySQL is installed and running locally.

### 2. Create the database

Run the SQL in [backend/schema.sql](backend/schema.sql) in MySQL.

Example:

```bash
mysql -u root -p < backend/schema.sql
```

### 3. Install backend dependencies

```bash
cd backend
npm install
```

### 4. Start the backend

```bash
npm run dev
```

The backend runs by default on:

```text
http://localhost:5000
```

### 5. Install frontend dependencies

```bash
cd frontend
npm install
```

### 6. Start the frontend

```bash
npm run dev
```

The frontend usually runs on:

```text
http://localhost:5173
```

---

## Typical User Workflow

1. Register or log in
2. Add products manually or scan a barcode
3. Review product details and expiry date prediction
4. Save the product into the inventory
5. Watch the dashboard for expiring items and recent activity
6. Use notifications and analytics to reduce waste and manage stock better

---

## Security and Production Notes

This project is a working prototype and includes several practical app patterns:

- HTTP-only session cookies for authentication
- Route protection for sensitive pages
- Input validation in backend controllers
- CORS configured for local frontend origins
- Server-side session cleanup on logout
- Database auto-migration for image_url if missing

For production deployment, it would be wise to add:

- stronger JWT/session secret handling
- rate limiting
- environment-based CORS restrictions
- HTTPS enforcement
- validation and sanitization improvements
- deployment config for MySQL and frontend hosting

---

## Possible Future Enhancements

- Email or push notifications for soon-to-expire products
- Product editing from a richer inventory UI
- Search filters by category and expiration status
- Recurring reminder schedule and smart stock suggestions
- Reporting and export features
- Improved AI integration with external LLM/provider services
- Better recipe recommendation based on expiring inventory

---

## Summary

Expire Reminder is an inventory management and expiry tracking app focused on reducing waste and helping users stay organized. It blends scanning, product lookup, AI assistance, and real-time inventory management into one system.

If you are building on this project, the most important files to understand first are:

- [backend/server.js](backend/server.js)
- [backend/routes/productRoutes.js](backend/routes/productRoutes.js)
- [backend/controllers/productController.js](backend/controllers/productController.js)
- [backend/schema.sql](backend/schema.sql)
- [frontend/src/App.jsx](frontend/src/App.jsx)
- [frontend/src/pages/Scanner.jsx](frontend/src/pages/Scanner.jsx)
- [frontend/src/services/api.js](frontend/src/services/api.js)

---

This project documentation is intended to help developers and contributors understand the architecture, setup flow, and core functionality of Expire Reminder.
