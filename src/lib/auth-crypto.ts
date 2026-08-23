import { createHash, timingSafeEqual } from 'crypto';

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
