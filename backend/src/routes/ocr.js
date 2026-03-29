const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const upload = require('../config/multer');
const ocrController = require('../controllers/ocrController');

const router = Router();

router.use(authenticate);

// POST /api/ocr/scan — upload a receipt image and get extracted data
router.post('/scan', upload.single('receipt'), ocrController.scanReceipt);

module.exports = router;
