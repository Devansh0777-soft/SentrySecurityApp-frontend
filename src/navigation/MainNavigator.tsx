import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AgencyOverviewScreen from '../features/dashboard/screens/AgencyOverviewScreen';
import AgencyIncidentsScreen from '../features/dashboard/screens/AgencyIncidentsScreen';
import AgencySitesScreen from '../features/dashboard/screens/AgencySitesScreen';
import AgencyProfileScreen from '../features/dashboard/screens/AgencyProfileScreen';
import AgencyPlanScreen from '../features/dashboard/screens/AgencyPlanScreen';
import AgencyGuardsScreen from '../features/dashboard/screens/AgencyGuardsScreen';
import AgencyInvoicesScreen from '../features/dashboard/screens/AgencyInvoicesScreen';
import AgencyPayrollScreen from '../features/dashboard/screens/AgencyPayrollScreen';
import AgencyPayrollDetailsScreen from '../features/dashboard/screens/AgencyPayrollDetailsScreen';
import AgencyEventDetailsScreen from '../features/dashboard/screens/AgencyEventDetailsScreen';

import { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

const MainNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="AgencyOverview" component={AgencyOverviewScreen} />
      <Stack.Screen name="AgencyIncidents" component={AgencyIncidentsScreen} />
      <Stack.Screen name="AgencySites" component={AgencySitesScreen} />
      <Stack.Screen name="AgencyProfile" component={AgencyProfileScreen} />
      <Stack.Screen name="AgencyGuards" component={AgencyGuardsScreen} />
      <Stack.Screen name="AgencyPlan" component={AgencyPlanScreen} />
      <Stack.Screen name="AgencyInvoices" component={AgencyInvoicesScreen} />
      <Stack.Screen name="AgencyPayroll" component={AgencyPayrollScreen} />
      <Stack.Screen
        name="AgencyPayrollDetails"
        component={AgencyPayrollDetailsScreen}
      />
      <Stack.Screen
        name="AgencyEventDetails"
        component={AgencyEventDetailsScreen}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;
