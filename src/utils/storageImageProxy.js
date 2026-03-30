/**
 * Firebase Storage logo URLs are often blocked by CORS for fetch()/html2canvas.
 * Production uses GET /api/inline-image (Cloudflare Worker) to stream the bytes with CORS.
 */

const ALLOWED_HOSTS = new Set(['firebasestorage.googleapis.com', 'storage.googleapis.com']);

export function isFirebaseStorageImageHost(hostname) {
  return ALLOWED_HOSTS.has(hostname || '');
}

/** Same-origin Worker URL to fetch a Storage image (or null if not applicable). */
export function storageProxyFetchUrl(originalUrl) {
  if (typeof window === 'undefined' || !originalUrl || typeof originalUrl !== 'string') return null;
  const t = originalUrl.trim();
  if (!t.startsWith('https://')) return null;
  try {
    const u = new URL(t);
    if (!isFirebaseStorageImageHost(u.hostname)) return null;
    const origin = window.location?.origin;
    if (!origin) return null;
    return `${origin}/api/inline-image?url=${encodeURIComponent(u.href)}`;
  } catch {
    return null;
  }
}

/** Try Worker proxy first, then direct URL (works locally if Storage CORS is configured). */
export async function fetchStorageImageBlob(url) {
  if (!url?.trim()) return null;
  const direct = url.trim();
  const proxy = storageProxyFetchUrl(direct);
  const candidates = proxy ? [proxy, direct] : [direct];
  const tried = new Set();
  for (const u of candidates) {
    if (tried.has(u)) continue;
    tried.add(u);
    try {
      const res = await fetch(u, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) continue;
      return await res.blob();
    } catch {
      /* try next */
    }
  }
  return null;
}
