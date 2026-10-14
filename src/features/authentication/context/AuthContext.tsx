import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { authService } from '../../../services/authService';
import { session, type StoredUser } from '../../../services/session';
import { isTokenExpired } from '../../../services/jwt';
import { onUnauthorized } from '../../../services/authEvents';
import {
  primeBootPrefetch,
  awaitBootPrefetch,
  clearBootPrefetch,
  type BootAccountType,
} from '../../../services/bootPrefetch';

type LoginArgs = { identifier: string; password: string };

export type AuthUser = StoredUser;

type AuthContextValue = {
  user: AuthUser | null;
  /** True only after a valid session (persisted or freshly logged in) is confirmed. */
  isAuthenticated: boolean;
  /** True while the initial session restoration is in progress. */
  isLoading: boolean;
  /** Convenience role for role-based navigation. */
  accountType: string | null;
  login: (args: LoginArgs) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  /**
   * The backend issues stateless JWTs and currently exposes no refresh-token
   * endpoint (verified in authRoutes.js). "Refreshing" therefore re-validates
   * the persisted token locally; if it has expired there is nothing to renew,
   * so the session is treated as invalid. Kept as a public API for future use.
   */
  refreshSession: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Tracks whether a valid session is currently active so protected 401s only
  // trigger a logout when there actually was a session to invalidate.
  const authenticatedRef = useRef(false);

  const setAuthenticated = (nextUser: AuthUser | null) => {
    authenticatedRef.current = Boolean(nextUser);
    setUser(nextUser);
  };

  /**
   * Restore the session from persistent storage on app launch. Fully offline
   * safe: validity is decided by decoding the persisted JWT locally, so we
   * never delete a potentially-valid session just because the network is down.
   */
  const restoreSession = useCallback(async (): Promise<boolean> => {
    try {
      const stored = await session.getAuth();
      if (!stored?.token) {
        setAuthenticated(null);
        return false;
      }
      // No refresh-token endpoint exists on the backend, so an expired token
      // cannot be renewed — clear it and require a fresh login.
      if (isTokenExpired(stored.token)) {
        await session.clearAuth();
        setAuthenticated(null);
        return false;
      }
      setAuthenticated(stored.user ?? null);
      return true;
    } catch {
      setAuthenticated(null);
      return false;
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    return restoreSession();
  }, [restoreSession]);

  const login = useCallback(async ({ identifier, password }: LoginArgs) => {
    const response = await authService.login(identifier, password);
    const profile = response.user ?? response.admin ?? { account_type: 'client' };
    setAuthenticated(profile as AuthUser);
  }, []);

  const logout = useCallback(async () => {
    // Call the (local) logout to clear persisted auth; the backend has no
    // revocation endpoint, so nothing else to call server-side.
    try {
      await authService.logout();
    } catch {
      // Even if clearing storage fails, drop in-memory state and force login.
    }
    // The navigation reset is driven by AppNavigator reacting to auth state,
    // which avoids racing the NavigationContainer's readiness.
    setAuthenticated(null);
    // Drop boot-prefetched data so a different login never sees stale cache.
    clearBootPrefetch();
  }, []);

/**
 * Boot orchestration on first mount:
 *  1. Restore the session from persistent storage (offline-safe: validity is
 *     decided by decoding the stored JWT locally, so a dead network never
 *     deletes a potentially-valid session).
 *  2. In parallel, prefetch the authenticated role's essential dashboard
 *     data via the same service calls the screens use (no duplicates).
 *  3. Hold the splash for its ~2s minimum, and longer if the prefetch is
 *     still in flight (capped by the prefetch timeout).
 */
const BOOT_MIN_MS = 2000;
const toBootAccount = (accountType?: string | null): BootAccountType => {
  switch (accountType) {
    case 'guard':
      return 'guard';
    case 'client':
      return 'client';
    case 'superAdmin':
      return 'superAdmin';
    default:
      return 'agency';
  }
};


  // Centralised handling of an invalidated session (protected request 401).
  useEffect(() => {
    return onUnauthorized(() => {
      if (!authenticatedRef.current) return;
      logout();
    });
  }, [logout]);

  // Cold-start boot: restore session + prefetch the role's dashboard data in
  // parallel, then release the splash gate. The gate releases only when BOTH
  // the ~2s splash minimum AND the (timeout-capped) prefetch finish — fast
  // boots still show the full progress bar; slow networks hold the splash.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const timer = new Promise<void>(resolve =>
        setTimeout(() => resolve(), BOOT_MIN_MS),
      );
      const work = (async () => {
        const restored = await restoreSession();
        if (restored) {
          try {
            const stored = await session.getAuth();
            const accountType = toBootAccount(stored?.user?.account_type);
            await primeBootPrefetch(accountType);
            await awaitBootPrefetch();
          } catch {
            // Prefetch is best-effort: dashboards fall back to their own
            // fetch and error UI.
          }
        } else {
          clearBootPrefetch();
        }
      })();
      await Promise.all([work, timer]);
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [restoreSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      accountType: user?.account_type ?? null,
      login,
      logout,
      restoreSession,
      refreshSession,
    }),
    [user, isLoading, login, logout, restoreSession, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

