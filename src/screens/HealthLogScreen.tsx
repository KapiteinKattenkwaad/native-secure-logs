import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  SafeAreaView,
} from 'react-native';
import { HealthLogList } from '../components/HealthLogList';
import { HealthLogForm } from '../components/HealthLogForm';
import { HealthLogDetail } from '../components/HealthLogDetail';
import { SyncButton } from '../components/SyncButton';
import { HealthLogService } from '../services/HealthLogService';
import { DatabaseService } from '../services/DatabaseService';
import { AuthService } from '../services/AuthService';
import { SyncResult } from '../services/SyncService';
import { HealthLog, CreateHealthLogData, UpdateHealthLogData } from '../types';

type ScreenMode = 'list' | 'create' | 'edit' | 'detail';

export const HealthLogScreen: React.FC = () => {
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<HealthLog | null>(null);
  const [screenMode, setScreenMode] = useState<ScreenMode>('list');
  const [isLoading, setIsLoading] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
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

  const handleCreateLog = async (data: CreateHealthLogData) => {
    if (!healthLogService || !currentUser) {
      Alert.alert('Error', 'Service not initialized');
      return;
    }

    try {
      setIsFormLoading(true);
      const newLog = await healthLogService.createHealthLog(currentUser.id, data);
      
      // Update the list immediately
      setHealthLogs(prev => [newLog, ...prev]);
      setScreenMode('list');
      
      Alert.alert('Success', 'Health log created successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create health log');
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleUpdateLog = async (data: UpdateHealthLogData) => {
    if (!healthLogService || !selectedLog || !currentUser) {
      Alert.alert('Error', 'Service not initialized or no log selected');
      return;
    }

    try {
      setIsFormLoading(true);
      
      // Find the database ID for the selected log
      const databaseId = await findDatabaseIdForHealthLog(selectedLog.id);
      if (!databaseId) {
        throw new Error('Health log not found in database');
      }

      const updatedLog = await healthLogService.updateHealthLog(databaseId, data);
      
      // Update the list immediately
      setHealthLogs(prev => prev.map(log => 
        log.id === selectedLog.id ? updatedLog : log
      ));
      
      setSelectedLog(updatedLog);
      setScreenMode('detail');
      
      Alert.alert('Success', 'Health log updated successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update health log');
    } finally {
      setIsFormLoading(false);
    }
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
      
      // If we're viewing the deleted log, go back to list
      if (selectedLog?.id === logId) {
        setSelectedLog(null);
        setScreenMode('list');
      }
      
      Alert.alert('Success', 'Health log deleted successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete health log');
    }
  };

  const handleLogPress = (log: HealthLog) => {
    setSelectedLog(log);
    setScreenMode('detail');
  };

  const handleEditPress = () => {
    if (selectedLog) {
      setScreenMode('edit');
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

  const renderHeader = () => (
    <View className="bg-blue-500 px-4 py-3">
      <View className="flex-row justify-between items-center">
        <Text className="text-white text-xl font-bold">
          {screenMode === 'list' && 'Health Logs'}
          {screenMode === 'create' && 'Create Health Log'}
          {screenMode === 'edit' && 'Edit Health Log'}
          {screenMode === 'detail' && 'Health Log Details'}
        </Text>
        
        <View className="flex-row items-center space-x-2">
          {screenMode === 'list' && currentUser && (
            <SyncButton
              userId={currentUser.id}
              onSyncComplete={handleSyncComplete}
              onSyncError={handleSyncError}
              className="mr-2"
            />
          )}
          
          {screenMode !== 'list' && (
            <TouchableOpacity
              onPress={() => {
                setScreenMode('list');
                setSelectedLog(null);
              }}
              className="bg-blue-600 px-3 py-1 rounded"
            >
              <Text className="text-white font-medium">Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Sync Status Message */}
      {syncMessage && (
        <View className="mt-2 bg-blue-600 px-3 py-2 rounded">
          <Text className="text-white text-sm text-center">{syncMessage}</Text>
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    switch (screenMode) {
      case 'list':
        return (
          <View className="flex-1">
            <HealthLogList
              healthLogs={healthLogs}
              onLogPress={handleLogPress}
              onRefresh={handleRefresh}
              onDeleteLog={handleDeleteLog}
              isLoading={isLoading}
              showDeleteButton={true}
            />
            <TouchableOpacity
              className="absolute bottom-6 right-6 bg-blue-500 w-14 h-14 rounded-full justify-center items-center shadow-lg"
              onPress={() => setScreenMode('create')}
            >
              <Text className="text-white text-2xl font-bold">+</Text>
            </TouchableOpacity>
          </View>
        );

      case 'create':
        return (
          <HealthLogForm
            onSubmit={handleCreateLog}
            onCancel={() => setScreenMode('list')}
            isLoading={isFormLoading}
          />
        );

      case 'edit':
        return selectedLog ? (
          <HealthLogForm
            initialData={selectedLog}
            onSubmit={handleUpdateLog}
            onCancel={() => setScreenMode('detail')}
            isLoading={isFormLoading}
          />
        ) : null;

      case 'detail':
        return selectedLog ? (
          <HealthLogDetail
            healthLog={selectedLog}
            onEdit={handleEditPress}
            onDelete={() => handleDeleteLog(selectedLog.id)}
            onClose={() => setScreenMode('list')}
          />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {renderHeader()}
      {renderContent()}
    </SafeAreaView>
  );
};