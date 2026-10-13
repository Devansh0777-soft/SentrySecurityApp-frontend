/**
 * Lightweight JWT helpers used only to decide whether a *persisted* access
 * token is still valid on app launch. This is intentionally dependency-free
 * and fully offline: we decode the payload's `exp` locally so the app can
 * restore a session without a network round-trip, and never touch secrets.
 *
 * The backend issues signed JWTs (see authRoutes.js). We never verify the
 * signature on the client — the server always re-validates on every protected
 * request. These helpers are purely a UX gate to avoid flashing the login
 * screen for a token that is obviously expired.
 */

export type JwtPayload = {
  exp?: number;
  account_type?: string;
  id?: number;
  [key: string]: unknown;
};

/** Decode a base64url-encoded string into a UTF-8 string without atob/btoa. */
const decodeBase64Url = (input: string): string => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  );
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const char of padded) {
    if (char === '=') break;
    const value = chars.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  // Reconstruct UTF-8 text from the raw byte values.
  try {
    const bytes = Uint8Array.from(output, c => c.charCodeAt(0));
    // TextDecoder is available in the Hermes RN runtime; reference it
    // structurally to avoid depending on the global type being declared.
    type Decoder = { decode(input?: ArrayBufferView): string };
    const decoderCtor = (
      globalThis as unknown as {
        TextDecoder?: new (label?: string) => Decoder;
      }
    ).TextDecoder;
    if (decoderCtor) {
      return new decoderCtor('utf-8').decode(bytes);
    }
    return decodeURIComponent(
      Array.from(bytes)
        .map(b => `%${b.toString(16).padStart(2, '0')}`)
        .join(''),
    );
  } catch {
    return output;
  }
};

export const decodeJwt = (token: string): JwtPayload | null => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = decodeBase64Url(parts[1]);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
};

/**
 * Returns true if the token is expired (or unparseable). A small leeway
 * accounts for clock drift between device and server.
 */
export const isTokenExpired = (
  token: string,
  leewaySeconds = 30,
): boolean => {
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - leewaySeconds <= nowSeconds;
};

/** Best-effort role extraction from a JWT payload. */
export const getAccountTypeFromToken = (token: string): string | null => {
  const payload = decodeJwt(token);
  return typeof payload?.account_type === 'string'
    ? payload.account_type
    : null;
};
