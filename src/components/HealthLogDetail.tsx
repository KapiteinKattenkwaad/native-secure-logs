import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { HealthLog, HealthLogCategory } from '../types';

interface HealthLogDetailProps {
  healthLog: HealthLog;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  showActions?: boolean;
}

const getCategoryColor = (category: HealthLogCategory): string => {
  switch (category) {
    case 'symptom':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'medication':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'appointment':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'measurement':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'other':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getSeverityColor = (severity: number): string => {
  switch (severity) {
    case 1:
      return 'bg-green-100 text-green-800 border-green-200';
    case 2:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 3:
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 4:
      return 'bg-red-100 text-red-800 border-red-200';
    case 5:
      return 'bg-red-200 text-red-900 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getSeverityLabel = (severity: number): string => {
  switch (severity) {
    case 1:
      return 'Very Mild';
    case 2:
      return 'Mild';
    case 3:
      return 'Moderate';
    case 4:
      return 'Severe';
    case 5:
      return 'Very Severe';
    default:
      return 'Unknown';
  }
};

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
};

export const HealthLogDetail: React.FC<HealthLogDetailProps> = ({
  healthLog,
  onEdit,
  onDelete,
  onClose,
  showActions = true,
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
          onPress: async () => {
            try {
              await onDelete();
              // After successful deletion, close the detail view
              onClose();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete health log');
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row justify-between items-center">
          <TouchableOpacity onPress={onClose} className="p-1">
            <Text className="text-blue-500 text-lg">← Back</Text>
          </TouchableOpacity>
          {showActions && (
            <View className="flex-row space-x-3">
              {onEdit && (
                <TouchableOpacity onPress={onEdit} className="px-3 py-1">
                  <Text className="text-blue-500 font-medium">Edit</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity onPress={handleDelete} className="px-3 py-1">
                  <Text className="text-red-500 font-medium">Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Title */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900 mb-2">{healthLog.title}</Text>
          <Text className="text-gray-500 text-base">{formatDate(healthLog.date)}</Text>
        </View>

        {/* Category and Severity */}
        <View className="flex-row flex-wrap mb-6">
          <View className={`px-3 py-2 rounded-lg border mr-3 mb-2 ${getCategoryColor(healthLog.category)}`}>
            <Text className="font-medium capitalize">{healthLog.category}</Text>
          </View>
          
          {healthLog.severity && (
            <View className={`px-3 py-2 rounded-lg border mb-2 ${getSeverityColor(healthLog.severity)}`}>
              <Text className="font-medium">
                Severity {healthLog.severity} - {getSeverityLabel(healthLog.severity)}
              </Text>
            </View>
          )}
        </View>

        {/* Description */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-800 mb-3">Description</Text>
          <View className="bg-gray-50 rounded-lg p-4">
            <Text className="text-gray-700 text-base leading-6">{healthLog.description}</Text>
          </View>
        </View>

        {/* Tags */}
        {healthLog.tags.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-800 mb-3">Tags</Text>
            <View className="flex-row flex-wrap">
              {healthLog.tags.map((tag, index) => (
                <View key={index} className="bg-blue-50 border border-blue-200 px-3 py-2 rounded-full mr-2 mb-2">
                  <Text className="text-blue-700 text-sm font-medium">#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        {healthLog.notes && healthLog.notes.trim().length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-800 mb-3">Notes</Text>
            <View className="bg-gray-50 rounded-lg p-4">
              <Text className="text-gray-700 text-base leading-6">{healthLog.notes}</Text>
            </View>
          </View>
        )}

        {/* Attachments */}
        {healthLog.attachments && healthLog.attachments.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-800 mb-3">Attachments</Text>
            <View className="space-y-2">
              {healthLog.attachments.map((attachment, index) => (
                <View key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <Text className="text-gray-700 text-sm" numberOfLines={1}>
                    {attachment}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Metadata */}
        <View className="mt-8 pt-6 border-t border-gray-200">
          <Text className="text-sm text-gray-500 mb-1">Health Log ID</Text>
          <Text className="text-sm text-gray-700 font-mono">{healthLog.id}</Text>
        </View>
      </ScrollView>

      {/* Action Buttons (Alternative Layout) */}
      {showActions && (onEdit || onDelete) && (
        <View className="p-4 border-t border-gray-200 bg-white">
          <View className="flex-row space-x-3">
            {onEdit && (
              <TouchableOpacity
                className="flex-1 bg-blue-500 py-3 rounded-lg"
                onPress={onEdit}
              >
                <Text className="text-center text-white font-medium text-base">Edit</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                className="flex-1 bg-red-500 py-3 rounded-lg"
                onPress={handleDelete}
              >
                <Text className="text-center text-white font-medium text-base">Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};