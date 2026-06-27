import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV recommended for GCM

export interface EncryptedPayload {
  iv: string;           // base64
  ciphertext: string;   // base64
  tag: string;          // base64
}

/**
 * Encrypt plaintext with a 32-byte DEK using AES-256-GCM.
 * Returns structured payload safe to store in DB as JSON/TEXT.
 */
export function encryptField(plaintext: string, dek: Buffer): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, dek, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return {
    iv:         iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag:        cipher.getAuthTag().toString('base64'),
  };
}

/**
 * Decrypt an EncryptedPayload back to plaintext.
 * Throws if the auth tag doesn't match (tamper detection).
 */
export function decryptField(payload: EncryptedPayload, dek: Buffer): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    dek,
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
