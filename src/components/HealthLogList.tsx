import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { HealthLog, HealthLogCategory } from '../types';

interface HealthLogListProps {
  healthLogs: HealthLog[];
  onLogPress: (log: HealthLog) => void;
  onRefresh?: () => Promise<void>;
  onDeleteLog?: (logId: string) => Promise<void>;
  isLoading?: boolean;
  showDeleteButton?: boolean;
}

interface HealthLogItemProps {
  log: HealthLog;
  onPress: () => void;
  onDelete?: () => void;
  showDeleteButton?: boolean;
}

const getCategoryColor = (category: HealthLogCategory): string => {
  switch (category) {
    case 'symptom':
      return 'bg-red-100 text-red-800';
    case 'medication':
      return 'bg-blue-100 text-blue-800';
    case 'appointment':
      return 'bg-green-100 text-green-800';
    case 'measurement':
      return 'bg-purple-100 text-purple-800';
    case 'other':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getSeverityColor = (severity?: number): string => {
  if (!severity) return '';
  
  switch (severity) {
    case 1:
      return 'bg-green-100 text-green-800';
    case 2:
      return 'bg-yellow-100 text-yellow-800';
    case 3:
      return 'bg-orange-100 text-orange-800';
    case 4:
      return 'bg-red-100 text-red-800';
    case 5:
      return 'bg-red-200 text-red-900';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
};

const HealthLogItem: React.FC<HealthLogItemProps> = ({
  log,
  onPress,
  onDelete,
  showDeleteButton = false,
}) => {
  const handleDelete = () => {
    if (!onDelete) return;
    
    Alert.alert(
      'Delete Health Log',
      'Are you sure you want to delete this health log? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDelete,
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      className="bg-white rounded-lg p-4 mb-3 shadow-sm border border-gray-100"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-lg font-semibold text-gray-900 flex-1 mr-2" numberOfLines={1}>
          {log.title}
        </Text>
        {showDeleteButton && onDelete && (
          <TouchableOpacity
            className="p-1"
            onPress={handleDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text className="text-red-500 text-lg">×</Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="flex-row items-center mb-2">
        <View className={`px-2 py-1 rounded-full mr-2 ${getCategoryColor(log.category)}`}>
          <Text className="text-xs font-medium capitalize">{log.category}</Text>
        </View>
        
        {log.severity && (
          <View className={`px-2 py-1 rounded-full mr-2 ${getSeverityColor(log.severity)}`}>
            <Text className="text-xs font-medium">Severity {log.severity}</Text>
          </View>
        )}
        
        <Text className="text-sm text-gray-500 ml-auto">{formatDate(log.date)}</Text>
      </View>

      <Text className="text-gray-700 text-sm mb-2" numberOfLines={2}>
        {log.description}
      </Text>

      {log.tags.length > 0 && (
        <View className="flex-row flex-wrap">
          {log.tags.slice(0, 3).map((tag, index) => (
            <View key={index} className="bg-gray-100 px-2 py-1 rounded mr-1 mb-1">
              <Text className="text-xs text-gray-600">#{tag}</Text>
            </View>
          ))}
          {log.tags.length > 3 && (
            <View className="bg-gray-100 px-2 py-1 rounded mb-1">
              <Text className="text-xs text-gray-600">+{log.tags.length - 3} more</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

export const HealthLogList: React.FC<HealthLogListProps> = ({
  healthLogs,
  onLogPress,
  onRefresh,
  onDeleteLog,
  isLoading = false,
  showDeleteButton = false,
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh health logs');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!onDeleteLog) return;
    
    try {
      await onDeleteLog(logId);
      // Success feedback is handled by the parent component
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete health log';
      Alert.alert('Error', errorMessage);
      console.error('Health log deletion error:', error);
    }
  };

  const renderItem = ({ item }: { item: HealthLog }) => (
    <HealthLogItem
      log={item}
      onPress={() => onLogPress(item)}
      onDelete={onDeleteLog ? () => handleDeleteLog(item.id) : undefined}
      showDeleteButton={showDeleteButton}
    />
  );

  const renderEmpty = () => (
    <View className="flex-1 justify-center items-center py-12">
      <Text className="text-gray-500 text-lg text-center mb-2">No health logs yet</Text>
      <Text className="text-gray-400 text-sm text-center px-8">
        Create your first health log to start tracking your health data
      </Text>
    </View>
  );

  const renderHeader = () => {
    if (healthLogs.length === 0) return null;
    
    return (
      <View className="mb-4">
        <Text className="text-gray-600 text-sm">
          {healthLogs.length} health log{healthLogs.length !== 1 ? 's' : ''}
        </Text>
      </View>
    );
  };

  if (isLoading && healthLogs.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-500 mt-2">Loading health logs...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={healthLogs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#3B82F6']}
              tintColor="#3B82F6"
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View className="h-1" />}
      />
    </View>
  );
};