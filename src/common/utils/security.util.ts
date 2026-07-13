import { createHmac, timingSafeEqual } from 'node:crypto';

export function createHmacHex(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function safeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
