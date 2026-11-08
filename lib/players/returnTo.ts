/** Only a same-site Play path may be resumed after sign-in. Anything else stays on the profile. */
export function safeReturnPath(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 200) return null;
  let path = raw;
  for (let pass = 0; pass < 2; pass += 1) {
    if (!/%[0-9a-f]{2}/i.test(path)) break;
    try { path = decodeURIComponent(path); } catch { return null; }
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  if (/[\s\\]/.test(path) || path.includes('://') || path.includes('..') || path.includes('//')) return null;
  const pathname = path.split('?')[0];
  if (pathname !== '/play' && !pathname.startsWith('/play/')) return null;
  return path;
}
