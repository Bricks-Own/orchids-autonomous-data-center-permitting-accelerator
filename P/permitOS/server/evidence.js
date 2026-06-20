import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { putObject, createSignedDownload } from './storage.js';
import { extractText, scanBytes } from './fileInspection.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export async function storeEvidence(db, { tenantId, siteId, userId, category, title, source, asOf, mimeType, fileName, contentBase64 }) {
  if (!ALLOWED_MIME.has(mimeType)) throw httpError(400, `Unsupported evidence type: ${mimeType}`);
  const bytes = Buffer.from(contentBase64 || '', 'base64');
  if (!bytes.length) throw httpError(400, 'Evidence file is empty');
  if (bytes.length > MAX_FILE_BYTES) throw httpError(413, 'Evidence file exceeds 10 MB');
  const id = crypto.randomUUID();
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const scan = await scanBytes(bytes, fileName);
  if (scan.status === 'infected') throw httpError(422, 'Evidence file failed malware scan');
  const extraction = await extractText(bytes, mimeType, fileName);
  const object = await putObject({ tenantId, siteId, fileName, bytes, contentType: mimeType });

  db.prepare(`INSERT INTO evidence_items
    (id, site_id, uploaded_by, category, title, source, as_of, mime_type, file_name, storage_path, byte_length, sha256,
     object_key, malware_status, extraction_status, extracted_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, siteId, userId, category, title, source, asOf, mimeType, fileName, object.path, bytes.length, sha256,
      object.objectKey, scan.status, extraction.status, extraction.text || null);

  return {
    id, category, title, source, asOf, mimeType, fileName, byteLength: bytes.length, sha256,
    objectKey: object.objectKey, malwareStatus: scan.status, extractionStatus: extraction.status,
    extractedCharacters: extraction.text?.length || 0,
  };
}

export function listEvidence(db, siteId) {
  return db.prepare(`SELECT id, category, title, source, as_of as asOf, mime_type as mimeType,
    file_name as fileName, byte_length as byteLength, sha256, object_key as objectKey,
    malware_status as malwareStatus, extraction_status as extractionStatus,
    length(extracted_text) as extractedCharacters, created_at as createdAt
    FROM evidence_items WHERE site_id = ? ORDER BY created_at DESC`).all(siteId);
}

export async function signedEvidenceDownload(db, siteId, evidenceId) {
  const item = db.prepare('SELECT object_key, file_name FROM evidence_items WHERE id = ? AND site_id = ?').get(evidenceId, siteId);
  if (!item?.object_key) throw httpError(404, 'Evidence object not found');
  return { ...(await createSignedDownload({ objectKey: item.object_key })), fileName: item.file_name };
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
