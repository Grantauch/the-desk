import { createHash } from 'node:crypto';

// The HTML is revalidated, but the public proxy lets browsers keep JS/CSS for hours.
// Derive each registered asset's address from its bytes on every page request, so
// even a client-only deployment gets a new address without a server restart.
export async function versionHtmlAssets(html, loadAsset) {
  const revisions = new Map();
  const pattern = /(\s)(src|href)=(["'])(\/[^"'?#]+\.(?:js|css))\3/g;
  const urls = new Set([...html.matchAll(pattern)].map(match => match[4]));
  await Promise.all([...urls].map(async (url) => {
    const bytes = await loadAsset(url);
    revisions.set(url, bytes == null ? null : createHash('sha256').update(bytes).digest('hex').slice(0, 16));
  }));
  return html.replace(pattern,
    (original, space, attribute, quote, url) => {
      const revision = revisions.get(url);
      return revision ? `${space}${attribute}=${quote}${url}?v=${revision}${quote}` : original;
    });
}
