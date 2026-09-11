const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/permission.middleware');
const { handleClientImageUpload } = require('../middleware/upload.middleware');
const {
  getClient,
  getClientById,
  getClientStats,
  getClientPayments,
  postClient,
  updateClient,
  deleteClient,
  reactivateClient,
  getClientBilling,
  downloadClientBillingPdf,
  uploadClientImage,
  deleteClientImage,
} = require('../controllers/client.controller');
const { mongoIdParam } = require('../middleware/validate.middleware');
const {
  validateCreateClient,
  validateUpdateClient,
} = require('../validators/client.validator');

router.get('/client', requirePermission('clients.view'), getClient);
router.get('/client/:id', mongoIdParam, requirePermission('clients.view'), getClientById);
router.get('/client/:id/stats', mongoIdParam, requirePermission('clients.view'), getClientStats);
router.get('/client/:id/payments', mongoIdParam, requirePermission('clients.view'), getClientPayments);
router.get('/client/:id/billing', mongoIdParam, requirePermission('clients.billing'), getClientBilling);
router.post('/client/:id/billing/pdf', mongoIdParam, requirePermission('clients.billing'), downloadClientBillingPdf);

router.post('/client', requirePermission('clients.create'), validateCreateClient, postClient);
router.put('/client/:id', mongoIdParam, requirePermission('clients.edit'), validateUpdateClient, updateClient);
router.delete('/client/:id', mongoIdParam, requirePermission('clients.delete'), deleteClient);
router.put('/client/:id/reactivate', mongoIdParam, requirePermission('clients.edit'), reactivateClient);

// Client photo — stored on disk, only the path is kept in Mongo.
router.post('/client/:id/image', mongoIdParam, requirePermission('clients.edit'), handleClientImageUpload, uploadClientImage);
router.delete('/client/:id/image', mongoIdParam, requirePermission('clients.edit'), deleteClientImage);

module.exports = router;
