const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/wabaController');

router.get(   '/',           authenticate, ctrl.listWabaAccounts);
router.get(   '/active',     authenticate, ctrl.getActiveWaba);
router.post(  '/connect',    authenticate, requireRole('owner', 'admin'), ctrl.connectWaba);
router.patch( '/:id',        authenticate, requireRole('owner', 'admin'), ctrl.updateWaba);
router.post(  '/:id/activate', authenticate, requireRole('owner', 'admin'), ctrl.activateWaba);
router.delete('/:id',        authenticate, requireRole('owner', 'admin'), ctrl.deleteWaba);
router.get(   '/:id/templates', authenticate, ctrl.listTemplates);
router.post(  '/:id/templates', authenticate, requireRole('owner', 'admin'), ctrl.createTemplate);
router.delete('/:id/templates/:name', authenticate, requireRole('owner', 'admin'), ctrl.deleteTemplate);

module.exports = router;
