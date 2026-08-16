const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl   = require('../controllers/campaignController');

router.get(   '/',             authenticate, ctrl.listCampaigns);
router.post(  '/',             authenticate, requireRole('owner','admin','agent'), ctrl.createCampaign);
router.get(   '/:id',          authenticate, ctrl.getCampaign);
router.patch( '/:id',          authenticate, requireRole('owner','admin'), ctrl.updateCampaign);
router.delete('/:id',          authenticate, requireRole('owner','admin'), ctrl.deleteCampaign);
router.post(  '/:id/launch',   authenticate, requireRole('owner','admin','agent'), ctrl.launchCampaign);
router.post(  '/:id/pause',    authenticate, requireRole('owner','admin'), ctrl.pauseCampaign);
router.get(   '/:id/report',   authenticate, ctrl.getCampaignReport);
router.get(   '/:id/export',   authenticate, ctrl.exportCampaignCSV);

module.exports = router;
