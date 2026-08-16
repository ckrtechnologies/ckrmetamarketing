const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/chatController');

router.get('/unread',                              authenticate, ctrl.getUnreadCount);
router.get('/conversations',                        authenticate, ctrl.listConversations);
router.get('/conversations/:id',                   authenticate, ctrl.getConversation);
router.get('/conversations/:id/messages',          authenticate, ctrl.getMessages);
router.get('/conversations/:id/poll',              authenticate, ctrl.pollMessages);
router.post('/conversations/:id/send',             authenticate, ctrl.sendReply);
router.post('/conversations/:id/close',            authenticate, ctrl.closeConversation);
router.post('/conversations/:id/assign',           authenticate, ctrl.assignConversation);

module.exports = router;
