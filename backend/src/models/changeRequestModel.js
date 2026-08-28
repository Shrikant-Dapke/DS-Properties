import { query } from '../config/database.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';

const BASE_COLUMNS = `
  id, public_id, entity_type, entity_id, operation, requested_by,
  previous_state, proposed_state, status, required_approvers,
  version_tag, resolution_reason, created_at, updated_at, resolved_at
`;

function rowToRequest(row, approvals = []) {
  if (!row) return null;
  return {
    id: row.id,
    publicId: row.public_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation,
    requestedBy: row.requested_by,
    previousState: row.previous_state,
    proposedState: row.proposed_state,
    status: row.status,
    requiredApprovers: Array.isArray(row.required_approvers) ? row.required_approvers : [],
    versionTag: row.version_tag,
    resolutionReason: row.resolution_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    approvals: approvals.map((a) => ({
      id: a.id,
      adminUserId: a.admin_user_id,
      status: a.status,
      comment: a.comment,
      decidedAt: a.decided_at,
    })),
  };
}

export async function getActiveAdminIds() {
  const { rows } = await query(
    `SELECT id FROM users WHERE role = 'admin' AND is_active = true AND deleted_at IS NULL`,
  );
  return rows.map((r) => r.id);
}

export async function createChangeRequest({
  entityType,
  entityId,
  operation,
  requestedBy,
  previousState,
  proposedState,
  requiredApprovers,
  versionTag,
}) {
  const { rows } = await query(
    `INSERT INTO change_requests
       (entity_type, entity_id, operation, requested_by, previous_state, proposed_state,
        status, required_approvers, version_tag)
     VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8)
     RETURNING ${BASE_COLUMNS}`,
    [
      entityType,
      entityId ?? null,
      operation,
      requestedBy,
      previousState ?? null,
      proposedState,
      JSON.stringify(requiredApprovers),
      versionTag ?? null,
    ],
  );
  return rowToRequest(rows[0]);
}

export async function addApproval({ changeRequestId, adminUserId, status, comment }) {
  try {
    const { rows } = await query(
      `INSERT INTO change_approvals (change_request_id, admin_user_id, status, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING id, change_request_id, admin_user_id, status, comment, decided_at`,
      [changeRequestId, adminUserId, status, comment ?? null],
    );
    return {
      id: rows[0].id,
      adminUserId: rows[0].admin_user_id,
      status: rows[0].status,
      comment: rows[0].comment,
      decidedAt: rows[0].decided_at,
    };
  } catch (err) {
    if (err.code === '23505') {
      throw new ConflictError('This admin has already decided on the change request', 'DUPLICATE_APPROVAL');
    }
    throw err;
  }
}

export async function getApprovals(changeRequestId) {
  const { rows } = await query(
    `SELECT id, change_request_id, admin_user_id, status, comment, decided_at
     FROM change_approvals WHERE change_request_id = $1 ORDER BY decided_at ASC`,
    [changeRequestId],
  );
  return rows.map((a) => ({
    id: a.id,
    adminUserId: a.admin_user_id,
    status: a.status,
    comment: a.comment,
    decidedAt: a.decided_at,
  }));
}

// Lock the row for update inside the active transaction.
export async function getChangeRequestForUpdate(changeRequestId) {
  const { rows } = await query(
    `SELECT ${BASE_COLUMNS} FROM change_requests WHERE id = $1 FOR UPDATE`,
    [changeRequestId],
  );
  if (!rows[0]) throw new NotFoundError('Change request not found');
  return rowToRequest(rows[0]);
}

export async function getChangeRequestByPublicId(publicId) {
  const { rows } = await query(
    `SELECT ${BASE_COLUMNS} FROM change_requests WHERE public_id = $1`,
    [publicId],
  );
  if (!rows[0]) return null;
  const approvals = await getApprovals(rows[0].id);
  return rowToRequest(rows[0], approvals);
}

export async function setStatus(changeRequestId, status, resolutionReason = null) {
  const { rows } = await query(
    `UPDATE change_requests
     SET status = $2, resolution_reason = $3,
         resolved_at = CASE WHEN $2 IN ('APPROVED','REJECTED','CANCELLED') THEN now() ELSE resolved_at END
     WHERE id = $1
     RETURNING ${BASE_COLUMNS}`,
    [changeRequestId, status, resolutionReason ?? null],
  );
  return rowToRequest(rows[0]);
}

export async function listChangeRequests({ status, entityType, requestedBy, limit, offset }) {
  const where = [];
  const values = [];
  let idx = 1;
  if (status) {
    values.push(status);
    where.push(`cr.status = $${idx}`);
    idx += 1;
  }
  if (entityType) {
    values.push(entityType);
    where.push(`cr.entity_type = $${idx}`);
    idx += 1;
  }
  if (requestedBy) {
    values.push(requestedBy);
    where.push(`cr.requested_by = $${idx}`);
    idx += 1;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const listP = query(
    `SELECT cr.${BASE_COLUMNS}
       FROM change_requests cr
       ${whereSql}
       ORDER BY cr.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset],
  );
  const countP = query(
    `SELECT count(*)::int AS total FROM change_requests cr ${whereSql}`,
    values,
  );
  const [list, count] = await Promise.all([listP, countP]);

  const requests = await Promise.all(
    list.rows.map(async (row) => {
      const approvals = await getApprovals(row.id);
      return rowToRequest(row, approvals);
    }),
  );
  return { total: count.rows[0].total, rows: requests };
}
