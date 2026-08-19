const router = require('express').Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/mediaController');

// Multer memory storage (file buffer is written to disk in controller)
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max limit
});

router.post('/', authenticate, upload.single('file'), ctrl.uploadMedia);
router.get('/', authenticate, ctrl.listMedia);
router.delete('/:filename', authenticate, ctrl.deleteMedia);

module.exports = router;
