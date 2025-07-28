import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

export default function App() {
  return (
    <View className="flex-1 bg-white items-center justify-center">
      <Text className="text-lg font-semibold text-gray-800">Health Log App</Text>
      <Text className="text-sm text-gray-600 mt-2">Project structure initialized successfully!</Text>
      <StatusBar style="auto" />
    </View>
  );
}
