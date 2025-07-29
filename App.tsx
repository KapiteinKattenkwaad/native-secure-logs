import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AuthProvider } from './src/contexts/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <View style={{ flex: 1 }}>
        <RootNavigator />
        <StatusBar style="auto" />
      </View>
    </AuthProvider>
  );
}
