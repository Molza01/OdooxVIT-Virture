const ocrService = require('../services/ocrService');

const scanReceipt = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No receipt file uploaded' });
    }

    const result = await ocrService.scanReceipt(req.file.path);

    res.json({
      ...result,
      receiptFilename: req.file.filename,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { scanReceipt };
