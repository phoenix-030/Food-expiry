import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { api } from '../services/api';
import '../styles/Products.module.css';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronLeft, 
  ChevronRight, 
  X 
} from 'lucide-react';
import { getProductImage } from '../utils/productImages';

const Products = () => {
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';

  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [expiringSoon, setExpiringSoon] = useState(0);
  const [expired, setExpired] = useState(0);
  
  // Search & Filter
  const [searchVal, setSearchVal] = useState(urlSearch);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(4); // Display 4 per page exactly like screenshot (Showing 1-4)
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sync if URL search query changes (e.g. navigated from Notifications or Search bar)
  const [prevUrlSearch, setPrevUrlSearch] = useState(urlSearch);
  if (urlSearch !== prevUrlSearch) {
    setPrevUrlSearch(urlSearch);
    setSearchVal(urlSearch);
    setPage(1);
  }

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Vegetables');
  const [barcode, setBarcode] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [location, setLocation] = useState('Fridge');
  const [quantity, setQuantity] = useState('');
  const [editingImageUrl, setEditingImageUrl] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Fetch Inventory and metrics
  const fetchInventory = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts({
        category: selectedCategory,
        search: searchVal,
        page,
        limit
      });
      setProducts(data?.products || []);
      setTotalProducts(data?.pagination?.total || 0);
      setTotalPages(data?.pagination?.pages || 1);

      try {
        const dashboardStats = await api.getDashboardStats();
        if (dashboardStats?.metrics) {
          setExpiringSoon(dashboardStats.metrics.expiringSoon || 0);
          setExpired(dashboardStats.metrics.expired || 0);
        }
      } catch (dErr) {
        console.warn('Dashboard stats load notice:', dErr);
      }
    } catch (err) {
      console.error('fetchInventory error:', err);
      setError('Could not retrieve product list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadInventory = async () => {
      try {
        const data = await api.getProducts({
          category: selectedCategory,
          search: searchVal,
          page,
          limit
        });

        if (ignore) return;

        setProducts(data?.products || []);
        setTotalProducts(data?.pagination?.total || 0);
        setTotalPages(data?.pagination?.pages || 1);

        try {
          const dashboardStats = await api.getDashboardStats();
          if (ignore) return;
          if (dashboardStats?.metrics) {
            setExpiringSoon(dashboardStats.metrics.expiringSoon || 0);
            setExpired(dashboardStats.metrics.expired || 0);
          }
        } catch (dErr) {
          console.warn('Dashboard stats load notice:', dErr);
        }

        setError('');
      } catch (err) {
        console.error('loadInventory error:', err);
        if (!ignore) {
          setError('Could not retrieve product list.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadInventory();

    return () => {
      ignore = true;
    };
  }, [searchVal, selectedCategory, page, limit]);

  // Handle open add modal
  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setCategory('Vegetables');
    setBarcode('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setExpiryDate('');
    setLocation('Fridge');
    setQuantity('');
    setEditingImageUrl('');
    setIsModalOpen(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (p) => {
    setEditingId(p.id);
    setName(p.name);
    setCategory(p.category);
    setBarcode(p.barcode || '');
    // safely format dates to YYYY-MM-DD
    let pDate = new Date().toISOString().split('T')[0];
    let eDate = '';
    try {
      if (p.purchase_date) {
        const pd = new Date(p.purchase_date);
        if (!isNaN(pd.getTime())) pDate = pd.toISOString().split('T')[0];
      }
      if (p.expiry_date) {
        const ed = new Date(p.expiry_date);
        if (!isNaN(ed.getTime())) eDate = ed.toISOString().split('T')[0];
      }
    } catch (dateErr) {
      console.debug('Failed to parse date for edit modal:', dateErr);
    }
    setPurchaseDate(pDate);
    setExpiryDate(eDate);
    setLocation(p.location || 'Fridge');
    setQuantity(p.quantity || '');
    setIsModalOpen(true);
  };

  // Submit Modal
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!name || !category || !purchaseDate || !expiryDate) return;

    setModalLoading(true);
    try {
      const resolvedImg = editingId 
        ? (editingImageUrl || getProductImage(name, category)) 
        : getProductImage(name, category);

      if (editingId) {
        // Edit Mode
        await api.updateProduct(editingId, {
          name, category, barcode, purchase_date: purchaseDate, expiry_date: expiryDate, location, quantity, image_url: resolvedImg
        });
      } else {
        // Add Mode
        await api.addProduct({
          name, category, barcode, purchase_date: purchaseDate, expiry_date: expiryDate, location, quantity, image_url: resolvedImg
        });
      }
      setIsModalOpen(false);
      fetchInventory();
    } catch (err) {
      alert(err.message || 'Error saving product');
    } finally {
      setModalLoading(false);
    }
  };

  // Delete product
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.deleteProduct(id);
      fetchInventory();
    } catch (err) {
      alert(err.message || 'Error deleting product');
    }
  };

  // Format Expiry progress details
  const getShelfLifeMeta = (purchase_date, expiry_date) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(purchase_date);
      const end = new Date(expiry_date);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { percentage: 0, progressColor: 'progress-green', textColor: 'text-green', label: 'Active' };
      }

      const totalDuration = end - start;
      const remainingDuration = end - today;

      const remainingDays = Math.ceil(remainingDuration / (1000 * 60 * 60 * 24));
      
      let percentage = 0;
      if (totalDuration > 0 && remainingDuration > 0) {
        percentage = Math.min(100, Math.max(0, Math.round((remainingDuration / totalDuration) * 100)));
      }

      let progressColor = 'progress-green';
      let textColor = 'text-green';
      let label = `${remainingDays} Days`;

      if (remainingDays < 0) {
        progressColor = 'progress-red';
        textColor = 'text-red';
        label = 'Expired';
        percentage = 100; // full red
      } else if (remainingDays <= 3) {
        progressColor = 'progress-orange';
        textColor = 'text-orange';
        label = `${remainingDays} Days`;
      }

      return { percentage, progressColor, textColor, label };
    } catch {
      return { percentage: 0, progressColor: 'progress-green', textColor: 'text-green', label: 'Active' };
    }
  };


  // Category badge mapping
  const getCategoryBadgeClass = (cat) => {
    if (!cat || typeof cat !== 'string') return 'badge-other';
    const lcat = cat.toLowerCase();
    if (lcat.includes('veg')) return 'badge-veg';
    if (lcat.includes('dairy')) return 'badge-dairy';
    if (lcat.includes('fruit')) return 'badge-fruit';
    if (lcat.includes('bake')) return 'badge-bakery';
    if (lcat.includes('meat')) return 'badge-meat';
    return 'badge-other';
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div className="app-container">

      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="main-content">
        {/* Pass state and filters down to the search bar */}
        <Navbar 
          placeholder="Search inventory by name or barcode..." 
          searchValue={searchVal} 
          onSearchChange={(val) => { setSearchVal(val); setPage(1); }} 
        />

        <div className="page-container">
          
          {/* Card metrics summary */}
          <div className="products-metrics-row">
            <div className="prod-metric-card">
              <div className="prod-metric-accent accent-total" />
              <div className="prod-metric-info">
                <span className="prod-metric-val">{totalProducts}</span>
                <span className="prod-metric-label">Total Products</span>
              </div>
            </div>

            <div className="prod-metric-card">
              <div className="prod-metric-accent accent-soon" />
              <div className="prod-metric-info">
                <span className="prod-metric-val">{expiringSoon}</span>
                <span className="prod-metric-label">Expiring Soon</span>
              </div>
            </div>

            <div className="prod-metric-card">
              <div className="prod-metric-accent accent-expired" />
              <div className="prod-metric-info">
                <span className="prod-metric-val">{expired}</span>
                <span className="prod-metric-label">Expired Items</span>
              </div>
            </div>
          </div>

          {/* Main List Container */}
          <div className="products-list-card">
            
            {/* Header toolbar */}
            <div className="products-card-subheader">
              <div className="products-title-area">
                <h3 className="products-main-title">Product Inventory</h3>
                <p className="products-main-subtitle">Manage and monitor the shelf life of your current stock.</p>
              </div>

              <div className="products-actions-bar">
                {/* Category filtering */}
                <select 
                  className="filter-select"
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                >
                  <option value="">All Categories</option>
                  <option value="Vegetables">Vegetables</option>
                  <option value="Dairy">Dairy</option>
                  <option value="Fruits">Fruits</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Meat">Meat</option>
                  <option value="Other">Other</option>
                </select>

                <button className="btn btn-primary" onClick={handleOpenAdd}>
                  <Plus size={16} />
                  <span>Add Product</span>
                </button>
              </div>
            </div>

            {/* Loading / Error States */}
            {loading ? (
              <div className="state-list-loading">
                Fetching inventory list...
              </div>
            ) : error ? (
              <div className="state-list-error">
                {error}
              </div>
            ) : products.length === 0 ? (
              <div className="state-list-empty">
                No products found in inventory.
              </div>
            ) : (
              <>
                {/* Table Data */}
                <div className="table-responsive">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Product Name</th>
                        <th>Category</th>
                        <th>Barcode</th>
                        <th>Purchase Date</th>
                        <th>Expiry Date</th>
                        <th>Shelf Life</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => {
                        const shelfLife = getShelfLifeMeta(p.purchase_date, p.expiry_date);
                        return (
                          <tr key={p.id}>
                            {/* Image cell */}
                            <td>
                              <img
                                src={getProductImage(p.name, p.category, p.image_url)}
                                alt={p.name}
                                className="thumbnail-img"
                              />
                            </td>

                            {/* Product info cell */}
                            <td>
                              <div className="td-product-cell">
                                <div className="text-left">
                                  <div className="product-cell-name">{p.name}</div>
                                  {p.quantity && (
                                    <div className="product-cell-quantity">{p.quantity}</div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Category cell */}
                            <td>
                              <span className={`badge ${getCategoryBadgeClass(p.category)}`}>
                                {p.category}
                              </span>
                            </td>

                            {/* Barcode cell */}
                            <td>
                              <span className="barcode-text">
                                {p.barcode || 'N/A'}
                              </span>
                            </td>

                            {/* Purchase Date cell */}
                            <td>
                              <span>{formatDate(p.purchase_date)}</span>
                            </td>

                            {/* Expiry Date cell */}
                            <td>
                              <span>{formatDate(p.expiry_date)}</span>
                            </td>

                            {/* Shelf Life cell */}
                            <td>
                              <div className="shelf-life-container">
                                <div className="progress-bar-bg">
                                  <progress
                                    className={`progress-native ${shelfLife.progressColor}`}
                                    max="100"
                                    value={shelfLife.percentage}
                                    aria-label={`Shelf life: ${shelfLife.label}`}
                                  />
                                </div>
                                <span className={`shelf-life-text ${shelfLife.textColor}`}>
                                  {shelfLife.label}
                                </span>
                              </div>
                            </td>

                            {/* Edit/Delete Actions cell */}
                            <td>
                              <div className="row-action-btns">
                                <button className="row-action-btn edit-btn" onClick={() => handleOpenEdit(p)} title="Edit product">
                                  <Edit3 size={16} />
                                </button>
                                <button className="row-action-btn delete-btn" onClick={() => handleDelete(p.id)} title="Delete product">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                <div className="pagination-footer">
                  <div className="pagination-info">
                    Showing {products.length > 0 ? (page - 1) * limit + 1 : 0}-
                    {Math.min(page * limit, totalProducts)} of {totalProducts} products
                  </div>

                  <div className="pagination-controls">
                    <button
                      className="page-nav-btn"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        className={`page-number-btn ${page === pageNum ? 'active' : ''}`}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    ))}

                    <button
                      className="page-nav-btn"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      aria-label="Next page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header-row">
              <h3 className="modal-title">
                {editingId ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="icon-button-plain">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct}>
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
                  {modalLoading ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
