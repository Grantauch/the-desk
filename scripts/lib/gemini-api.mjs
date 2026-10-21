export class GeminiError extends Error {
  constructor(message, status = 502, code = 'GEMINI_FAILED') {
    super(message); this.status = status; this.code = code;
  }
}

export async function generateText({ apiKey, prompt, model = 'gemini-flash-latest', fetchImpl = fetch, maxOutputTokens = 1536 }) {
  if (!apiKey?.trim()) throw new GeminiError('The Gemini API key is not configured.', 503, 'SETUP_REQUIRED');
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model)) throw new GeminiError('The Gemini model setting is invalid.', 503, 'MODEL_SETTING');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 80000) throw new GeminiError('Provide a non-empty prompt within the size limit.', 400, 'INVALID_PROMPT');
  let response;
  try {
    response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens } }),
      signal: AbortSignal.timeout(25000),
    });
  } catch { throw new GeminiError('Gemini could not be reached in time. Try again later.', 504, 'UPSTREAM_UNAVAILABLE'); }
  if (!response.ok) {
    if (response.status === 429) throw new GeminiError('The Gemini API quota or rate limit was reached. Your chat subscription has separate access.', 429, 'GEMINI_QUOTA');
    throw new GeminiError('Google rejected the Gemini request. Check the API key, API access, and model setting.', 502, 'GOOGLE_REJECTED');
  }
  let data;
  try { data = await response.json(); } catch { throw new GeminiError('Google returned an unreadable response.', 502, 'INVALID_RESPONSE'); }
  const text = data?.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('').trim();
  if (!text) throw new GeminiError('Gemini returned no text. The request may have been blocked or interrupted.', 502, 'EMPTY_RESPONSE');
  return { text, model, finishReason: data.candidates[0].finishReason || null };
}
