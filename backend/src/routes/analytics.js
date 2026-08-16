const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.get('/all',                  authenticate, ctrl.getAll);
router.get('/overview',             authenticate, ctrl.getOverview);
router.get('/funnel',               authenticate, ctrl.getFunnel);
router.get('/daily-messages',       authenticate, ctrl.getDailyMessages);
router.get('/daily-campaigns',      authenticate, ctrl.getDailyCampaigns);
router.get('/top-templates',        authenticate, ctrl.getTopTemplates);
router.get('/campaign-performance', authenticate, ctrl.getCampaignPerformance);

module.exports = router;
