import { useEffect, useMemo, useState } from 'react';
import { History as HistoryIcon, Search, CalendarDays } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { api } from '../services/api';
import '../styles/history.css';
import { getProductImage } from '../utils/productImages';

const getToday = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDate = (date) => String(date || '').slice(0, 10);

const getStatus = (expiryDate) => {
  const today = new Date(`${getToday()}T00:00:00`);
  const expiry = new Date(`${normalizeDate(expiryDate)}T00:00:00`);
  const days = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

  if (days < 0) return { key: 'expired', label: 'Expired', className: 'history-status-expired' };
  if (days <= 7) return { key: 'expiring', label: days === 0 ? 'Expires Today' : `Expires in ${days} day${days === 1 ? '' : 's'}`, className: 'history-status-expiring' };
  return { key: 'fresh', label: 'Fresh', className: 'history-status-fresh' };
};

const History = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadHistory = async () => {
      try {
        setLoading(true);
        const data = await api.getProducts({ page: 1, limit: 1000 });
        if (!ignore) {
          setProducts(data.products || []);
          setError('');
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Could not load product history.');
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    void loadHistory();
    return () => {
      ignore = true;
    };
  }, []);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const normalizedSearch = search.trim().toLowerCase();
    const matchesSearch = !normalizedSearch
      || product.name.toLowerCase().includes(normalizedSearch)
      || (product.barcode || '').toLowerCase().includes(normalizedSearch);
    const matchesCategory = !category || product.category === category;
    const productStatus = getStatus(product.expiry_date);
    const matchesStatus = status === 'all' || productStatus.key === status;
    const expiryDate = normalizeDate(product.expiry_date);
    const matchesFromDate = !fromDate || expiryDate >= fromDate;
    const matchesToDate = !toDate || expiryDate <= toDate;
    return matchesSearch && matchesCategory && matchesStatus && matchesFromDate && matchesToDate;
  }), [products, search, category, status, fromDate, toDate]);

  const expiredCount = products.filter((product) => getStatus(product.expiry_date).key === 'expired').length;
  const expiringCount = products.filter((product) => getStatus(product.expiry_date).key === 'expiring').length;

  const formatDate = (date) => new Date(`${normalizeDate(date)}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setStatus('all');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Navbar placeholder="Search history..." searchValue={search} onSearchChange={setSearch} />
        <div className="page-container">
          <div className="history-heading-row">
            <div>
              <h2 className="products-main-title">Product History</h2>
              <p className="products-main-subtitle">Review every saved product and its expiry details.</p>
            </div>
            <HistoryIcon size={28} className="history-heading-icon" />
          </div>

          <div className="history-metrics-row">
            <div className="prod-metric-card"><div className="prod-metric-accent accent-total" /><div className="prod-metric-info"><span className="prod-metric-val">{products.length}</span><span className="prod-metric-label">All Products</span></div></div>
            <div className="prod-metric-card"><div className="prod-metric-accent accent-soon" /><div className="prod-metric-info"><span className="prod-metric-val">{expiringCount}</span><span className="prod-metric-label">Expiring Soon</span></div></div>
            <div className="prod-metric-card"><div className="prod-metric-accent accent-expired" /><div className="prod-metric-info"><span className="prod-metric-val">{expiredCount}</span><span className="prod-metric-label">Expired</span></div></div>
          </div>

          <div className="history-filter-bar">
            <div className="history-search-field">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or barcode" />
            </div>
            <select className="filter-select" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All Categories</option>
              <option value="Vegetables">Vegetables</option>
              <option value="Dairy">Dairy</option>
              <option value="Fruits">Fruits</option>
              <option value="Bakery">Bakery</option>
              <option value="Meat">Meat</option>
              <option value="Other">Other</option>
            </select>
            <select className="filter-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All Status</option>
              <option value="fresh">Fresh</option>
              <option value="expiring">Expiring Soon</option>
              <option value="expired">Expired</option>
            </select>
            <label className="history-date-filter"><CalendarDays size={16} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Expiry from date" /></label>
            <label className="history-date-filter"><CalendarDays size={16} /><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Expiry to date" /></label>
            <button type="button" className="history-clear-button" onClick={clearFilters}>Clear</button>
          </div>

          <div className="products-list-card history-table-card">
            {loading ? <div className="state-list-loading">Loading product history...</div> : error ? <div className="state-list-error">{error}</div> : filteredProducts.length === 0 ? <div className="state-list-empty">No products match these filters.</div> : (
              <div className="table-responsive">
                <table className="products-table history-table">
                  <thead><tr><th>Product</th><th>Category</th><th>Barcode</th><th>Purchase Date</th><th>Expiry Date</th><th>Status</th><th>Location</th><th>Quantity</th></tr></thead>
                  <tbody>{filteredProducts.map((product) => {
                    const productStatus = getStatus(product.expiry_date);
                    return <tr key={product.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={getProductImage(product.name, product.category, product.image_url)}
                            alt={product.name}
                            style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0', flexShrink: 0, background: '#fff' }}
                          />
                          <strong>{product.name}</strong>
                        </div>
                      </td>
                      <td>{product.category}</td>
                      <td><span className="barcode-text">{product.barcode || 'N/A'}</span></td>
                      <td>{formatDate(product.purchase_date)}</td>
                      <td>{formatDate(product.expiry_date)}</td>
                      <td><span className={`history-status ${productStatus.className}`}>{productStatus.label}</span></td>
                      <td>{product.location || 'Pantry'}</td>
                      <td>{product.quantity || '1 unit'}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default History;
