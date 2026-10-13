import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import OnboardingNavigator from './OnboardingNavigator';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import SuperAdminScreen from '../features/superAdmin/screens/SuperAdminScreen';
import ClientPortalScreen from '../features/client/screens/ClientPortalScreen';
import GuardNavigator from './GuardNavigator';
import AuthLoadingScreen from '../features/authentication/screens/AuthLoadingScreen';
import { navigationRef, routeForAccountType } from './navigationRef';
import { useAuth } from '../features/authentication/context/AuthContext';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const { isLoading, isAuthenticated, accountType } = useAuth();
  const [navReady, setNavReady] = useState(false);
  // Whether the user has ever been authenticated during this app session; used
  // to decide the unauth destination: a returning user who logs out goes to the
  // AuthFlow, while a first-run user sees the onboarding flow.
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    if (isAuthenticated) wasAuthenticated.current = true;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!navReady || isLoading) return;
    if (isAuthenticated) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: routeForAccountType(accountType) }],
      });
    } else if (wasAuthenticated.current) {
      // User explicitly logged out or session was invalidated.
      navigationRef.reset({ index: 0, routes: [{ name: 'AuthFlow' }] });
    }
    // A first-run, never-authenticated user keeps the OnboardingFlow initial
    // route, so we intentionally do nothing in that case.
  }, [navReady, isLoading, isAuthenticated, accountType]);

  // Session-restoration gate: keep the loading screen mounted until we have
  // read persisted auth. This prevents onboarding/login from flashing before a
  // returning (already authenticated) user is routed to their dashboard.
  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => setNavReady(true)}
    >
      <Stack.Navigator
        initialRouteName="OnboardingFlow"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="OnboardingFlow" component={OnboardingNavigator} />
        <Stack.Screen name="AuthFlow" component={AuthNavigator} />
        <Stack.Screen name="MainFlow" component={MainNavigator} />
        <Stack.Screen name="SuperAdminFlow" component={SuperAdminScreen} />
        <Stack.Screen name="ClientFlow" component={ClientPortalScreen} />
        <Stack.Screen name="GuardFlow" component={GuardNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;


