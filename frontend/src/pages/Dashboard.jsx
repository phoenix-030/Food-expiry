import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { api } from '../services/api';
import '../styles/Dashboard.module.css';
import { 
  Plus, 
  TrendingUp, 
  Leaf, 
  Calendar, 
  Clock, 
  QrCode, 
  Package,
  AlertTriangle,
  X
} from 'lucide-react';
import { getProductImage } from '../utils/productImages';

const Dashboard = () => {
  const navigate = useNavigate();
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expiredAlert, setExpiredAlert] = useState(null);
  const notifiedExpiredIds = useRef(new Set());
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Vegetables');
  const [barcode, setBarcode] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [location, setLocation] = useState('Fridge');
  const [quantity, setQuantity] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Fetch Dashboard Stats
  const fetchStats = useCallback(async ({ showLoading = false } = {}) => {
    try {
      const data = await api.getDashboardStats();
      setStats(data);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Could not fetch dashboard metrics.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void fetchStats({ showLoading: true });
    }, 0);

    // Refresh the displayed savings while the dashboard is open and whenever
    // the user returns to this browser tab.
    const refresh = () => void fetchStats();
    const refreshInterval = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);

    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refresh);
    };
  }, [fetchStats]);

  useEffect(() => {
    const expiredItems = (stats?.criticalItems || []).filter(item => item.diffDays < 0);
    const newExpiredItem = expiredItems.find(item => !notifiedExpiredIds.current.has(item.id));

    if (!newExpiredItem) return;

    expiredItems.forEach(item => notifiedExpiredIds.current.add(item.id));
    setExpiredAlert(newExpiredItem);

    if ('vibrate' in navigator) {
      navigator.vibrate([250, 100, 250]);
    }
  }, [stats]);

  const handleOpenAddModal = (isScan = false) => {
    setIsModalOpen(true);
    // If scanning, simulate finding a barcode
    if (isScan) {
      setBarcode(Math.floor(100000000000 + Math.random() * 900000000000).toString());
      setName('Mock Scanned Product');
    } else {
      setBarcode('');
      setName('');
    }
    setCategory('Vegetables');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setExpiryDate('');
    setLocation('Fridge');
    setQuantity('');
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!name || !category || !purchaseDate || !expiryDate) return;

    setModalLoading(true);
    try {
      const resolvedImg = getProductImage(name, category);
      await api.addProduct({
        name,
        category,
        barcode,
        purchase_date: purchaseDate,
        expiry_date: expiryDate,
        location,
        quantity,
        image_url: resolvedImg
      });
      setIsModalOpen(false);
      void fetchStats(); // refresh dashboard immediately
    } catch (err) {
      alert(err.message || 'Error adding product');
    } finally {
      setModalLoading(false);
    }
  };

  // Get current week numbers & dates
  const today = new Date();
  const currentDay = today.getDay();
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + distanceToMonday);

  const getWeekDays = () => {
    const days = [];
    const dayNamesShort = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        name: dayNamesShort[d.getDay()],
        dayNum: d.getDate(),
        isToday: d.toDateString() === today.toDateString(),
        dayFullName: d.toLocaleDateString('en-US', { weekday: 'long' }),
        dateStr: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }
    return days;
  };

  const weekDays = getWeekDays();
  const [selectedDayIndex, setSelectedDayIndex] = useState(weekDays.findIndex(d => d.isToday) !== -1 ? weekDays.findIndex(d => d.isToday) : 2); // Default to Wed (14) or Today

  const currentSelectedDay = weekDays[selectedDayIndex];

  return (
    <div className="app-container">

      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="main-content">
        <Navbar placeholder="Search inventory..." />

        {expiredAlert && (
          <div className="expiry-alert" role="alert">
            <AlertTriangle size={22} />
            <div className="expiry-alert-content">
              <strong>Product expired</strong>
              <span>{expiredAlert.name} has expired.</span>
            </div>
            <button
              type="button"
              className="expiry-alert-close"
              onClick={() => setExpiredAlert(null)}
              aria-label="Close expired product alert"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="state-fill-center state-loading-text">
            Loading dashboard data...
          </div>
        ) : error ? (
          <div className="state-fill-center state-error-text">
            {error}
          </div>
        ) : (
          <div className="page-container">
            {/* Top metrics summary */}
            <div className="metrics-grid">
              <div className="metric-card card-total">
                <div className="metric-card-accent-border" />
                <div className="metric-icon-box">
                  <Package size={22} />
                </div>
                <div className="metric-info">
                  <span className="metric-val">{stats?.metrics?.totalProducts || 0}</span>
                  <span className="metric-label">Total Products</span>
                </div>
              </div>

              <div className="metric-card card-fresh">
                <div className="metric-card-accent-border" />
                <div className="metric-icon-box">
                  <Leaf size={22} />
                </div>
                <div className="metric-info">
                  <span className="metric-val">{stats?.metrics?.freshProducts || 0}</span>
                  <span className="metric-label">Fresh Products</span>
                </div>
              </div>

              <div className="metric-card card-soon">
                <div className="metric-card-accent-border" />
                <div className="metric-icon-box">
                  <Clock size={22} />
                </div>
                <div className="metric-info">
                  <span className="metric-val">{stats?.metrics?.expiringSoon || 0}</span>
                  <span className="metric-label">Expiring Soon</span>
                </div>
              </div>

              <div className="metric-card card-expired">
                <div className="metric-card-accent-border" />
                <div className="metric-icon-box">
                  <AlertTriangle size={22} />
                </div>
                <div className="metric-info">
                  <span className="metric-val">{stats?.metrics?.expired || 0}</span>
                  <span className="metric-label">Expired</span>
                </div>
              </div>
            </div>

            {/* Main Columns Grid */}
            <div className="dashboard-columns">
              
              {/* Left Column: Critical list, Sustainability stats, Recently scanned */}
              <div className="dashboard-column">
                
                {/* Critical Items */}
                <div className="card">
                  <div className="section-header">
                    <h4 className="section-title">Today's Critical Items</h4>
                    <span className="section-action-link" onClick={() => navigate('/products')}>View All</span>
                  </div>
                  <div className="critical-items-list">
                    {stats?.criticalItems && stats.criticalItems.length > 0 ? (
                      stats.criticalItems.map((item) => (
                        <div key={item.id} className="critical-item-row">
                          <div className="critical-item-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img
                              src={getProductImage(item.name, item.category, item.image_url)}
                              alt={item.name}
                              style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0', flexShrink: 0, background: '#fff' }}
                            />
                            <div className="text-left">
                              <div className="critical-name">{item.name}</div>
                              <div className="critical-meta">{item.location} • Expiry: {item.diffDays < 0 ? 'Expired' : `${item.diffDays} day${item.diffDays !== 1 ? 's' : ''}`}</div>
                            </div>
                          </div>
                          <span className={`critical-badge ${item.diffDays < 0 ? 'badge-err' : 'badge-warn'}`}>
                            {item.statusText}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="muted-empty-text">No critical items expiring soon.</div>
                    )}
                  </div>
                </div>

                {/* Sustainability and Budget Split Grid */}
                <div className="sustain-budget-grid">
                  
                  {/* Sustainability Impact */}
                  <div className="sustain-card">
                    <div className="sustain-header">
                      <Leaf size={18} className="sustain-header-icon" />
                      <span>Sustainability Impact</span>
                    </div>
                    <div className="section-spaced-top">
                      <div className="progress-label-row">
                        <span>Utilization Rate</span>
                        <span className="progress-rate-pct">{stats?.sustainability?.utilizationRate ?? 0}%</span>
                      </div>
                      <div className="progress-bar-bg">
                        <progress
                          className="progress-native progress-green"
                          max="100"
                          value={stats?.sustainability?.utilizationRate ?? 0}
                          aria-label="Utilization rate"
                        />
                      </div>
                      <p className="co2-text">
                        {stats?.sustainability?.co2SavedKg != null ? (
                          <>You've prevented <strong>{stats.sustainability.co2SavedKg}kg</strong> of CO2 equivalent emissions this month.</>
                        ) : (
                          'No sustainability data is available yet.'
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Budget Saved */}
                  <div className="budget-card">
                    <div className="budget-title">Budget Saved</div>
                    <div className="budget-amount budget-amount-offset">
                      {stats?.sustainability?.budgetSavedUsd != null
                        ? `₹${parseFloat(stats.sustainability.budgetSavedUsd).toFixed(2)}`
                        : '—'}
                      <span className="budget-amount-sub">/ month</span>
                    </div>
                    <div className="budget-trend">
                      {stats?.sustainability?.budgetSavedUsd != null ? (
                        <>
                          <TrendingUp size={16} />
                          <span>Value from database</span>
                        </>
                      ) : (
                        <span>No budget data available</span>
                      )}
                    </div>
                  </div>

                </div>

                {/* Recently Scanned */}
                <div className="card">
                  <div className="section-header">
                    <h4 className="section-title">Recently Scanned</h4>
                  </div>
                  <div className="scanned-list">
                    {stats?.recentlyScanned && stats.recentlyScanned.map((item) => (
                      <div key={item.id} className="scanned-item">
                        <div className="scanned-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={getProductImage(item.name, 'Other', null)}
                            alt={item.name}
                            style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0', flexShrink: 0, background: '#fff' }}
                          />
                          <span>{item.name}</span>
                        </div>
                        <span className="scanned-time">{item.timeAgo}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column: Weekly calendar list, Recipes, and Actions */}
              <div className="dashboard-column">
                
                {/* Weekly Expiry calendar view */}
                <div className="calendar-card">
                  <div className="calendar-header">
                    <span className="calendar-title">Weekly Expiry</span>
                    <Calendar size={18} className="icon-muted" />
                  </div>

                  {/* Day Picker */}
                  <div className="calendar-weeks-row">
                    {weekDays.map((day, idx) => (
                      <button
                        key={day.name}
                        className={`calendar-day-btn ${selectedDayIndex === idx ? 'selected' : ''} ${day.isToday ? 'is-today' : ''}`}
                        onClick={() => setSelectedDayIndex(idx)}
                      >
                        <span className="calendar-day-name">{day.name}</span>
                        <span className="calendar-day-number">{day.dayNum}</span>
                      </button>
                    ))}
                  </div>

                  {/* Expirations details */}
                  <div className="schedule-details-area">
                    <div className="schedule-title">
                      Scheduled for {currentSelectedDay.name} {currentSelectedDay.dateStr}
                    </div>

                    <div className="schedule-list">
                      {stats?.weeklyExpiry && stats.weeklyExpiry[currentSelectedDay.dayFullName] && stats.weeklyExpiry[currentSelectedDay.dayFullName].length > 0 ? (
                        stats.weeklyExpiry[currentSelectedDay.dayFullName].map((item, idx) => (
                          <div key={idx} className="schedule-row">
                            <div className="schedule-bullet" />
                            <span>{item}</span>
                          </div>
                        ))
                      ) : (
                        <div className="schedule-empty">No items expiring this day.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live inventory actions */}
                <div className="dashboard-actions-card">
                  <div className="dashboard-actions-heading">
                    <div>
                      <h4>Inventory Actions</h4>
                      <p>Keep your pantry up to date.</p>
                    </div>
                    <Package size={22} />
                  </div>
                  <div className="dashboard-actions-summary">
                    <span>{stats?.metrics?.totalProducts || 0} products tracked</span>
                    <span className="dashboard-actions-warning">
                      {stats?.metrics?.expiringSoon || 0} expiring soon
                    </span>
                  </div>
                  <div className="dashboard-actions-buttons">
                    <button type="button" className="dashboard-action-button" onClick={() => navigate('/products')}>
                      <Package size={17} />
                      <span>View Products</span>
                    </button>
                    <button type="button" className="dashboard-action-button" onClick={() => navigate('/notifications')}>
                      <AlertTriangle size={17} />
                      <span>View Alerts</span>
                    </button>
                    <button type="button" className="dashboard-action-button dashboard-action-button-primary" onClick={() => navigate('/scanner')}>
                      <QrCode size={17} />
                      <span>Scan Product</span>
                    </button>
                  </div>
                </div>

                {/* Mini Buttons Actions */}
                <div className="quick-action-row">
                  <button className="quick-action-btn" onClick={() => handleOpenAddModal(false)}>
                    <Plus size={16} />
                    <span>Add Item</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => navigate('/scanner')}>
                    <QrCode size={16} />
                    <span>Quick Scan</span>
                  </button>
                </div>

              </div>

            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button (FAB) */}
      <button className="fab-btn" onClick={() => handleOpenAddModal(false)} aria-label="Add new product">
        <Plus size={28} />
      </button>

      {/* Add Product Modal Overlay */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header-row">
              <h3 className="modal-title">Add New Product</h3>
              <button onClick={() => setIsModalOpen(false)} className="icon-button-plain">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddProduct}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Organic Baby Spinach"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="two-column-grid">
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select
                      className="form-input"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="Vegetables">Vegetables</option>
                      <option value="Dairy">Dairy</option>
                      <option value="Fruits">Fruits</option>
                      <option value="Bakery">Bakery</option>
                      <option value="Meat">Meat</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Barcode</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 842100452391"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                    />
                  </div>
                </div>

                <div className="two-column-grid">
                  <div className="form-group">
                    <label className="form-label">Purchase Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Expiry Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="two-column-grid">
                  <div className="form-group">
                    <label className="form-label">Storage Location</label>
                    <select
                      className="form-input"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    >
                      <option value="Fridge">Fridge</option>
                      <option value="Freezer">Freezer</option>
                      <option value="Pantry">Pantry</option>
                      <option value="Cabinet">Cabinet</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantity / Volume</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 500g Pack"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
