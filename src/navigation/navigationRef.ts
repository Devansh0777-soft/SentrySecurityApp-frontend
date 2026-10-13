import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * A module-level navigation ref so imperative session handling (auto-logout on
 * a 401, session restoration on cold start) can reset the stack without needing
 * a React component instance. Attach it to the NavigationContainer in
 * AppNavigator.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Map a stored account_type to its protected root flow. */
export const routeForAccountType = (
  accountType?: string | null,
): keyof RootStackParamList => {
  switch (accountType) {
    case 'superAdmin':
      return 'SuperAdminFlow';
    case 'client':
      return 'ClientFlow';
    case 'guard':
      return 'GuardFlow';
    default:
      return 'MainFlow';
  }
};

/** Reset the whole stack to the user's role dashboard. */
export const resetToRoleFlow = (accountType?: string | null) => {
  if (!navigationRef.isReady()) return;
  navigationRef.reset({
    index: 0,
    routes: [{ name: routeForAccountType(accountType) }],
  });
};

/** Reset the whole stack back to the auth flow after logout / invalid session. */
export const resetToAuthFlow = () => {
  if (!navigationRef.isReady()) return;
  navigationRef.reset({
    index: 0,
    routes: [{ name: 'AuthFlow' }],
  });
};
