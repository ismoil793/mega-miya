import { hashSessionToken, secureEqual } from './auth-crypto';

describe('authentication primitives', () => {
  it('hashes session tokens without retaining the original value', () => {
    const token = 'a-secret-session-token';
    const hash = hashSessionToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashSessionToken(token)).toBe(hash);
  });

  it('compares OAuth state values exactly', () => {
    expect(secureEqual('same-state', 'same-state')).toBe(true);
    expect(secureEqual('same-state', 'other-state')).toBe(false);
    expect(secureEqual('short', 'a-longer-value')).toBe(false);
  });
});
