const router  = require('express').Router();
const multer  = require('multer');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl    = require('../controllers/contactController');

const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Groups
router.get(   '/groups',     authenticate, ctrl.listGroups);
router.post(  '/groups',     authenticate, requireRole('owner','admin','agent'), ctrl.createGroup);
router.patch( '/groups/:id', authenticate, requireRole('owner','admin'), ctrl.updateGroup);
router.delete('/groups/:id', authenticate, requireRole('owner','admin'), ctrl.deleteGroup);

// Contacts
router.get(   '/',            authenticate, ctrl.listContacts);
router.post(  '/',            authenticate, ctrl.createContact);
router.patch( '/:id',         authenticate, ctrl.updateContact);
router.delete('/:id',         authenticate, requireRole('owner','admin'), ctrl.deleteContact);

// CSV Import
router.post('/import-csv', authenticate, upload.single('file'), ctrl.importCSV);

module.exports = router;
