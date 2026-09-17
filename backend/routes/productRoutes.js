const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');

// Public Open Food Facts & AI barcode endpoints
router.get('/openfoodfacts/barcode/:barcode', productController.lookupOpenFoodFactsBarcode);
router.get('/openfoodfacts/search', productController.searchOpenFoodFacts);
router.post('/ai-identify', productController.identifyBarcodeWithAI);

// Secure remaining product routes with authMiddleware
router.use(authMiddleware);

router.get('/notifications', productController.getExpiringNotifications);
router.get('/', productController.getProducts);
router.post('/', productController.addProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
