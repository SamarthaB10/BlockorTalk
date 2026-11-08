/**
 * Access to /insights is one shared secret (TELL_INSIGHTS_SECRET), typed once. The cookie holds an
 * HMAC of the secret, never the secret, so a copied cookie does not reveal it and rotating the
 * secret signs everyone out. With no secret configured nothing ever matches.
 */
export const INSIGHTS_COOKIE = 'tell_insights';
export const COOKIE_SECONDS = 7 * 24 * 60 * 60;

const encoder = new TextEncoder();

/** Hex HMAC-SHA256 of a fixed message, keyed by the secret. Always 64 characters. */
export async function accessToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode('tell-insights-access-v1'));
  return [...new Uint8Array(mac)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Compares equal-length strings without stopping at the first difference. */
export function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export function readCookie(request: Request): string | null {
  return request.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${INSIGHTS_COOKIE}=([a-f0-9]{64})(?:;|$)`))?.[1] ?? null;
}

export async function isAuthorized(request: Request, secret: string | undefined): Promise<boolean> {
  if (!secret) return false;
  const given = readCookie(request);
  return given !== null && sameText(given, await accessToken(secret));
}

export async function secretMatches(submitted: string, secret: string | undefined): Promise<boolean> {
  if (!secret || !submitted) return false;
  return sameText(await accessToken(submitted), await accessToken(secret));
}

export function sessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${INSIGHTS_COOKIE}=${token}; Path=/; Max-Age=${COOKIE_SECONDS}; HttpOnly; SameSite=Strict${secure}`;
}
