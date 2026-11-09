export class GeminiError extends Error {
  constructor(message, status = 502, code = 'GEMINI_FAILED') {
    super(message); this.status = status; this.code = code;
  }
}

const BUSY = new Set([500, 502, 503, 504]);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Google often answers 503 when Gemini is overloaded. Retry busy answers a few
// times inside totalMs, so a passing hiccup does not look like a broken setup.
export async function generateText({ apiKey, prompt, model = 'gemini-flash-latest', fetchImpl = fetch, maxOutputTokens = 1536, totalMs = 25000, sleep = wait, now = Date.now }) {
  if (!apiKey?.trim()) throw new GeminiError('The Gemini API key is not configured.', 503, 'SETUP_REQUIRED');
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model)) throw new GeminiError('The Gemini model setting is invalid.', 503, 'MODEL_SETTING');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 80000) throw new GeminiError('Provide a non-empty prompt within the size limit.', 400, 'INVALID_PROMPT');
  const deadline = now() + totalMs;
  const pauses = [1500, 4000, 8000];
  let response; let lastBusy = '';
  for (let attempt = 0; ; attempt++) {
    response = null;
    try {
      response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens } }),
        signal: AbortSignal.timeout(Math.max(1000, deadline - now())),
      });
    } catch { lastBusy = 'no answer in time'; }
    if (response && !BUSY.has(response.status)) break;
    if (response) lastBusy = `HTTP ${response.status}${await reasonOf(response)}`;
    const pause = pauses[attempt];
    if (pause === undefined || now() + pause + 1000 > deadline) {
      throw new GeminiError(`Google's Gemini servers were busy (${lastBusy}) after ${attempt + 1} ${attempt ? 'tries' : 'try'}. This is on Google's side. Try again in a few minutes.`, 503, 'GEMINI_BUSY');
    }
    await sleep(pause);
  }
  if (!response.ok) {
    if (response.status === 429) throw new GeminiError('The Gemini API quota or rate limit was reached. Your chat subscription has separate access.', 429, 'GEMINI_QUOTA');
    const hint = response.status === 404 ? 'Check the model setting.' : 'Check the API key and that the Generative Language API is enabled for it.';
    throw new GeminiError(`Google rejected the Gemini request (HTTP ${response.status}${await reasonOf(response)}). ${hint}`, 502, 'GOOGLE_REJECTED');
  }
  let data;
  try { data = await response.json(); } catch { throw new GeminiError('Google returned an unreadable response.', 502, 'INVALID_RESPONSE'); }
  const text = data?.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('').trim();
  if (!text) throw new GeminiError('Gemini returned no text. The request may have been blocked or interrupted.', 502, 'EMPTY_RESPONSE');
  return { text, model, finishReason: data.candidates[0].finishReason || null };
}

// Report only Google's machine reason code, never its free text.
async function reasonOf(response) {
  try {
    const err = (await response.json())?.error || {};
    const detail = (err.details || []).find(d => typeof d?.reason === 'string')?.reason;
    const reason = [detail, err.status].find(r => typeof r === 'string' && /^[A-Z_]{1,60}$/.test(r));
    return reason ? ` ${reason}` : '';
  } catch { return ''; }
}
