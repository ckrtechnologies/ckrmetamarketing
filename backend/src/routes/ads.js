const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/adsController');

// ── Ad Accounts ─────────────────────────────────────────────────
router.get('/accounts',          authenticate, ctrl.listAdAccounts);
router.post('/accounts',         authenticate, ctrl.connectAdAccount);
router.patch('/accounts/:id',    authenticate, ctrl.updateAdAccount);
router.delete('/accounts/:id',   authenticate, ctrl.disconnectAdAccount);

// Fetch ad accounts from Meta (for connect flow)
router.get('/meta-accounts',     authenticate, ctrl.listMetaAdAccounts);

// Facebook Pages (needed for ad creative)
router.get('/pages',             authenticate, ctrl.listPages);

// ── Campaigns ────────────────────────────────────────────────────
router.get('/campaigns',                    authenticate, ctrl.listCampaigns);
router.post('/campaigns',                   authenticate, ctrl.createCampaign);
router.patch('/campaigns/:id',              authenticate, ctrl.updateCampaign);
router.delete('/campaigns/:id',             authenticate, ctrl.deleteCampaign);
router.get('/campaigns/:id/insights',       authenticate, ctrl.getCampaignInsights);

// Full publish wizard (Campaign + AdSet + Creative + Ad in one shot)
router.post('/publish',                     authenticate, ctrl.publishCampaign);

// ── Ad Sets ──────────────────────────────────────────────────────
router.get('/adsets',            authenticate, ctrl.listAdSets);
router.post('/adsets',           authenticate, ctrl.createAdSet);

// ── Ads ──────────────────────────────────────────────────────────
router.get('/ads',               authenticate, ctrl.listAds);

// ── Insights Dashboard ────────────────────────────────────────────
router.get('/insights',          authenticate, ctrl.getAccountInsights);

// ── Audiences ────────────────────────────────────────────────────
router.get('/audiences',             authenticate, ctrl.listAudiences);
router.post('/audiences/custom',     authenticate, ctrl.createCustomAudience);
router.post('/audiences/lookalike',  authenticate, ctrl.createLookalikeAudience);
router.post('/audiences/saved',      authenticate, ctrl.createSavedAudience);
router.delete('/audiences/:id',      authenticate, ctrl.deleteAudience);
router.get('/interests',             authenticate, ctrl.searchInterests);


module.exports = router;
