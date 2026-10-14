import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Onboarding01Screen from '../features/onboarding/screens/Onboarding01Screen';
import Onboarding02Screen from '../features/onboarding/screens/Onboarding02Screen';
import Onboarding03Screen from '../features/onboarding/screens/Onboarding03Screen';

import { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

const OnboardingNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Onboarding01" component={Onboarding01Screen} />

      <Stack.Screen name="Onboarding02" component={Onboarding02Screen} />

      <Stack.Screen name="Onboarding03" component={Onboarding03Screen} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
