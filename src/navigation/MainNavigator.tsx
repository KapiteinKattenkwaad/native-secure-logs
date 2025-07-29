import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HealthLogListScreen } from '../screens/HealthLogListScreen';
import { HealthLogDetailScreen } from '../screens/HealthLogDetailScreen';
import { HealthLogFormScreen } from '../screens/HealthLogFormScreen';
import { MainStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName="HealthLogList"
    >
      <Stack.Screen 
        name="HealthLogList" 
        component={HealthLogListScreen}
        options={{
          title: 'Health Logs',
        }}
      />
      <Stack.Screen 
        name="HealthLogDetail" 
        component={HealthLogDetailScreen}
        options={{
          title: 'Health Log Details',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen 
        name="HealthLogForm" 
        component={HealthLogFormScreen}
        options={({ route }) => ({
          title: route.params.mode === 'create' ? 'Create Health Log' : 'Edit Health Log',
          animation: 'slide_from_bottom',
        })}
      />
    </Stack.Navigator>
  );
}