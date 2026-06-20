import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const STORAGE_ROOT = process.env.OBJECT_STORAGE_PATH || path.join(process.cwd(), 'data', 'objects');
const SIGNING_SECRET = process.env.DOWNLOAD_SIGNING_SECRET || process.env.JWT_SECRET || 'development-only-download-secret';

export async function putObject({ tenantId, siteId, fileName, bytes, contentType = 'application/octet-stream' }) {
  const id = crypto.randomUUID();
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectKey = `${tenantId}/${siteId || 'shared'}/${id}-${safeName}`;
  if (process.env.S3_BUCKET) {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = s3Client(S3Client);
    await client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: objectKey,
      Body: bytes,
      ContentType: contentType,
      ServerSideEncryption: process.env.S3_SERVER_SIDE_ENCRYPTION || 'AES256',
    }));
    return { id, objectKey, provider: 's3', path: null };
  }
  const target = path.join(STORAGE_ROOT, ...objectKey.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, { flag: 'wx' });
  return { id, objectKey, provider: 'local-private', path: target };
}

export async function createSignedDownload({ objectKey, expiresInSeconds = 300 }) {
  if (process.env.S3_BUCKET) {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const expiresIn = Math.min(Math.max(expiresInSeconds, 30), 3600);
    const url = await getSignedUrl(s3Client(S3Client), new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: objectKey,
    }), { expiresIn });
    return { objectKey, provider: 's3', url, expires: Math.floor(Date.now() / 1000) + expiresIn };
  }
  const expires = Math.floor(Date.now() / 1000) + Math.min(Math.max(expiresInSeconds, 30), 3600);
  const payload = `${objectKey}:${expires}`;
  const signature = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
  return { objectKey, provider: 'local-private', expires, signature };
}

function s3Client(S3Client) {
  return new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: process.env.S3_ACCESS_KEY_ID ? {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    } : undefined,
  });
}

export function verifySignedDownload({ objectKey, expires, signature }) {
  if (!objectKey || !expires || !signature || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(`${objectKey}:${expires}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function readObject(objectKey) {
  const normalized = objectKey.split('/').map(segment => path.basename(segment)).join('/');
  if (normalized !== objectKey) throw new Error('Invalid object key');
  return fs.readFileSync(path.join(STORAGE_ROOT, ...objectKey.split('/')));
}
