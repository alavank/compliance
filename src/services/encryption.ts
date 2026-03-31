import crypto from 'crypto';
const ALG = 'aes-256-gcm';
function getKey(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (!k || k.length !== 64) throw new Error('ENCRYPTION_KEY deve ter 64 chars hex');
  return Buffer.from(k, 'hex');
}
export function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALG, getKey(), iv);
  let enc = cipher.update(text, 'utf8', 'hex'); enc += cipher.final('hex');
  return { encrypted: enc, iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex') };
}
export function decrypt(encrypted: string, iv: string, authTag: string): string {
  const dec = crypto.createDecipheriv(ALG, getKey(), Buffer.from(iv, 'hex'));
  dec.setAuthTag(Buffer.from(authTag, 'hex'));
  let r = dec.update(encrypted, 'hex', 'utf8'); r += dec.final('utf8');
  return r;
}
