/**
 * Focused tests for the persistent-authentication building blocks:
 *  - Local JWT decode + expiry detection (offline-safe session validation).
 *  - session.setAuth / getAuth / clearAuth persistence round-trip.
 *
 * These back the "stay logged in across app kill / recents swipe / reboot"
 * behaviour without needing a device: the token + minimal profile live in
 * AsyncStorage (mocked here) rather than memory.
 */
import { decodeJwt, isTokenExpired, getAccountTypeFromToken } from '../src/services/jwt';
import { session } from '../src/services/session';

// Build a JWT-shaped string (header.payload.signature) with a given payload.
// Minimal base64url encoder (test-only) so we don't depend on Node's Buffer or
// btoa types, which are absent under the React Native tsconfig.
const B64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const encode = (obj: object) => {
  const bytes = Array.from(JSON.stringify(obj), c => c.charCodeAt(0));
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : B64[b2 & 63];
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const makeJwt = (payload: object) =>
  `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.sig`;

describe('jwt helpers', () => {
  it('decodes the payload', () => {
    const token = makeJwt({ id: 7, account_type: 'agency', exp: 123 });
    expect(decodeJwt(token)).toMatchObject({ id: 7, account_type: 'agency' });
  });

  it('extracts the account type', () => {
    const token = makeJwt({ account_type: 'superAdmin', exp: 123 });
    expect(getAccountTypeFromToken(token)).toBe('superAdmin');
  });

  it('treats a future-expiry token as valid', () => {
    const token = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('treats a past-expiry token as expired', () => {
    const token = makeJwt({ exp: Math.floor(Date.now() / 1000) - 10 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('treats an unparseable token as expired (fail closed)', () => {
    expect(isTokenExpired('not-a-jwt')).toBe(true);
  });
});

describe('session persistence', () => {
  beforeEach(async () => {
    await session.clearAuth();
  });

  it('returns null when nothing is stored (fresh install -> login)', async () => {
    expect(await session.getAuth()).toBeNull();
  });

  it('round-trips token + minimal profile', async () => {
    await session.setAuth('token-abc', {
      id: 3,
      account_type: 'guard',
      full_name: 'Guard One',
    });
    const stored = await session.getAuth();
    expect(stored).not.toBeNull();
    expect(stored?.token).toBe('token-abc');
    expect(stored?.user).toMatchObject({
      id: 3,
      account_type: 'guard',
      full_name: 'Guard One',
    });
  });

  it('clearAuth removes persisted auth (logout -> login on reopen)', async () => {
    await session.setAuth('token-abc', { account_type: 'client' });
    await session.clearAuth();
    expect(await session.getAuth()).toBeNull();
  });

  it('only persists the minimal profile fields we declare', async () => {
    await session.setAuth('token-abc', {
      id: 3,
      account_type: 'guard',
      full_name: 'Guard One',
    });
    const stored = await session.getAuth();
    // The service contract stores only non-sensitive profile fields; there is
    // no password/credential key in the persisted shape.
    expect(Object.keys(stored?.user ?? {}).sort()).toEqual(
      ['account_type', 'full_name', 'id'].sort(),
    );
  });
});
