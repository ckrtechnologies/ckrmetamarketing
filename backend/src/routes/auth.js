const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

router.post('/register', ctrl.register);
router.post('/login',    ctrl.login);
router.get( '/me',       authenticate, ctrl.me);
router.post('/invite',   authenticate, requireRole('owner', 'admin'), ctrl.invite);

module.exports = router;
