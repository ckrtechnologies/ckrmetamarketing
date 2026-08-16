const router = require('express').Router();
const ctrl = require('../controllers/webhookController');

router.get( '/', ctrl.verify);
router.post('/', ctrl.receive);

module.exports = router;
