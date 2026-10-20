import React from 'react';

import './src/localization';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import AppAlert from './src/components/common/AppAlert';
import { AuthProvider } from './src/features/authentication/context/AuthContext';

const App = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
        {/* Global alert host: renders all app alerts above every screen. */}
        <AppAlert />
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;
