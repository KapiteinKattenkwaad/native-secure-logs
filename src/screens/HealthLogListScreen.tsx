import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HealthLogList } from '../components/HealthLogList';
import { SyncButton } from '../components/SyncButton';
import { HealthLogService } from '../services/HealthLogService';
import { DatabaseService } from '../services/DatabaseService';
import { AuthService } from '../services/AuthService';
import { useAuth } from '../contexts/AuthContext';
import { SyncResult } from '../services/SyncService';
import { HealthLog } from '../types';
import { MainStackParamList } from '../types/navigation';

type HealthLogListScreenProps = NativeStackScreenProps<MainStackParamList, 'HealthLogList'>;

export function HealthLogListScreen({ navigation }: HealthLogListScreenProps) {
  const { logout } = useAuth();
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [healthLogService, setHealthLogService] = useState<HealthLogService | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Initialize services and load data
  useEffect(() => {
    initializeServices();
  }, []);

  const initializeServices = async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const authService = AuthService.getInstance();
      const user = await authService.getCurrentUser();
      
      if (!user) {
        Alert.alert('Error', 'Please log in to access health logs');
        return;
      }
      
      setCurrentUser(user);
      
      // Initialize database and health log service
      const databaseService = DatabaseService.getInstance();
      await databaseService.initialize();
      
      const service = new HealthLogService(user.encryptionKey, databaseService);
      setHealthLogService(service);
      
      // Load health logs
      await loadHealthLogs(service, user.id);
    } catch (error) {
      Alert.alert('Error', 'Failed to initialize health log service');
      console.error('Service initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadHealthLogs = async (service?: HealthLogService, userId?: number) => {
    try {
      const serviceToUse = service || healthLogService;
      const userIdToUse = userId || currentUser?.id;
      
      if (!serviceToUse || !userIdToUse) return;
      
      const logs = await serviceToUse.getAllHealthLogs(userIdToUse);
      setHealthLogs(logs);
    } catch (error) {
      Alert.alert('Error', 'Failed to load health logs');
      console.error('Load health logs error:', error);
    }
  };

  const handleLogPress = (log: HealthLog) => {
    navigation.navigate('HealthLogDetail', { healthLog: log });
  };

  const handleDeleteLog = async (logId: string) => {
    if (!healthLogService || !currentUser) {
      Alert.alert('Error', 'Service not initialized');
      return;
    }

    try {
      // Find the database ID for the log to delete
      const databaseId = await findDatabaseIdForHealthLog(logId);
      if (!databaseId) {
        throw new Error('Health log not found in database');
      }

      await healthLogService.deleteHealthLog(databaseId);
      
      // Update the list immediately
      setHealthLogs(prev => prev.filter(log => log.id !== logId));
      
      Alert.alert('Success', 'Health log deleted successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete health log');
    }
  };

  const handleRefresh = useCallback(async () => {
    await loadHealthLogs();
  }, [healthLogService, currentUser]);

  const handleSyncComplete = useCallback((result: SyncResult) => {
    if (result.success) {
      setSyncMessage(`Successfully synced ${result.syncedCount} health log${result.syncedCount === 1 ? '' : 's'}`);
    } else {
      setSyncMessage('Sync completed with some errors');
    }
    
    // Clear message after 3 seconds
    setTimeout(() => setSyncMessage(null), 3000);
    
    // Refresh the list to show any updates
    loadHealthLogs();
  }, [loadHealthLogs]);

  const handleSyncError = useCallback((error: string) => {
    setSyncMessage(`Sync failed: ${error}`);
    
    // Clear message after 5 seconds
    setTimeout(() => setSyncMessage(null), 5000);
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  // Helper function to find database ID for a health log
  const findDatabaseIdForHealthLog = async (healthLogId: string): Promise<number | null> => {
    if (!currentUser) return null;
    
    try {
      const databaseService = DatabaseService.getInstance();
      const encryptedLogs = await databaseService.getHealthLogsByUserId(currentUser.id);
      
      for (const encryptedLog of encryptedLogs) {
        try {
          const decryptionResult = require('../services/EncryptionService').EncryptionService.decrypt(
            encryptedLog.encrypted_data, 
            currentUser.encryptionKey
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
            Health Logs
          </Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {currentUser && (
              <SyncButton
                userId={currentUser.id}
                onSyncComplete={handleSyncComplete}
                onSyncError={handleSyncError}
                style={{ marginRight: 8 }}
              />
            )}
            
            <TouchableOpacity
              onPress={handleLogout}
              style={{ backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 }}
            >
              <Text style={{ color: 'white', fontWeight: '500' }}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Sync Status Message */}
        {syncMessage && (
          <View style={{ marginTop: 8, backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4 }}>
            <Text style={{ color: 'white', fontSize: 14, textAlign: 'center' }}>{syncMessage}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <HealthLogList
          healthLogs={healthLogs}
          onLogPress={handleLogPress}
          onRefresh={handleRefresh}
          onDeleteLog={handleDeleteLog}
          isLoading={isLoading}
          showDeleteButton={true}
        />
        
        {/* Floating Action Button */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            backgroundColor: '#3B82F6',
            width: 56,
            height: 56,
            borderRadius: 28,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
          }}
          onPress={() => navigation.navigate('HealthLogForm', { mode: 'create' })}
        >
          <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>+</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}