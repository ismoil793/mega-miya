import crypto from 'crypto';

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

function encryptionKey(): Buffer {
  const encoded = process.env.AI_API_CREDENTIAL_ENCRYPTION_KEY;
  if (!encoded) throw new Error('AI_API_CREDENTIAL_ENCRYPTION_KEY is required to store LLM credentials');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('AI_API_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  return key;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion: 1,
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  if (secret.keyVersion !== 1) throw new Error(`Unsupported credential key version: ${secret.keyVersion}`);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(secret.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
