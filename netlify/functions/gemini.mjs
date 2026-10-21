import { timingSafeEqual } from 'node:crypto';
import { generateText, GeminiError } from '../../scripts/lib/gemini-api.mjs';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const MAX_BYTES = 20000;
export const config = {
  path: '/api/gemini',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip', 'domain'], windowSize: 60, windowLimit: 10 },
};

export function createHandler({ env = key => Netlify.env.get(key), generate = generateText } = {}) {
  return async req => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
    const expected = env('GEMINI_ACCESS_TOKEN')?.trim();
    if (!expected) return json({ error: 'Private Gemini access has not been configured.', code: 'SETUP_REQUIRED' }, 503);
    const supplied = req.headers.get('authorization')?.replace(/^Bearer /, '') || '';
    const a = Buffer.from(expected); const b = Buffer.from(supplied);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: 'Private access is required.', code: 'UNAUTHORIZED' }, 401);
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: 'Send JSON.', code: 'CONTENT_TYPE' }, 415);
    if (Number(req.headers.get('content-length')) > MAX_BYTES) return json({ error: 'The request is too large.', code: 'TOO_LARGE' }, 413);
    let bytes = 0; const chunks = [];
    const reader = req.body?.getReader();
    if (!reader) return json({ error: 'Provide a prompt.', code: 'INVALID_JSON' }, 400);
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > MAX_BYTES) { await reader.cancel(); return json({ error: 'The request is too large.', code: 'TOO_LARGE' }, 413); }
        chunks.push(value);
      }
    } catch { return json({ error: 'The request could not be read.', code: 'INVALID_JSON' }, 400); }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json({ error: 'Send valid JSON.', code: 'INVALID_JSON' }, 400); }
    if (typeof body?.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 12000) return json({ error: 'Use a prompt between 1 and 12000 characters.', code: 'INVALID_PROMPT' }, 400);
    try {
      return json(await generate({ apiKey: env('GEMINI_API_KEY'), model: env('GEMINI_MODEL') || 'gemini-flash-latest', prompt: body.prompt, maxOutputTokens: 1536 }));
    } catch (error) {
      if (error instanceof GeminiError) return json({ error: error.message, code: error.code }, error.status);
      return json({ error: 'Gemini could not complete the request.', code: 'GEMINI_FAILED' }, 502);
    }
  };
}

export default createHandler();
