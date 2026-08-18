import { success } from '../utils/response.js';
import * as crService from '../services/changeRequest.service.js';

export async function create(req, res, next) {
  try {
    const cr = await crService.createChangeRequest({
      requestedBy: req.user._id,
      entityType: req.body.entityType,
      entityId: req.body.entityId || null,
      operation: req.body.operation,
      changes: req.body.changes,
    });
    success(res, cr, 'Change request created', 201);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const items = await crService.listChangeRequests({ user: req.user });
    success(res, items, 'Change requests retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const cr = await crService.getChangeRequest({
      id: req.params.id,
      user: req.user,
    });
    success(res, cr, 'Change request retrieved');
  } catch (err) {
    next(err);
  }
}

export async function approve(req, res, next) {
  try {
    const cr = await crService.approveChangeRequest({
      requestId: req.params.id,
      approver: req.user,
    });
    success(res, cr, 'Change request approved');
  } catch (err) {
    next(err);
  }
}

export async function reject(req, res, next) {
  try {
    const cr = await crService.rejectChangeRequest({
      requestId: req.params.id,
      rejector: req.user,
      reason: req.body.reason,
    });
    success(res, cr, 'Change request rejected');
  } catch (err) {
    next(err);
  }
}

export async function cancel(req, res, next) {
  try {
    const cr = await crService.cancelChangeRequest({
      requestId: req.params.id,
      user: req.user,
    });
    success(res, cr, 'Change request cancelled');
  } catch (err) {
    next(err);
  }
}

export async function resubmit(req, res, next) {
  try {
    const cr = await crService.resubmitChangeRequest({
      requestId: req.params.id,
      user: req.user,
    });
    success(res, cr, 'Change request resubmitted', 201);
  } catch (err) {
    next(err);
  }
}
