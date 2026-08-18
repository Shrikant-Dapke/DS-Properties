import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as crService from '../services/changeRequest.service.js';

export const create = asyncHandler(async (req, res) => {
  const cr = await crService.createChangeRequest({
    requestedBy: req.user._id,
    entityType: req.body.entityType,
    entityId: req.body.entityId || null,
    operation: req.body.operation,
    changes: req.body.changes,
  });
  success(res, cr, 'Change request created', 201);
});

export const list = asyncHandler(async (req, res) => {
  const items = await crService.listChangeRequests({ user: req.user });
  success(res, items, 'Change requests retrieved');
});

export const getOne = asyncHandler(async (req, res) => {
  const cr = await crService.getChangeRequest({
    id: req.params.id,
    user: req.user,
  });
  success(res, cr, 'Change request retrieved');
});

export const approve = asyncHandler(async (req, res) => {
  const cr = await crService.approveChangeRequest({
    requestId: req.params.id,
    approver: req.user,
  });
  success(res, cr, 'Change request approved');
});

export const reject = asyncHandler(async (req, res) => {
  const cr = await crService.rejectChangeRequest({
    requestId: req.params.id,
    rejector: req.user,
    reason: req.body.reason,
  });
  success(res, cr, 'Change request rejected');
});

export const cancel = asyncHandler(async (req, res) => {
  const cr = await crService.cancelChangeRequest({
    requestId: req.params.id,
    user: req.user,
  });
  success(res, cr, 'Change request cancelled');
});

export const resubmit = asyncHandler(async (req, res) => {
  const cr = await crService.resubmitChangeRequest({
    requestId: req.params.id,
    user: req.user,
  });
  success(res, cr, 'Change request resubmitted', 201);
});
