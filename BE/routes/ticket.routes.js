const express = require('express');
const router = express.Router();

const {
  getTickets,
  getTicketById,
  getTicketFormMeta,
  createTicket,
  updateTicket,
  deleteTicket,
  assignEmployee,
  completeTicket,
  finalizeTicket,
  getTicketComments,
  addTicketComment,
} = require('../controllers/ticket.controller');
const { requirePermission } = require('../middleware/permission.middleware');
const { attachTicketTypes } = require('../middleware/ticketType.middleware');
const { mongoIdParam, validateCustom } = require('../middleware/validate.middleware');
const {
  validateCreateTicket,
  validateUpdateTicket,
  validateAssignEmployee,
  validateComment,
} = require('../validators/ticket.validator');

router.get('/ticket', requirePermission('tickets.view'), getTickets);
router.get('/ticket/form-meta', requirePermission('tickets.view'), getTicketFormMeta);
router.post('/ticket', requirePermission('tickets.create'), attachTicketTypes('active'), validateCustom(validateCreateTicket), createTicket);
router.get('/ticket/:id', mongoIdParam, requirePermission('tickets.view'), getTicketById);
router.put('/ticket/:id', mongoIdParam, requirePermission('tickets.edit'), attachTicketTypes('all'), validateCustom(validateUpdateTicket), updateTicket);
// PATCH is the same handler as PUT — this codebase updates a resource with
// whatever subset of fields is sent either way, so there's no separate
// "full replace" semantics for PUT to diverge from.
router.patch('/ticket/:id', mongoIdParam, requirePermission('tickets.edit'), attachTicketTypes('all'), validateCustom(validateUpdateTicket), updateTicket);
router.delete('/ticket/:id', mongoIdParam, requirePermission('tickets.delete'), deleteTicket);
router.put('/ticket/:id/assign', mongoIdParam, requirePermission('tickets.assign'), validateAssignEmployee, assignEmployee);
router.put('/ticket/:id/complete', mongoIdParam, requirePermission('tickets.complete'), completeTicket);
router.put('/ticket/:id/finalize', mongoIdParam, requirePermission('tickets.finalize'), finalizeTicket);
router.get('/ticket/:id/comments', mongoIdParam, requirePermission('tickets.view'), getTicketComments);
router.post('/ticket/:id/comments', mongoIdParam, requirePermission('tickets.comment'), validateComment, addTicketComment);

module.exports = router;
