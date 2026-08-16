const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/wabaController');

router.get(   '/',           authenticate, ctrl.listWabaAccounts);
router.get(   '/active',     authenticate, ctrl.getActiveWaba);
router.post(  '/connect',    authenticate, requireRole('owner', 'admin'), ctrl.connectWaba);
router.post(  '/:id/activate', authenticate, requireRole('owner', 'admin'), ctrl.activateWaba);
router.delete('/:id',        authenticate, requireRole('owner', 'admin'), ctrl.deleteWaba);
router.get(   '/:id/templates', authenticate, ctrl.listTemplates);

module.exports = router;
