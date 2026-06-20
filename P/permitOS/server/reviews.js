import crypto from 'crypto';

const DISCIPLINES = new Set(['counsel', 'professional-engineer', 'modeler', 'permitting-lead']);

export function assignReview(db, { siteId, artifactType, artifactId, discipline, reviewerUserId, reviewerName, dueAt, assignedBy }) {
  if (!DISCIPLINES.has(discipline)) throw httpError(400, 'Unsupported review discipline');
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO review_assignments
    (id, site_id, artifact_type, artifact_id, discipline, reviewer_user_id, reviewer_name, due_at, assigned_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, siteId, artifactType, artifactId, discipline, reviewerUserId || null, reviewerName, dueAt || null, assignedBy);
  return { id, siteId, artifactType, artifactId, discipline, reviewerUserId, reviewerName, dueAt, status: 'assigned' };
}

export function recordApproval(db, {
  assignmentId, siteId, artifactType, artifactId, discipline, reviewerUserId,
  reviewerName, reviewerLicense, decision, statement, artifactSha256,
}) {
  if (!['approved', 'rejected'].includes(decision)) throw httpError(400, 'Decision must be approved or rejected');
  const assignment = db.prepare('SELECT * FROM review_assignments WHERE id = ? AND site_id = ?').get(assignmentId, siteId);
  if (!assignment) throw httpError(404, 'Review assignment not found');
  if (assignment.status !== 'assigned') throw httpError(409, 'Review assignment already has a decision');
  if (!/^[a-f0-9]{64}$/i.test(String(artifactSha256 || ''))) throw httpError(400, 'A valid artifact SHA-256 is required');
  if (assignment.discipline !== discipline || assignment.artifact_type !== artifactType || assignment.artifact_id !== artifactId) {
    throw httpError(409, 'Approval does not match its assignment');
  }
  const previous = db.prepare('SELECT approval_hash FROM immutable_approvals WHERE site_id = ? ORDER BY created_at DESC, id DESC LIMIT 1').get(siteId);
  const id = crypto.randomUUID();
  const signedAt = new Date().toISOString();
  const approvalData = {
    id, assignmentId, siteId, artifactType, artifactId, discipline, reviewerUserId,
    reviewerName, reviewerLicense, decision, statement, artifactSha256, signedAt,
    previousApprovalHash: previous?.approval_hash || null,
  };
  const approvalHash = hashApproval(approvalData);
  db.transaction(() => {
    db.prepare(`INSERT INTO immutable_approvals
      (id, assignment_id, site_id, artifact_type, artifact_id, discipline, reviewer_user_id,
       reviewer_name, reviewer_license, decision, statement, artifact_sha256, previous_approval_hash, approval_hash, signed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, assignmentId, siteId, artifactType, artifactId, discipline, reviewerUserId || null,
        reviewerName, reviewerLicense || null, decision, statement || null, artifactSha256,
        previous?.approval_hash || null, approvalHash, signedAt);
    db.prepare('UPDATE review_assignments SET status = ?, completed_at = ? WHERE id = ?')
      .run(decision, signedAt, assignmentId);
  })();
  return { id, assignmentId, decision, signedAt, approvalHash, previousApprovalHash: previous?.approval_hash || null };
}

export function verifyApprovalChain(db, siteId) {
  const approvals = db.prepare('SELECT * FROM immutable_approvals WHERE site_id = ? ORDER BY created_at, id').all(siteId);
  let previous = null;
  for (const approval of approvals) {
    if ((approval.previous_approval_hash || null) !== previous) {
      return { valid: false, count: approvals.length, brokenAt: approval.id };
    }
    const recomputed = hashApproval({
      id: approval.id,
      assignmentId: approval.assignment_id,
      siteId: approval.site_id,
      artifactType: approval.artifact_type,
      artifactId: approval.artifact_id,
      discipline: approval.discipline,
      reviewerUserId: approval.reviewer_user_id,
      reviewerName: approval.reviewer_name,
      reviewerLicense: approval.reviewer_license,
      decision: approval.decision,
      statement: approval.statement,
      artifactSha256: approval.artifact_sha256,
      signedAt: approval.signed_at,
      previousApprovalHash: approval.previous_approval_hash,
    });
    if (recomputed !== approval.approval_hash) {
      return { valid: false, count: approvals.length, brokenAt: approval.id, reason: 'approval hash mismatch' };
    }
    previous = approval.approval_hash;
  }
  return { valid: true, count: approvals.length, head: previous };
}

function hashApproval(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
