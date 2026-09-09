const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/permission.middleware');
const { handleProfileImageUpload } = require('../middleware/upload.middleware');
const {
  getProfile,
  postProfile,
  updateProfile,
  uploadProfileImage,
  deleteProfileImage,
} = require('../controllers/profile.controller');
const { validateUpdateProfile } = require('../validators/profile.validator');

router.get('/profile', requirePermission('profile.view'), getProfile);
router.post('/profile', requirePermission('profile.edit'), validateUpdateProfile, postProfile);
router.put('/profile', requirePermission('profile.edit'), validateUpdateProfile, updateProfile);

// Profile photo — stored on disk, only the path is kept in Mongo.
router.post('/profile/image', requirePermission('profile.edit'), handleProfileImageUpload, uploadProfileImage);
router.delete('/profile/image', requirePermission('profile.edit'), deleteProfileImage);

module.exports = router;
