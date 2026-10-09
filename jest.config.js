module.exports = {
  preset: '@react-native/jest-preset',
  // Backend tests are Node test-runner suites (node --test), not Jest suites.
  testPathIgnorePatterns: ['/node_modules/', '/SentrySecurityApp-backend/'],
  // The RN preset's default only transforms react-native* modules; the
  // @react-navigation packages ship untranspiled ESM under lib/module, which
  // Jest cannot parse without Babel. Keep the preset's scope and add them.
  transformIgnorePatterns: [
    'node_modules/(?!(?:jest-)?react-native|@react-native(?:-community)?|@react-navigation)',
  ],
  // react-native-sound's native module is not linked in the test environment.
  moduleNameMapper: {
    '^react-native-sound$': '<rootDir>/__mocks__/react-native-sound.js',
  },
};
