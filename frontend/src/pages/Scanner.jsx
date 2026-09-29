import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { api } from '../services/api';
import '../styles/Scanner.module.css';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  Camera, 
  CameraOff, 
  QrCode, 
  Sparkles, 
  Plus, 
  Minus,
  Check, 
  AlertCircle, 
  AlertTriangle,
  X,
  Zap,
  Upload,
  Search,
  Globe,
  Loader2,
  Package,
  Edit3,
  Bot,
  Image as ImageIcon
} from 'lucide-react';
import { getProductImage, CURATED_VEGETABLES, CURATED_DAIRY } from '../utils/productImages';

const playBeep = (freq = 880) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // AudioContext blocked by browser
  }
};

const Scanner = () => {
  const qrScannerRef = useRef(null);
  const fileDummyScannerRef = useRef(null);
  const isStartingRef = useRef(false);

  // Scanner UI modes: 'camera' | 'upload' | 'catalog'
  const [activeTab, setActiveTab] = useState('camera');

  // Open Food Facts integration setting (controlled via Settings page)
  const [enableOpenFoodFacts, setEnableOpenFoodFacts] = useState(() => {
    return localStorage.getItem('freshtrack_enable_openfoodfacts') === 'true';
  });

  // Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');

  // Scanned Session Logs
  const [scannedLogs, setScannedLogs] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRecognizedProduct, setIsRecognizedProduct] = useState(true);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState('Vegetables');
  const [barcode, setBarcode] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [location, setLocation] = useState('Fridge');
  const [quantity, setQuantity] = useState('');
  const [quantityCount, setQuantityCount] = useState('1');
  const [existingInventoryProduct, setExistingInventoryProduct] = useState(null);
  const [isInventoryReview, setIsInventoryReview] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // AI & Manual Entry Mode State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [manualEntryMode, setManualEntryMode] = useState(false);

  // Manual Barcode Input
  const [manualCode, setManualCode] = useState('');

  // File Upload State
  const [fileScanning, setFileScanning] = useState(false);
  const [fileScanError, setFileScanError] = useState('');

  // Open Food Facts Live Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingOff, setSearchingOff] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState('all'); // 'all' | 'vegetables' | 'dairy'

  // Regular Products List
  const [regularProducts, setRegularProducts] = useState([]);
  const [regularProductsLoading, setRegularProductsLoading] = useState(true);

  // Load user inventory products for quick re-scanning
  useEffect(() => {
    const loadRegularProducts = async () => {
      try {
        const data = await api.getProducts({ page: 1, limit: 20 });
        setRegularProducts(data.products || []);
      } catch (error) {
        console.error('Regular products load failed:', error);
        setRegularProducts([]);
      } finally {
        setRegularProductsLoading(false);
      }
    };

    void loadRegularProducts();
  }, []);

  // Synchronize Open Food Facts setting from Settings page in real time
  useEffect(() => {
    const handleSettingsUpdate = () => {
      const isEnabled = localStorage.getItem('freshtrack_enable_openfoodfacts') === 'true';
      setEnableOpenFoodFacts(isEnabled);
      if (!isEnabled) {
        setActiveTab((prev) => (prev === 'catalog' ? 'camera' : prev));
      }
    };

    window.addEventListener('freshtrack_settings_updated', handleSettingsUpdate);
    window.addEventListener('storage', handleSettingsUpdate);
    return () => {
      window.removeEventListener('freshtrack_settings_updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleSettingsUpdate);
    };
  }, []);

  // Enumerate available cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setAvailableCameras(devices);
          const backCam = devices.find((d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.warn('Could not enumerate cameras:', err);
      });
  }, []);

  const calculateExpiry = useCallback((cat, customDays = null) => {
    const daysMap = {
      Dairy: 7,
      Bakery: 5,
      Vegetables: 7,
      Fruits: 10,
      Meat: 3,
      Other: 14
    };
    const days = customDays || daysMap[cat] || 7;
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() + days);
    setExpiryDate(dateObj.toISOString().split('T')[0]);
  }, []);

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    calculateExpiry(cat);
  };

  // Safe stop camera helper
  const stopCameraStream = useCallback(async () => {
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
      } catch (e) {
        console.warn('Camera stop error:', e);
      }
    }
    setCameraActive(false);
  }, []);

  // Handle scanned or selected barcode
  const handleBarcodeScanned = useCallback(async (code, prefilledMeta = null, inventoryProduct = null, reviewOnly = false) => {
    const cleanCode = String(code).trim();
    if (!cleanCode) return;

    playBeep(880);
    await stopCameraStream();

    setIsModalOpen(true);
    setLookupError('');
    setAiSuggestion(null);
    setManualEntryMode(false);
    setBarcode(cleanCode);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setQuantityCount('1');
    setExistingInventoryProduct(null);
    setIsInventoryReview(false);

    const matchedProduct = reviewOnly ? inventoryProduct : null;

    if (matchedProduct) {
      setExistingInventoryProduct(matchedProduct);
      setIsInventoryReview(reviewOnly);
      setIsRecognizedProduct(true);
      setName(matchedProduct.name || `Product ${cleanCode}`);
      setBrand('');
      setImageUrl(matchedProduct.image_url || '');
      setCategory(matchedProduct.category || 'Other');
      setLocation(matchedProduct.location || 'Pantry');
      setQuantity(matchedProduct.quantity || '1 unit');
      setExpiryDate(String(matchedProduct.expiry_date).split('T')[0]);
      setModalLoading(false);
      return;
    }

    if (prefilledMeta) {
      // Selected from Open Food Facts live catalog
      setIsRecognizedProduct(true);
      setName(prefilledMeta.name || `Product ${cleanCode}`);
      setBrand(prefilledMeta.brand || '');
      setImageUrl(prefilledMeta.imageUrl || '');
      setCategory(prefilledMeta.category || 'Other');
      setLocation(prefilledMeta.location || 'Pantry');
      setQuantity(prefilledMeta.quantity || '1 unit');
      calculateExpiry(prefilledMeta.category || 'Other', prefilledMeta.shelfLifeDays);
      setModalLoading(false);
      return;
    }

    // Default lookup state
    setName('');
    setBrand('');
    setImageUrl('');
    setCategory('Other');
    setLocation('Pantry');
    setQuantity('1 unit');
    calculateExpiry('Other');
    setModalLoading(true);

    try {
      const data = await api.lookupBarcode(cleanCode);
      if (data && data.found) {
        setIsRecognizedProduct(true);
        setName(data.name || `Product ${cleanCode}`);
        setBrand(data.brand || '');
        setImageUrl(data.imageUrl || '');
        setCategory(data.category || 'Other');
        setLocation(data.location || 'Pantry');
        setQuantity(data.quantity || '1 unit');
        calculateExpiry(data.category || 'Other', data.shelfLifeDays);
      } else {
        // NOT a recognized product!
        setIsRecognizedProduct(false);
        setName('');
        playBeep(440); // Lower tone warning
      }
    } catch (err) {
      console.error('Barcode lookup error:', err);
      setIsRecognizedProduct(false);
      setLookupError('Could not verify barcode with database. You may use AI to identify or enter manually.');
    } finally {
      setModalLoading(false);
    }
  }, [calculateExpiry, stopCameraStream]);

  // AI Product Identification Request
  const handleAskAI = async () => {
    if (!barcode) return;
    setAiLoading(true);
    try {
      const aiData = await api.identifyBarcodeWithAI(barcode, name);
      setAiSuggestion(aiData);

      if (aiData.suggestedName) {
        setName(aiData.suggestedName);
      }
      if (aiData.brand) {
        setBrand(aiData.brand);
      }
      if (aiData.category) {
        setCategory(aiData.category);
      }
      if (aiData.location) {
        setLocation(aiData.location);
      }
      if (aiData.shelfLifeDays) {
        calculateExpiry(aiData.category || 'Other', aiData.shelfLifeDays);
      }
      setManualEntryMode(true);
    } catch (err) {
      console.error('AI identification error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Start Camera Stream
  const startCameraStream = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setCameraError('');

    try {
      if (!qrScannerRef.current) {
        qrScannerRef.current = new Html5Qrcode('html5qr-code-viewfinder');
      }

      const formats = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE
      ];

      const cameraIdOrConfig = selectedCameraId 
        ? selectedCameraId 
        : { facingMode: 'environment' };

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.75);
          return { width: Math.max(qrboxSize, 250), height: Math.max(Math.floor(qrboxSize * 0.65), 160) };
        },
        formatsToSupport: formats,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      await qrScannerRef.current.start(
        cameraIdOrConfig,
        config,
        (decodedText) => {
          void handleBarcodeScanned(decodedText);
        },
        () => {}
      );

      setCameraActive(true);
    } catch (err) {
      console.error('Html5Qrcode camera error:', err);
      setCameraError(err.message || 'Unable to access camera. Please allow camera permissions.');
      setCameraActive(false);
    } finally {
      isStartingRef.current = false;
    }
  }, [handleBarcodeScanned, selectedCameraId]);

  // Toggle Camera
  const toggleCamera = () => {
    if (cameraActive) {
      void stopCameraStream();
    } else {
      void startCameraStream();
    }
  };

  // Clean up scanner safely on unmount
  useEffect(() => {
    return () => {
      try {
        const scanner = qrScannerRef.current;
        if (scanner) {
          qrScannerRef.current = null;
          try {
            const isScanning = Boolean(scanner.isScanning);
            if (isScanning) {
              scanner.stop().catch(() => {}).finally(() => {
                try { scanner.clear(); } catch (_) {}
              });
            } else {
              try { scanner.clear(); } catch (_) {}
            }
          } catch (_) {}
        }
      } catch (err) {
        console.warn('Scanner unmount cleanup notice:', err);
      }

      try {
        const fileScanner = fileDummyScannerRef.current;
        if (fileScanner) {
          fileDummyScannerRef.current = null;
          try { fileScanner.clear(); } catch (_) {}
        }
      } catch (err) {
        console.warn('File scanner cleanup notice:', err);
      }
    };
  }, []);

  // Handle image file scan
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileScanError('');
    setFileScanning(true);

    try {
      if (!fileDummyScannerRef.current) {
        fileDummyScannerRef.current = new Html5Qrcode('qr-reader-dummy-file');
      }

      const decodedText = await fileDummyScannerRef.current.scanFile(file, true);
      void handleBarcodeScanned(decodedText);
    } catch (err) {
      console.error('File scan error:', err);
      setFileScanError('No barcode was detected in this image. Please try another clear photo.');
    } finally {
      setFileScanning(false);
      e.target.value = '';
    }
  };

  // Handle Open Food Facts live search
  const handleSearchOff = async (queryToSearch) => {
    const q = (queryToSearch !== undefined ? queryToSearch : searchQuery).trim();
    if (!q) return;

    setSearchingOff(true);
    try {
      const res = await api.searchOpenFoodFacts(q);
      setSearchResults(res.products || []);
    } catch (err) {
      console.error('OFF Search error:', err);
      setSearchResults([]);
    } finally {
      setSearchingOff(false);
    }
  };

  // Save Scanned item to inventory
  const handleSaveScanned = async (e) => {
    e.preventDefault();
    if (!name.trim() || !category || !purchaseDate || !expiryDate) return;

    setModalLoading(true);
    try {
      const resolvedImageUrl = imageUrl || getProductImage(name.trim(), category, imageUrl);

      const data = await api.addProduct({
        name: name.trim(),
        category,
        barcode: barcode || null,
        purchase_date: purchaseDate,
        expiry_date: expiryDate,
        location,
        quantity: quantity || '1 unit',
        quantity_count: Math.max(1, parseInt(quantityCount, 10) || 1),
        image_url: resolvedImageUrl || null
      });

      const savedItem = data.product || {
        id: Date.now(),
        name: name.trim(),
        category,
        barcode,
        purchase_date: purchaseDate,
        expiry_date: expiryDate,
        location,
        quantity: quantity || '1 unit',
        quantity_count: Math.max(1, parseInt(quantityCount, 10) || 1),
        image_url: resolvedImageUrl || null
      };

      setScannedLogs((prev) => [
        {
          id: savedItem.id,
          name: savedItem.name,
          category: savedItem.category || category,
          barcode: savedItem.barcode,
          expiryDate: savedItem.expiry_date,
          imageUrl: savedItem.image_url || resolvedImageUrl || null
        },
        ...prev
      ]);

      // Immediately prepend to recent inventory list so user sees it right away with image!
      setRegularProducts((prev) => [
        savedItem,
        ...prev.filter((p) => p.id !== savedItem.id)
      ]);

      setIsModalOpen(false);
    } catch (err) {
      console.error('Save scanned error:', err);
      setLookupError('Failed to save to inventory: ' + (err.message || 'Server error'));
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Hidden dummy container for image file decoding */}
      <div id="qr-reader-dummy-file" style={{ display: 'none' }} />

      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Area */}
      <main className="main-content">
        <Navbar placeholder="Search inventory..." />

        <div className="page-container">
          {/* Mode Switcher Tabs */}
          <div className="scanner-mode-tabs">
            <button
              type="button"
              className={`scanner-mode-tab ${activeTab === 'camera' ? 'active' : ''}`}
              onClick={() => setActiveTab('camera')}
            >
              <Camera size={16} />
              <span>Live Camera Scanner</span>
            </button>

            <button
              type="button"
              className={`scanner-mode-tab ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => {
                void stopCameraStream();
                setActiveTab('upload');
              }}
            >
              <Upload size={16} />
              <span>Scan from Image / Photo</span>
            </button>

            {enableOpenFoodFacts && (
              <button
                type="button"
                className={`scanner-mode-tab ${activeTab === 'catalog' ? 'active' : ''}`}
                onClick={() => {
                  void stopCameraStream();
                  setActiveTab('catalog');
                  if (searchResults.length === 0) {
                    void handleSearchOff('Milk');
                  }
                }}
              >
                <Globe size={16} />
                <span>Open Food Facts Database</span>
              </button>
            )}
          </div>

          <div className="scanner-layout">
            {/* Left side: Viewfinder Cam or Upload or OFF Catalog */}
            <div className="dashboard-column">
              
              {/* 1. CAMERA TAB */}
              {activeTab === 'camera' && (
                <div className="card scanner-transparent-card">
                  <div className="viewfinder-card">
                    {cameraError && (
                      <div className="scanner-error-box">
                        <AlertCircle size={40} className="scanner-error-icon" />
                        <h4 className="scanner-error-title">Camera Error</h4>
                        <p className="scanner-error-copy">{cameraError}</p>
                        <button className="btn btn-primary" onClick={startCameraStream} style={{ marginTop: '12px' }}>
                          Try Again
                        </button>
                      </div>
                    )}

                    {!cameraActive && !cameraError && (
                      <div className="scanner-off-box">
                        <CameraOff size={44} className="scanner-off-icon" />
                        <p className="scanner-off-title">Live Barcode Camera is Off</p>
                        <p className="scanner-error-copy" style={{ marginBottom: '16px', maxWidth: '340px' }}>
                          Hold any product barcode in front of the lens. Valid products are detected instantly.
                        </p>
                        <button className="btn btn-primary scanner-start-button" onClick={startCameraStream}>
                          Start Barcode Scanner
                        </button>
                      </div>
                    )}

                    {/* Html5Qrcode viewfinder mount */}
                    <div
                      id="html5qr-code-viewfinder"
                      style={{
                        display: cameraActive ? 'block' : 'none',
                        width: '100%',
                        height: '100%'
                      }}
                    />

                    {cameraActive && (
                      <div className="scanner-overlay-frame">
                        <div className="scanner-box-guide">
                          <div className="guide-corner corner-tl" />
                          <div className="guide-corner corner-tr" />
                          <div className="guide-corner corner-bl" />
                          <div className="guide-corner corner-br" />
                          <div className="scanner-laser-line" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="scanner-card-footer">
                    <div className="scanner-status-text">
                      {cameraActive ? (
                        <>
                          <span className="status-dot-active" />
                          <span>
                            Active Scanner • {enableOpenFoodFacts ? 'AI & Open Food Facts Ready' : 'AI Barcode Ready'}
                          </span>
                        </>
                      ) : (
                        <span>Camera idle</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {availableCameras.length > 1 && (
                        <select
                          className="scanner-camera-select"
                          value={selectedCameraId}
                          onChange={(e) => {
                            setSelectedCameraId(e.target.value);
                            if (cameraActive) {
                              void stopCameraStream().then(() => {
                                setTimeout(() => void startCameraStream(), 300);
                              });
                            }
                          }}
                        >
                          {availableCameras.map((cam) => (
                            <option key={cam.id} value={cam.id}>
                              {cam.label || `Camera ${cam.id.slice(0, 5)}`}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        className={`btn ${cameraActive ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={toggleCamera}
                      >
                        {cameraActive ? <CameraOff size={16} /> : <Camera size={16} />}
                        <span>{cameraActive ? 'Turn Off Camera' : 'Turn On Camera'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. UPLOAD BARCODE IMAGE TAB */}
              {activeTab === 'upload' && (
                <div className="card">
                  <div className="section-header">
                    <h4 className="section-title">Decode Barcode from Image File</h4>
                  </div>
                  <p className="simulator-copy" style={{ marginBottom: '16px' }}>
                    Take a photo of the product barcode with your phone or packaging, and drop it here.
                  </p>

                  <label className="scanner-upload-container">
                    <input
                      type="file"
                      accept="image/*"
                      className="scanner-file-input"
                      onChange={handleImageUpload}
                      disabled={fileScanning}
                    />
                    {fileScanning ? (
                      <>
                        <Loader2 size={44} className="scanner-upload-icon spinner-anim" />
                        <h4 className="scanner-upload-title">Analyzing Barcode...</h4>
                        <p className="scanner-upload-sub">Reading barcode patterns and verifying...</p>
                      </>
                    ) : (
                      <>
                        <Upload size={44} className="scanner-upload-icon" />
                        <h4 className="scanner-upload-title">Click or Drop Barcode Image Here</h4>
                        <p className="scanner-upload-sub">
                          Supports JPG, PNG, WEBP, and camera photos with barcodes.
                        </p>
                        <span className="btn btn-secondary">Select Image File</span>
                      </>
                    )}
                  </label>

                  {fileScanError && (
                    <div className="lookup-alert" style={{ marginTop: '16px' }}>
                      <AlertCircle size={16} className="shrink-icon" />
                      <span>{fileScanError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 3. OPEN FOOD FACTS LIVE CATALOG TAB (Only when enabled in Settings) */}
              {enableOpenFoodFacts && activeTab === 'catalog' && (
                <div className="card">
                  <div className="section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Globe size={18} style={{ color: '#066e38' }} />
                      <h4 className="section-title">Open Food Facts Live Catalog</h4>
                    </div>
                    <span className="session-count">Millions of products</span>
                  </div>
                  <p className="simulator-copy">
                    Search any branded or fresh product directly from the Open Food Facts global database.
                  </p>

                  {/* Category Selector Pills */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="off-chip"
                      style={{
                        fontWeight: 700,
                        padding: '7px 14px',
                        background: catalogFilter === 'all' ? '#066e38' : '#fff',
                        color: catalogFilter === 'all' ? '#fff' : '#334155',
                        borderColor: catalogFilter === 'all' ? '#066e38' : '#cbd5e1'
                      }}
                      onClick={() => setCatalogFilter('all')}
                    >
                      🌐 Search All Database
                    </button>

                    <button
                      type="button"
                      className="off-chip"
                      style={{
                        fontWeight: 700,
                        padding: '7px 14px',
                        background: catalogFilter === 'vegetables' ? '#066e38' : '#fff',
                        color: catalogFilter === 'vegetables' ? '#fff' : '#334155',
                        borderColor: catalogFilter === 'vegetables' ? '#066e38' : '#cbd5e1'
                      }}
                      onClick={() => setCatalogFilter('vegetables')}
                    >
                      🥦 All Types of Vegetables ({CURATED_VEGETABLES.length})
                    </button>

                    <button
                      type="button"
                      className="off-chip"
                      style={{
                        fontWeight: 700,
                        padding: '7px 14px',
                        background: catalogFilter === 'dairy' ? '#066e38' : '#fff',
                        color: catalogFilter === 'dairy' ? '#fff' : '#334155',
                        borderColor: catalogFilter === 'dairy' ? '#066e38' : '#cbd5e1'
                      }}
                      onClick={() => setCatalogFilter('dairy')}
                    >
                      🥛 All Types of Dairy Products ({CURATED_DAIRY.length})
                    </button>
                  </div>

                  {/* 1. Curated Vegetables View */}
                  {catalogFilter === 'vegetables' && (
                    <div className="off-results-grid">
                      {CURATED_VEGETABLES.map((item) => (
                        <div key={item.name} className="off-product-card">
                          <div className="off-card-image-wrap">
                            <img
                              src={getProductImage(item.name, item.category, item.imageUrl)}
                              alt={item.name}
                              className="off-card-image"
                              loading="lazy"
                            />
                          </div>
                          <div className="off-card-body">
                            <span className="off-card-brand">Fresh Produce</span>
                            <h5 className="off-card-title">{item.name}</h5>
                            <div className="off-card-meta">
                              <span>{item.quantity}</span>
                              <span style={{ color: '#066e38', fontWeight: 600 }}>{item.shelfLifeDays} days shelf life</span>
                            </div>
                            <button
                              type="button"
                              className="off-card-btn"
                              onClick={() => void handleBarcodeScanned(item.barcode, item)}
                            >
                              <Plus size={14} />
                              <span>Add to Inventory</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 2. Curated Dairy View */}
                  {catalogFilter === 'dairy' && (
                    <div className="off-results-grid">
                      {CURATED_DAIRY.map((item) => (
                        <div key={item.name} className="off-product-card">
                          <div className="off-card-image-wrap">
                            <img
                              src={getProductImage(item.name, item.category, item.imageUrl)}
                              alt={item.name}
                              className="off-card-image"
                              loading="lazy"
                            />
                          </div>
                          <div className="off-card-body">
                            <span className="off-card-brand">Dairy Essentials</span>
                            <h5 className="off-card-title">{item.name}</h5>
                            <div className="off-card-meta">
                              <span>{item.quantity}</span>
                              <span style={{ color: '#066e38', fontWeight: 600 }}>{item.shelfLifeDays} days shelf life</span>
                            </div>
                            <button
                              type="button"
                              className="off-card-btn"
                              onClick={() => void handleBarcodeScanned(item.barcode, item)}
                            >
                              <Plus size={14} />
                              <span>Add to Inventory</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3. Global Open Food Facts Search View */}
                  {catalogFilter === 'all' && (
                    <>
                      {/* Search Bar */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleSearchOff();
                        }}
                        className="off-search-bar-row"
                      >
                        <div className="off-search-input-wrapper">
                          <Search size={18} className="off-search-icon" />
                          <input
                            type="text"
                            className="off-search-input"
                            placeholder="Search by brand or food (e.g. Tomato, Milk, Nutella, Butter)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={searchingOff}>
                          {searchingOff ? <Loader2 size={16} className="spinner-anim" /> : <Search size={16} />}
                          <span>Search</span>
                        </button>
                      </form>

                      {/* Quick Chip Suggestions */}
                      <div className="off-quick-chips">
                        {['Tomato', 'Potato', 'Onion', 'Carrot', 'Spinach', 'Milk', 'Paneer', 'Butter', 'Cheese', 'Curd', 'Nutella'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            className="off-chip"
                            onClick={() => {
                              setSearchQuery(chip);
                              void handleSearchOff(chip);
                            }}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>

                      {/* Results Grid */}
                      {searchingOff ? (
                        <div className="muted-empty-text centered" style={{ padding: '40px 0' }}>
                          <Loader2 size={24} className="spinner-anim" style={{ margin: '0 auto 8px auto', display: 'block', color: '#066e38' }} />
                          Searching Open Food Facts Database...
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="muted-empty-text centered" style={{ padding: '40px 0' }}>
                          No Open Food Facts items found. Try searching for &quot;Milk&quot; or click &quot;All Types of Vegetables&quot; above.
                        </div>
                      ) : (
                        <div className="off-results-grid">
                          {searchResults.map((item) => (
                            <div key={item.barcode} className="off-product-card">
                              <div className="off-card-image-wrap">
                                <img
                                  src={getProductImage(item.name, item.category, item.imageUrl)}
                                  alt={item.name}
                                  className="off-card-image"
                                  loading="lazy"
                                />
                              </div>
                              <div className="off-card-body">
                                {item.brand && <span className="off-card-brand">{item.brand}</span>}
                                <h5 className="off-card-title">{item.name}</h5>
                                <div className="off-card-meta">
                                  <span>{item.quantity || '1 unit'}</span>
                                  <span style={{ fontFamily: 'monospace' }}>#{item.barcode}</span>
                                </div>
                                <button
                                  type="button"
                                  className="off-card-btn"
                                  onClick={() => void handleBarcodeScanned(item.barcode, item)}
                                >
                                  <Plus size={14} />
                                  <span>Add to Inventory</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Session Scanned Products Log */}
              <div className="card" style={{ marginTop: '20px' }}>
                <div className="section-header">
                  <h4 className="section-title">Scanned in this Session</h4>
                  <span className="session-count">
                    {scannedLogs.length} items added
                  </span>
                </div>
                <div className="scanned-logs-list">
                  {scannedLogs.length > 0 ? (
                    scannedLogs.map((log) => (
                      <div key={log.id} className="scanned-log-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={getProductImage(log.name, log.category || 'Other', log.imageUrl)}
                            alt={log.name}
                            style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0', flexShrink: 0 }}
                          />
                          <div className="text-left">
                            <span className="scanned-log-title">{log.name}</span>
                            <div className="scanned-log-sub">
                              {log.barcode ? `Barcode: ${log.barcode}` : 'No barcode'} • Expiry: {log.expiryDate}
                            </div>
                          </div>
                        </div>
                        <div className="saved-badge">
                          <Check size={12} />
                          <span>Saved</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="muted-empty-text centered">
                      No items scanned yet in this session.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Manual input, AI quick assistant, & Inventory items */}
            <div className="dashboard-column">
              <div className="card">
                
                {/* Manual Barcode / Handheld Scanner section */}
                <div className="custom-barcode-section" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
                  <div className="form-group">
                    <label className="form-label compact-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Manual or USB Gun Barcode</span>
                      <span style={{ fontSize: '11px', color: '#066e38', fontWeight: 600 }}>Smart Verification</span>
                    </label>
                    <div className="input-container">
                      <QrCode size={18} className="input-icon" />
                      <input
                        type="text"
                        className="form-input has-icon"
                        placeholder="e.g. 3017620422003 (Nutella)"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && manualCode) {
                            e.preventDefault();
                            void handleBarcodeScanned(manualCode);
                            setManualCode('');
                          }
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', alignItems: 'center' }}>
                      <span className="hint-text">
                        Type barcode & press Enter, or use USB scanner.
                      </span>
                      {manualCode && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => {
                            void handleBarcodeScanned(manualCode);
                            setManualCode('');
                          }}
                        >
                          Scan & Verify
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Assistant Quick Card */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Bot size={16} style={{ color: '#6366f1' }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#4338ca' }}>AI Barcode & Product Assistant Active</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                    If a barcode isn&apos;t in Open Food Facts, AI automatically resolves origin country, food category, and recommended shelf life.
                  </p>
                </div>

                <div className="simulator-header" style={{ marginTop: '20px' }}>
                  <Zap size={18} className="icon-gold" />
                  <span>Your Inventory Barcodes</span>
                </div>
                <p className="simulator-copy">
                  Existing items with barcodes in your inventory. Click to look up details or re-stock.
                </p>

                <div className="simulator-grid">
                  {regularProductsLoading ? (
                    <div className="muted-empty-text centered">Loading products...</div>
                  ) : regularProducts.length === 0 ? (
                    <div className="muted-empty-text centered">No products added yet.</div>
                  ) : (
                    regularProducts.slice(0, 15).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="simulator-item-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', padding: '8px 12px' }}
                        disabled={!item.barcode}
                        onClick={() => item.barcode && void handleBarcodeScanned(item.barcode, null, item, true)}
                      >
                        <img
                          src={getProductImage(item.name, item.category, item.image_url)}
                          alt={item.name}
                          style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1', flexShrink: 0, background: '#fff' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="sim-name" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {item.name} {item.quantity ? `(${item.quantity})` : ''} {item.quantity_count > 1 ? `(${item.quantity_count} in stock)` : ''}
                          </span>
                          <span className="sim-barcode" style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                            {item.barcode ? `Barcode: ${item.barcode} • [${item.category}]` : 'No barcode saved'}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Review and Save Scanned Item Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header-row">
              <div className="modal-title-with-icon">
                <Sparkles size={18} className="icon-primary" />
                <h3 className="modal-title compact">
                  {isInventoryReview ? 'Product Details' : (isRecognizedProduct ? 'Review Scanned Product' : 'Product Verification Result')}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="icon-button-plain">
                <X size={20} />
              </button>
            </div>

            {lookupError && (
              <div className="lookup-alert">
                <AlertCircle size={16} className="shrink-icon" />
                <span>{lookupError}</span>
              </div>
            )}

            {/* UNRECOGNIZED PRODUCT BANNER */}
            {!modalLoading && !isRecognizedProduct && (
              <div className="not-product-banner">
                <AlertTriangle className="not-product-icon" size={24} />
                <div className="not-product-content">
                  <h4 className="not-product-title">This is not a recognized product</h4>
                  <p className="not-product-desc">
                    Barcode <strong>#{barcode}</strong> was scanned, but could not be found in the global Open Food Facts database or your inventory.
                  </p>
                  <div className="not-product-actions">
                    <button
                      type="button"
                      className="btn-ai-sparkle"
                      onClick={handleAskAI}
                      disabled={aiLoading}
                    >
                      {aiLoading ? <Loader2 size={13} className="spinner-anim" /> : <Sparkles size={13} />}
                      <span>{aiLoading ? 'AI Analyzing Barcode...' : 'Identify with AI'}</span>
                    </button>

                    <button
                      type="button"
                      className="btn-manual-entry"
                      onClick={() => setManualEntryMode(true)}
                    >
                      <Edit3 size={13} />
                      <span>Enter Name Manually</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AI SUGGESTION CARD */}
            {!modalLoading && aiSuggestion && (
              <div className="ai-suggestion-card">
                <div className="ai-suggestion-header">
                  <span className="ai-suggestion-badge">
                    <Sparkles size={12} /> AI Identification Result
                  </span>
                  {aiSuggestion.originCountry && (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6d28d9' }}>
                      Origin: {aiSuggestion.originCountry}
                    </span>
                  )}
                </div>
                <div className="ai-suggestion-title">
                  {aiSuggestion.suggestedName || 'Suggested Product'}
                </div>
                <div className="ai-suggestion-explanation">
                  {aiSuggestion.explanation}
                </div>
              </div>
            )}

            {/* PRODUCT HEADER PREVIEW */}
            {!modalLoading && (name || imageUrl) && (
              <>
                {isRecognizedProduct ? (
                  <div className="verified-success-badge">
                    <Check size={13} /> {existingInventoryProduct ? 'Already in Your Inventory' : 'Verified Product from Open Food Facts'}
                  </div>
                ) : (
                  <div className="verified-success-badge" style={{ background: '#ede9fe', color: '#6d28d9' }}>
                    <Sparkles size={13} /> Product Identified & Ready
                  </div>
                )}
                <div className="modal-product-preview-card">
                  <img
                    src={getProductImage(name, category, imageUrl)}
                    alt={name || 'Product'}
                    className="modal-product-img"
                  />
                  <div className="modal-product-info">
                    {brand && <div className="modal-product-brand">{brand}</div>}
                    <div className="modal-product-name">{name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="modal-product-barcode">#{barcode}</span>
                      <span className="modal-off-badge">
                        <Globe size={11} /> {category} Item
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* FORM */}
            <form onSubmit={handleSaveScanned}>
              <div className="modal-body scanner-modal-body">
                {modalLoading ? (
                  <div className="modal-loading-message" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '30px 0' }}>
                    <Loader2 size={20} className="spinner-anim" style={{ color: '#066e38' }} />
                    <span>Checking Open Food Facts Database...</span>
                  </div>
                ) : isInventoryReview && existingInventoryProduct ? (
                  <div className="two-column-grid">
                    <div className="form-group"><label className="form-label">Purchase Date</label><div>{String(existingInventoryProduct.purchase_date).split('T')[0]}</div></div>
                    <div className="form-group"><label className="form-label">Expiry Date</label><div>{String(existingInventoryProduct.expiry_date).split('T')[0]}</div></div>
                    <div className="form-group"><label className="form-label">Storage Location</label><div>{existingInventoryProduct.location || 'Pantry'}</div></div>
                    <div className="form-group"><label className="form-label">Package Size</label><div>{existingInventoryProduct.quantity || '1 unit'}</div></div>
                    <div className="form-group"><label className="form-label">In Stock</label><div>{existingInventoryProduct.quantity_count || 1}</div></div>
                  </div>
                ) : (
                  <>
                    {(isRecognizedProduct || manualEntryMode || aiSuggestion) ? (
                      <>
                        <div className="form-group">
                          <label className="form-label">Product Name *</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Enter product name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            readOnly={Boolean(existingInventoryProduct)}
                            required
                          />
                        </div>

                        <div className="two-column-grid">
                          <div className="form-group">
                            <label className="form-label">Category *</label>
                            <select
                              className="form-input"
                              value={category}
                              onChange={(e) => handleCategoryChange(e.target.value)}
                              disabled={Boolean(existingInventoryProduct)}
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
                            <label className="form-label">Barcode ID</label>
                            <input
                              type="text"
                              className="form-input"
                              value={barcode}
                              readOnly
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
                              readOnly={Boolean(existingInventoryProduct)}
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
                              readOnly={Boolean(existingInventoryProduct)}
                              required
                            />
                          </div>
                        </div>

                        <div className="scanner-inventory-fields">
                          <div className="form-group">
                            <label className="form-label">Storage Location</label>
                            <select
                              className="form-input"
                              value={location}
                              onChange={(e) => setLocation(e.target.value)}
                              disabled={Boolean(existingInventoryProduct)}
                            >
                              <option value="Fridge">Fridge</option>
                              <option value="Freezer">Freezer</option>
                              <option value="Pantry">Pantry</option>
                              <option value="Cabinet">Cabinet</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Package Size</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="e.g. 500g, 1 Liter"
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                              readOnly={Boolean(existingInventoryProduct)}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">{existingInventoryProduct ? 'Additional Quantity' : 'Number of Items'}</label>
                            <div className="quantity-stepper">
                              <button
                                type="button"
                                className="quantity-stepper-button"
                                aria-label="Decrease item count"
                                title="Decrease item count"
                                onClick={() => setQuantityCount((count) => String(Math.max(1, (parseInt(count, 10) || 1) - 1)))}
                              >
                                <Minus size={16} />
                              </button>
                              <input
                                type="number"
                                className="form-input quantity-stepper-input"
                                placeholder="1"
                                min="1"
                                step="1"
                                value={quantityCount}
                                onChange={(e) => setQuantityCount(e.target.value)}
                                aria-label="Number of items"
                                required
                              />
                              <button
                                type="button"
                                className="quantity-stepper-button"
                                aria-label="Increase item count"
                                title="Increase item count"
                                onClick={() => setQuantityCount((count) => String((parseInt(count, 10) || 1) + 1))}
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '10px 0', color: '#64748b', fontSize: '13px' }}>
                        Click <strong>Identify with AI</strong> or <strong>Enter Name Manually</strong> above to add this item to your inventory.
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Discard
                </button>
                {!isInventoryReview && (isRecognizedProduct || manualEntryMode || aiSuggestion) && (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={modalLoading || !name.trim()}
                  >
                    <Plus size={16} />
                    <span>Add to Inventory</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scanner;
