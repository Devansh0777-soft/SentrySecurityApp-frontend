import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'sentry.authToken';
const USER_KEY = 'sentry.authUser';
const PENDING_IDENTIFIER_KEY = 'sentry.pendingIdentifier';
const PENDING_MOBILE_KEY = 'sentry.pendingMobile';

/**
 * Minimal, non-sensitive user information required to restore a session and
 * route the user to the correct role dashboard after a cold start. Never store
 * passwords or plain-text credentials here — only the fields the backend login
 * / registration responses already return.
 */
export type StoredUser = {
  id?: number;
  account_type: string;
  full_name?: string;
  email?: string;
  mobile_number?: string;
};

type StoredAuth = {
  token: string;
  user: StoredUser | null;
};

export const session = {
  // --- Token (kept for backward compatibility with existing call sites) ---
  setToken: (token: string) => AsyncStorage.setItem(TOKEN_KEY, token),
  getToken: () => AsyncStorage.getItem(TOKEN_KEY),
  clearToken: () => AsyncStorage.removeItem(TOKEN_KEY),

  // --- Minimal user profile ---
  setUser: (user: StoredUser) =>
    AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
  getUser: async (): Promise<StoredUser | null> => {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      return null;
    }
  },
  clearUser: () => AsyncStorage.removeItem(USER_KEY),

  /**
   * Persist the authenticated session (token + minimal user) atomically. This
   * is what survives app termination, being swiped away from recents, and a
   * device reboot because it lives in AsyncStorage rather than memory.
   */
  setAuth: async (token: string, user: StoredUser) => {
    await AsyncStorage.setMany({
      [TOKEN_KEY]: token,
      [USER_KEY]: JSON.stringify(user),
    });
  },
  getAuth: async (): Promise<StoredAuth | null> => {
    const values = await AsyncStorage.getMany([TOKEN_KEY, USER_KEY]);
    const token = values[TOKEN_KEY] ?? null;
    const rawUser = values[USER_KEY] ?? null;
    if (!token) return null;
    let user: StoredUser | null = null;
    if (rawUser) {
      try {
        user = JSON.parse(rawUser) as StoredUser;
      } catch {
        user = null;
      }
    }
    return { token, user };
  },

  /** Clear all persisted authentication data (manual logout / invalid session). */
  clearAuth: () => AsyncStorage.removeMany([TOKEN_KEY, USER_KEY]),

  // --- Password-recovery flow (unchanged) ---
  setPendingIdentifier: (identifier: string) =>
    AsyncStorage.setItem(PENDING_IDENTIFIER_KEY, identifier),
  getPendingIdentifier: () => AsyncStorage.getItem(PENDING_IDENTIFIER_KEY),
  setPendingMobile: (mobile: string) =>
    AsyncStorage.setItem(PENDING_MOBILE_KEY, mobile),
  getPendingMobile: () => AsyncStorage.getItem(PENDING_MOBILE_KEY),
};

