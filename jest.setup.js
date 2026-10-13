/* eslint-env jest */
/**
 * Jest setup. Mocks AsyncStorage so components that touch persistent session
 * storage (AuthContext restoration) run without the native module. This mirrors
 * the behaviour the app has on a real device: a fresh install has no stored
 * auth, so session restoration resolves to "not authenticated".
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest').default,
);
