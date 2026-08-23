import { decryptSecret, encryptSecret } from './credential-crypto';

describe('credential encryption', () => {
  const originalKey = process.env.AI_API_CREDENTIAL_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.AI_API_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  afterAll(() => {
    if (originalKey) process.env.AI_API_CREDENTIAL_ENCRYPTION_KEY = originalKey;
    else delete process.env.AI_API_CREDENTIAL_ENCRYPTION_KEY;
  });

  it('round-trips a secret with randomized authenticated encryption', () => {
    const first = encryptSecret('sk-customer-secret');
    const second = encryptSecret('sk-customer-secret');

    expect(first.ciphertext).not.toBe('sk-customer-secret');
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(decryptSecret(first)).toBe('sk-customer-secret');
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptSecret('sk-customer-secret');
    encrypted.ciphertext = Buffer.from('tampered').toString('base64');
    expect(() => decryptSecret(encrypted)).toThrow();
  });
});
