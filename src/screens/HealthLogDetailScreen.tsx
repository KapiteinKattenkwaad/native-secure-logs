import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HealthLogDetail } from '../components/HealthLogDetail';
import { MainStackParamList } from '../types/navigation';

type HealthLogDetailScreenProps = NativeStackScreenProps<MainStackParamList, 'HealthLogDetail'>;

export function HealthLogDetailScreen({ navigation, route }: HealthLogDetailScreenProps) {
  const { healthLog } = route.params;

  const handleEdit = () => {
    navigation.navigate('HealthLogForm', { 
      mode: 'edit', 
      healthLog 
    });
  };

  const handleDelete = async (logId: string) => {
    Alert.alert(
      'Delete Health Log',
      'Are you sure you want to delete this health log? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            // Navigate back to list and let the list screen handle the deletion
            navigation.goBack();
            // Note: In a real implementation, we'd need to pass the delete action
            // back to the list screen or use a global state management solution
          }
        }
      ]
    );
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
            Health Log Details
          </Text>
          
          <TouchableOpacity
            onPress={handleClose}
            style={{ backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 }}
          >
            <Text style={{ color: 'white', fontWeight: '500' }}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <HealthLogDetail
        healthLog={healthLog}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClose={handleClose}
      />
    </SafeAreaView>
  );
}