const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/permission.middleware');
const { getProfile, postProfile, updateProfile } = require('../controllers/profile.controller');
const { validateUpdateProfile } = require('../validators/profile.validator');

router.get('/profile', requirePermission('profile.view'), getProfile);
router.post('/profile', requirePermission('profile.edit'), validateUpdateProfile, postProfile);
router.put('/profile', requirePermission('profile.edit'), validateUpdateProfile, updateProfile);

module.exports = router;
