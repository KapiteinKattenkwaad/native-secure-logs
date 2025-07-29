import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HealthLogForm } from '../components/HealthLogForm';
import { HealthLogService } from '../services/HealthLogService';
import { DatabaseService } from '../services/DatabaseService';
import { AuthService } from '../services/AuthService';
import { CreateHealthLogData, UpdateHealthLogData } from '../types';
import { MainStackParamList } from '../types/navigation';

type HealthLogFormScreenProps = NativeStackScreenProps<MainStackParamList, 'HealthLogForm'>;

export function HealthLogFormScreen({ navigation, route }: HealthLogFormScreenProps) {
  const { mode, healthLog } = route.params;
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: CreateHealthLogData | UpdateHealthLogData) => {
    try {
      setIsLoading(true);
      
      // Get current user and initialize services
      const authService = AuthService.getInstance();
      const user = await authService.getCurrentUser();
      
      if (!user) {
        Alert.alert('Error', 'Please log in to save health logs');
        return;
      }
      
      const databaseService = DatabaseService.getInstance();
      await databaseService.initialize();
      
      const healthLogService = new HealthLogService(user.encryptionKey, databaseService);
      
      if (mode === 'create') {
        await healthLogService.createHealthLog(user.id, data as CreateHealthLogData);
        Alert.alert('Success', 'Health log created successfully');
      } else if (mode === 'edit' && healthLog) {
        // Find the database ID for the health log
        const databaseId = await findDatabaseIdForHealthLog(healthLog.id, user);
        if (!databaseId) {
          throw new Error('Health log not found in database');
        }
        
        await healthLogService.updateHealthLog(databaseId, data as UpdateHealthLogData);
        Alert.alert('Success', 'Health log updated successfully');
      }
      
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save health log');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  // Helper function to find database ID for a health log
  const findDatabaseIdForHealthLog = async (healthLogId: string, user: any): Promise<number | null> => {
    try {
      const databaseService = DatabaseService.getInstance();
      const encryptedLogs = await databaseService.getHealthLogsByUserId(user.id);
      
      for (const encryptedLog of encryptedLogs) {
        try {
          const decryptionResult = require('../services/EncryptionService').EncryptionService.decrypt(
            encryptedLog.encrypted_data, 
            user.encryptionKey
          );
          if (decryptionResult.success) {
            const decryptedLog = JSON.parse(decryptionResult.decryptedData);
            if (decryptedLog.id === healthLogId) {
              return encryptedLog.id;
            }
          }
        } catch {
          // Skip corrupted logs
          continue;
        }
      }
      return null;
    } catch (error) {
      console.error('Error finding database ID for health log:', error);
      return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
            {mode === 'create' ? 'Create Health Log' : 'Edit Health Log'}
          </Text>
          
          <TouchableOpacity
            onPress={handleCancel}
            style={{ backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 }}
          >
            <Text style={{ color: 'white', fontWeight: '500' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <HealthLogForm
        initialData={healthLog}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isLoading}
      />
    </SafeAreaView>
  );
}