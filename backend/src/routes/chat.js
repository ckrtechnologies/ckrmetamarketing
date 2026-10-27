const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/chatController');

router.get('/unread',                              authenticate, ctrl.getUnreadCount);
router.get('/conversations',                       authenticate, ctrl.listConversations);
router.post('/start',                              authenticate, ctrl.startConversation);
router.get('/conversations/:id',                   authenticate, ctrl.getConversation);
router.get('/conversations/:id/messages',          authenticate, ctrl.getMessages);
router.get('/conversations/:id/poll',              authenticate, ctrl.pollMessages);
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 50 * 1024 * 1024 } 
});

router.post('/conversations/:id/send',             authenticate, ctrl.sendReply);
router.post('/conversations/:id/send-media',       authenticate, upload.single('file'), ctrl.sendMediaReply);
router.post('/conversations/:id/send-template',    authenticate, ctrl.sendTemplateInChat);
router.post('/conversations/:id/close',            authenticate, ctrl.closeConversation);
router.post('/conversations/:id/assign',           authenticate, ctrl.assignConversation);

module.exports = router;
