import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  BellRing, 
  Clock, 
  PackageCheck, 
  MapPin, 
  Check, 
  Calendar, 
  ExternalLink,
  Flame,
  Snowflake,
  Box,
  Trash2,
  Filter
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { getProductImage } from '../utils/productImages';
import '../styles/notifications.css';

const Notifications = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    totalAlerts: 0,
    expiredCount: 0,
    criticalCount: 0,
    upcomingCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter state
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'expired' | 'critical' | 'soon'
  const [selectedLocation, setSelectedLocation] = useState('all'); // 'all' | location string
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  const notifiedIds = useRef(new Set());

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      const notifList = data.notifications || [];
      
      const hasNewExpired = notifList.some(
        (item) => item.diffDays < 0 && !notifiedIds.current.has(item.id)
      );
      notifList.forEach((item) => notifiedIds.current.add(item.id));

      setItems(notifList);
      if (data.summary) {
        setSummary(data.summary);
      }
      setError('');

      if (hasNewExpired && 'vibrate' in navigator) {
        navigator.vibrate([250, 100, 250]);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError(err.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    void loadNotifications();
    const interval = window.setInterval(loadNotifications, 30000);
    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, []);

  // Quick action: Consume / Used up
  const handleConsumeItem = async (product) => {
    const confirmMsg = `Mark "${product.name}" as consumed/used? This will remove it from your active inventory.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.deleteProduct(product.id);
      setActionSuccessMsg(`"${product.name}" marked as consumed!`);
      setTimeout(() => setActionSuccessMsg(''), 3500);
      
      // Update local state immediately
      setItems((prev) => prev.filter((p) => p.id !== product.id));
      setSummary((prev) => ({
        ...prev,
        totalAlerts: Math.max(0, prev.totalAlerts - 1),
        expiredCount: product.diffDays < 0 ? Math.max(0, prev.expiredCount - 1) : prev.expiredCount,
        criticalCount: product.diffDays >= 0 && product.diffDays <= 2 ? Math.max(0, prev.criticalCount - 1) : prev.criticalCount,
        upcomingCount: product.diffDays > 2 ? Math.max(0, prev.upcomingCount - 1) : prev.upcomingCount
      }));
    } catch (err) {
      alert('Error updating inventory: ' + (err.message || 'Server error'));
    }
  };

  // Helper for location badge styling & icon
  const getLocationInfo = (loc) => {
    const clean = String(loc || '').toLowerCase();
    if (clean.includes('fridge') || clean.includes('refrigerator')) {
      return { className: 'fridge', icon: <Snowflake size={14} />, label: loc || 'Fridge' };
    }
    if (clean.includes('freezer')) {
      return { className: 'freezer', icon: <Snowflake size={14} />, label: loc || 'Freezer' };
    }
    if (clean.includes('pantry') || clean.includes('cupboard')) {
      return { className: 'pantry', icon: <Box size={14} />, label: loc || 'Pantry' };
    }
    if (clean.includes('counter') || clean.includes('shelf') || clean.includes('table')) {
      return { className: 'counter', icon: <MapPin size={14} />, label: loc || 'Kitchen Counter' };
    }
    return { className: 'fridge', icon: <MapPin size={14} />, label: loc || 'Fridge' };
  };

  // Available locations for filter dropdown
  const uniqueLocations = useMemo(() => {
    const set = new Set();
    items.forEach((p) => {
      if (p.location) set.add(p.location);
    });
    return Array.from(set);
  }, [items]);

  // Filtered notification list
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Tab filter
      if (activeTab === 'expired' && item.diffDays >= 0) return false;
      if (activeTab === 'critical' && (item.diffDays < 0 || item.diffDays > 2)) return false;
      if (activeTab === 'soon' && item.diffDays <= 2) return false;

      // Location filter
      if (selectedLocation !== 'all' && item.location !== selectedLocation) {
        return false;
      }

      return true;
    });
  }, [items, activeTab, selectedLocation]);

  const formatDate = (dStr) => {
    if (!dStr) return 'N/A';
    try {
      const d = new Date(String(dStr).slice(0, 10) + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return String(dStr);
    }
  };

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Navbar placeholder="Search inventory..." />
        
        <div className="page-container notifications-page-container">
          
          {/* Header & Stats Overview */}
          <div className="card notifications-header-card">
            <div className="notifications-top-bar">
              <div className="notifications-title-area">
                <div className="notifications-title-icon">
                  <BellRing size={26} />
                </div>
                <div>
                  <h2 className="panel-heading" style={{ margin: 0, fontSize: '24px' }}>
                    {t('notifications')}
                  </h2>
                  <p className="panel-copy" style={{ margin: '4px 0 0 0' }}>
                    Real-time product expiry alerts, storage locations, and quick actions
                  </p>
                </div>
              </div>

              {actionSuccessMsg && (
                <div style={{ background: '#dcfce7', color: '#15803d', padding: '6px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={16} />
                  <span>{actionSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Notification Statistics Summary Bar */}
            <div className="notifications-stats-grid">
              <div className="notif-stat-card">
                <div className="notif-stat-icon-wrap total">
                  <BellRing size={20} />
                </div>
                <div>
                  <div className="notif-stat-val">{summary.totalAlerts}</div>
                  <div className="notif-stat-lbl">Action Required</div>
                </div>
              </div>

              <div className="notif-stat-card">
                <div className="notif-stat-icon-wrap expired">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <div className="notif-stat-val">{summary.expiredCount}</div>
                  <div className="notif-stat-lbl">Already Expired</div>
                </div>
              </div>

              <div className="notif-stat-card">
                <div className="notif-stat-icon-wrap critical">
                  <Flame size={20} />
                </div>
                <div>
                  <div className="notif-stat-val">{summary.criticalCount}</div>
                  <div className="notif-stat-lbl">Expiring in 48h</div>
                </div>
              </div>

              <div className="notif-stat-card">
                <div className="notif-stat-icon-wrap upcoming">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="notif-stat-val">{summary.upcomingCount}</div>
                  <div className="notif-stat-lbl">Expiring This Week</div>
                </div>
              </div>
            </div>

            {/* Filter Tabs & Location Dropdown */}
            <div className="notifications-filter-row">
              <div className="notif-tabs">
                <button
                  type="button"
                  className={`notif-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  <span>All Alerts</span>
                  <span className="notif-tab-badge">{items.length}</span>
                </button>

                <button
                  type="button"
                  className={`notif-tab-btn ${activeTab === 'expired' ? 'active' : ''}`}
                  onClick={() => setActiveTab('expired')}
                >
                  <AlertTriangle size={14} style={{ color: activeTab === 'expired' ? '#fff' : '#dc2626' }} />
                  <span>Expired</span>
                  <span className="notif-tab-badge">{summary.expiredCount}</span>
                </button>

                <button
                  type="button"
                  className={`notif-tab-btn ${activeTab === 'critical' ? 'active' : ''}`}
                  onClick={() => setActiveTab('critical')}
                >
                  <Flame size={14} style={{ color: activeTab === 'critical' ? '#fff' : '#ea580c' }} />
                  <span>Next 48 Hours</span>
                  <span className="notif-tab-badge">{summary.criticalCount}</span>
                </button>

                <button
                  type="button"
                  className={`notif-tab-btn ${activeTab === 'soon' ? 'active' : ''}`}
                  onClick={() => setActiveTab('soon')}
                >
                  <Clock size={14} style={{ color: activeTab === 'soon' ? '#fff' : '#16a34a' }} />
                  <span>This Week</span>
                  <span className="notif-tab-badge">{summary.upcomingCount}</span>
                </button>
              </div>

              {/* Filter by Storage Location */}
              {uniqueLocations.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Filter size={14} style={{ color: '#64748b' }} />
                  <select
                    className="notif-location-select"
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    aria-label="Filter by storage location"
                  >
                    <option value="all">All Storage Locations</option>
                    {uniqueLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        📍 {loc}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="notif-empty-state">
              <Clock size={36} className="spinner-anim" style={{ margin: '0 auto 12px auto', display: 'block', color: '#066e38' }} />
              <p className="notif-empty-title">Loading product expiry alerts...</p>
            </div>
          ) : error ? (
            <div className="notifications-error">{error}</div>
          ) : filteredItems.length === 0 ? (
            <div className="notif-empty-state">
              <div className="notif-empty-icon">
                <PackageCheck size={32} />
              </div>
              <h3 className="notif-empty-title">{t('allCaughtUp')}</h3>
              <p className="notif-empty-subtitle">
                {activeTab === 'all'
                  ? 'None of your inventory products are currently expired or expiring within the next 14 days.'
                  : `No products matching the "${activeTab}" filter.`}
              </p>
            </div>
          ) : (
            <div className="notifications-cards-list">
              {filteredItems.map((item) => {
                const isExpired = item.diffDays < 0;
                const isToday = item.diffDays === 0;
                const isCritical = item.diffDays >= 1 && item.diffDays <= 2;
                const urgencyClass = isExpired ? 'expired' : isToday ? 'today' : isCritical ? 'critical' : 'soon';
                const locInfo = getLocationInfo(item.location);

                return (
                  <div key={item.id} className={`notif-product-card ${urgencyClass}`}>
                    
                    {/* High-res Product Photo */}
                    <div className="notif-thumb-wrap">
                      <img
                        src={getProductImage(item.name, item.category, item.image_url)}
                        alt={item.name}
                        className="notif-thumb-img"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getProductImage(item.name, item.category);
                        }}
                      />
                    </div>

                    {/* Core Product Information */}
                    <div className="notif-content-wrap">
                      <div className="notif-top-row">
                        <h4 className="notif-item-title">
                          <span>{item.name}</span>
                          {item.quantity && (
                            <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>
                              ({item.quantity})
                            </span>
                          )}
                        </h4>

                        {/* Expiry Status Badge */}
                        <div className={`notif-urgency-badge ${urgencyClass}`}>
                          {isExpired ? (
                            <AlertTriangle size={13} />
                          ) : isToday ? (
                            <Flame size={13} />
                          ) : (
                            <Clock size={13} />
                          )}
                          <span>{item.urgencyLabel || (isExpired ? 'Expired' : `Expires in ${item.diffDays}d`)}</span>
                        </div>
                      </div>

                      {/* Prominent Storage Location Badge */}
                      <div>
                        <span className={`notif-location-badge ${locInfo.className}`}>
                          {locInfo.icon}
                          <span>Stored in: <strong>{locInfo.label}</strong></span>
                        </span>
                      </div>

                      {/* Meta Tags & Details */}
                      <div className="notif-meta-row">
                        <span className="notif-pill">
                          Category: <strong>{item.category || 'Other'}</strong>
                        </span>
                        
                        {item.barcode ? (
                          <span className="notif-pill barcode">
                            Barcode: #{item.barcode}
                          </span>
                        ) : (
                          <span className="notif-pill">
                            Direct Item
                          </span>
                        )}

                        <div className="notif-dates-info">
                          <span className="notif-date-item">
                            <Calendar size={13} style={{ color: '#94a3b8' }} />
                            <span>Expiry: <strong>{formatDate(item.expiry_date)}</strong></span>
                          </span>

                          {item.purchase_date && (
                            <span className="notif-date-item">
                              <span>Purchased: <strong>{formatDate(item.purchase_date)}</strong></span>
                            </span>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Action Buttons */}
                    <div className="notif-actions-wrap">
                      <button
                        type="button"
                        className="notif-btn-consume"
                        onClick={() => void handleConsumeItem(item)}
                        title="Mark as consumed and remove from inventory"
                      >
                        <Check size={14} />
                        <span>Consumed</span>
                      </button>

                      <button
                        type="button"
                        className="notif-btn-view"
                        onClick={() => navigate(`/products?search=${encodeURIComponent(item.name)}`)}
                        title="View item in Products table"
                      >
                        <ExternalLink size={13} />
                        <span>View Item</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default Notifications;
