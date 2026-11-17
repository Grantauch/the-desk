import { randomBytes } from 'node:crypto';
import type { FastifyReply } from 'fastify';

export function secureStaffHtml(reply: FastifyReply): string {
  const nonce = randomBytes(18).toString('base64url');
  reply.header('content-type', 'text/html; charset=utf-8');
  reply.header('cache-control', 'no-store');
  reply.header('x-content-type-options', 'nosniff');
  reply.header('referrer-policy', 'no-referrer');
  reply.header('x-frame-options', 'DENY');
  reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  reply.header(
    'content-security-policy',
    [
      "default-src 'self'",
      `script-src 'nonce-${nonce}'`,
      "style-src 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  );
  return nonce;
}
