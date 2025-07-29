import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SyncService, SyncStatus, SyncResult } from '../services/SyncService';
import { AuthService } from '../services/AuthService';

interface SyncButtonProps {
  userId: number;
  onSyncComplete?: (result: SyncResult) => void;
  onSyncError?: (error: string) => void;
  style?: any;
}

export const SyncButton: React.FC<SyncButtonProps> = ({
  userId,
  onSyncComplete,
  onSyncError,
  style,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: false,
    isSyncing: false,
    lastSyncAt: null,
    pendingCount: 0,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [showStatusMessage, setShowStatusMessage] = useState(false);

  const syncService = SyncService.getInstance();
  const authService = AuthService.getInstance();

  useEffect(() => {
    initializeSyncService();
  }, []);

  useEffect(() => {
    if (isInitialized) {
      updateSyncStatus();
      // Update status every 30 seconds
      const interval = setInterval(updateSyncStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isInitialized, userId]);

  const initializeSyncService = async () => {
    try {
      await syncService.initialize();
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize sync service:', error);
      onSyncError?.('Failed to initialize sync service');
    }
  };

  const updateSyncStatus = async () => {
    try {
      const status = await syncService.getSyncStatus(userId);
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  };

  const handleSyncPress = async () => {
    if (!isInitialized || syncStatus.isSyncing) {
      return;
    }

    if (!syncStatus.isOnline) {
      Alert.alert(
        'No Internet Connection',
        'Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (syncStatus.pendingCount === 0) {
      Alert.alert(
        'Nothing to Sync',
        'All your health logs are already synced to the cloud.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Get current user credentials for Supabase authentication
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // For demo purposes, we'll use a placeholder password
      // In a real app, you'd implement secure password retrieval
      const password = 'demo-password';

      // Authenticate with Supabase first
      await syncService.authenticateWithSupabase(currentUser.email, password);

      // Update status to show syncing
      setSyncStatus(prev => ({ ...prev, isSyncing: true }));

      // Perform sync
      const result = await syncService.syncHealthLogs(userId);
      
      setLastSyncResult(result);
      setShowStatusMessage(true);

      // Hide status message after 5 seconds
      setTimeout(() => setShowStatusMessage(false), 5000);

      // Update sync status
      await updateSyncStatus();

      // Call success callback
      onSyncComplete?.(result);

      // Show success alert
      if (result.success) {
        const message = result.syncedCount > 0 
          ? `Successfully synced ${result.syncedCount} health log${result.syncedCount === 1 ? '' : 's'} to the cloud.`
          : 'All health logs are already synced.';
        
        if (result.failedCount > 0) {
          Alert.alert(
            'Partial Sync Complete',
            `${message}\n\n${result.failedCount} log${result.failedCount === 1 ? '' : 's'} failed to sync and will be retried later.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Sync Complete', message, [{ text: 'OK' }]);
        }
      } else {
        throw new Error('Sync failed');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      console.error('Sync error:', error);
      
      setLastSyncResult({
        success: false,
        syncedCount: 0,
        failedCount: syncStatus.pendingCount,
        errors: [{ localId: 0, error: errorMessage, retryable: true }],
      });
      setShowStatusMessage(true);
      setTimeout(() => setShowStatusMessage(false), 5000);

      // Call error callback
      onSyncError?.(errorMessage);

      // Show error alert
      Alert.alert(
        'Sync Failed',
        `Failed to sync health logs: ${errorMessage}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Retry', 
            onPress: () => handleRetrySync(),
          },
        ]
      );
    } finally {
      // Update status to show not syncing
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
    }
  };

  const handleRetrySync = async () => {
    try {
      setSyncStatus(prev => ({ ...prev, isSyncing: true }));
      
      const result = await syncService.retrySyncWithBackoff(userId, 3);
      
      setLastSyncResult(result);
      setShowStatusMessage(true);
      setTimeout(() => setShowStatusMessage(false), 5000);

      await updateSyncStatus();
      onSyncComplete?.(result);

      Alert.alert(
        'Retry Complete',
        `Successfully synced ${result.syncedCount} health log${result.syncedCount === 1 ? '' : 's'}.`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Retry failed';
      onSyncError?.(errorMessage);
      
      Alert.alert(
        'Retry Failed',
        `Failed to retry sync: ${errorMessage}`,
        [{ text: 'OK' }]
      );
    } finally {
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
    }
  };

  const getButtonText = () => {
    if (!isInitialized) {
      return 'Initializing...';
    }
    
    if (syncStatus.isSyncing) {
      return 'Syncing...';
    }
    
    if (!syncStatus.isOnline) {
      return 'Offline';
    }
    
    if (syncStatus.pendingCount === 0) {
      return 'All Synced';
    }
    
    return `Sync Now (${syncStatus.pendingCount})`;
  };

  const getButtonStyle = () => {
    // Return style object instead of className for test compatibility
    const baseStyle = {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };
    
    if (!isInitialized || syncStatus.isSyncing) {
      return { ...baseStyle, backgroundColor: '#9CA3AF' };
    }
    
    if (!syncStatus.isOnline) {
      return { ...baseStyle, backgroundColor: '#EF4444' };
    }
    
    if (syncStatus.pendingCount === 0) {
      return { ...baseStyle, backgroundColor: '#10B981' };
    }
    
    return { ...baseStyle, backgroundColor: '#3B82F6' };
  };

  const getStatusIndicator = () => {
    const indicatorStyle = {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    };

    if (!syncStatus.isOnline) {
      return (
        <View style={{ ...indicatorStyle, backgroundColor: '#EF4444' }} />
      );
    }
    
    if (syncStatus.pendingCount === 0) {
      return (
        <View style={{ ...indicatorStyle, backgroundColor: '#10B981' }} />
      );
    }
    
    return (
      <View style={{ ...indicatorStyle, backgroundColor: '#F59E0B' }} />
    );
  };

  const renderStatusMessage = () => {
    if (!showStatusMessage || !lastSyncResult) {
      return null;
    }

    const isSuccess = lastSyncResult.success;
    const messageStyle = {
      marginTop: 8,
      padding: 8,
      borderRadius: 4,
      borderLeftWidth: 4,
      backgroundColor: isSuccess ? '#F0FDF4' : '#FEF2F2',
      borderLeftColor: isSuccess ? '#10B981' : '#EF4444',
    };
    const textStyle = {
      color: isSuccess ? '#065F46' : '#991B1B',
    };

    return (
      <View style={messageStyle}>
        <Text style={{ ...textStyle, fontSize: 14, fontWeight: '500' }}>
          {isSuccess ? 'Sync Successful' : 'Sync Failed'}
        </Text>
        <Text style={{ ...textStyle, fontSize: 12, marginTop: 4 }}>
          {isSuccess 
            ? `${lastSyncResult.syncedCount} log${lastSyncResult.syncedCount === 1 ? '' : 's'} synced`
            : lastSyncResult.errors[0]?.error || 'Unknown error'
          }
        </Text>
      </View>
    );
  };

  return (
    <View style={[{ flex: 1 }, style]}>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handleSyncPress}
        disabled={!isInitialized || syncStatus.isSyncing || !syncStatus.isOnline}
        testID="sync-button"
      >
        {getStatusIndicator()}
        
        {syncStatus.isSyncing ? (
          <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
        ) : null}
        
        <Text style={{ color: 'white', fontWeight: '500', fontSize: 14 }}>
          {getButtonText()}
        </Text>
      </TouchableOpacity>
      
      {renderStatusMessage()}
      
      {/* Sync Statistics */}
      <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, color: '#6B7280' }}>
          Status: {syncStatus.isOnline ? 'Online' : 'Offline'}
        </Text>
        <Text style={{ fontSize: 12, color: '#6B7280' }}>
          Pending: {syncStatus.pendingCount}
        </Text>
      </View>
    </View>
  );
};