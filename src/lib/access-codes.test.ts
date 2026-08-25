/** @jest-environment node */
import { hashAccessCode, isPlausibleAccessCode, normalizeAccessCode } from './access-codes';

describe('access-code primitives', () => {
  it('normalizes case and surrounding whitespace', () => {
    expect(normalizeAccessCode('  mm-abcd-efgh-jkmn-pqrs  ')).toBe('MM-ABCD-EFGH-JKMN-PQRS');
  });

  it('accepts only the generated, unambiguous code format', () => {
    expect(isPlausibleAccessCode('MM-ABCD-EFGH-JKMN-PQRS')).toBe(true);
    expect(isPlausibleAccessCode('MM-ABCD-EFGH-I0O1-PQRS')).toBe(false);
    expect(isPlausibleAccessCode('short')).toBe(false);
  });

  it('hashes deterministically without retaining the plaintext', () => {
    const code = 'MM-ABCD-EFGH-JKMN-PQRS';
    expect(hashAccessCode(code)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAccessCode(code)).toBe(hashAccessCode(code.toLowerCase()));
    expect(hashAccessCode(code)).not.toContain(code);
  });
});
