import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  HealthLog,
  CreateHealthLogData,
  HealthLogCategory,
  SeverityLevel,
  HealthLogValidationError,
} from '../types';
import { validateHealthLogData } from '../utils/healthLogValidation';

interface HealthLogFormProps {
  initialData?: HealthLog;
  onSubmit: (data: CreateHealthLogData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const CATEGORIES: { value: HealthLogCategory; label: string }[] = [
  { value: 'symptom', label: 'Symptom' },
  { value: 'medication', label: 'Medication' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'measurement', label: 'Measurement' },
  { value: 'other', label: 'Other' },
];

const SEVERITY_LEVELS: { value: SeverityLevel; label: string }[] = [
  { value: 1, label: '1 - Very Mild' },
  { value: 2, label: '2 - Mild' },
  { value: 3, label: '3 - Moderate' },
  { value: 4, label: '4 - Severe' },
  { value: 5, label: '5 - Very Severe' },
];

export const HealthLogForm: React.FC<HealthLogFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<CreateHealthLogData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    category: initialData?.category || 'other',
    severity: initialData?.severity,
    tags: initialData?.tags || [],
    date: initialData?.date || new Date().toISOString().split('T')[0],
    notes: initialData?.notes || '',
    attachments: initialData?.attachments || [],
  });

  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<HealthLogValidationError[]>([]);
  const [showSeverity, setShowSeverity] = useState(
    initialData?.category === 'symptom' || formData.category === 'symptom'
  );

  useEffect(() => {
    setShowSeverity(formData.category === 'symptom');
    if (formData.category !== 'symptom') {
      setFormData(prev => ({ ...prev, severity: undefined }));
    }
  }, [formData.category]);

  const getFieldError = (fieldName: string): string | undefined => {
    return errors.find(error => error.field === fieldName)?.message;
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, trimmedTag],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const handleSubmit = async () => {
    // Clear previous errors
    setErrors([]);
    
    const validation = validateHealthLogData(formData);
    setErrors(validation.errors);

    if (!validation.isValid) {
      Alert.alert('Validation Error', 'Please fix the errors before submitting.');
      return;
    }

    try {
      await onSubmit(formData);
      // Form will be closed by parent component on success
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save health log';
      Alert.alert('Error', errorMessage);
      console.error('Health log form submission error:', error);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView className="flex-1 p-4">
        <View className="space-y-4">
          {/* Title */}
          <View>
            <Text className="text-lg font-semibold text-gray-800 mb-2">Title *</Text>
            <TextInput
              className={`border rounded-lg p-3 text-base ${
                getFieldError('title') ? 'border-red-500' : 'border-gray-300'
              }`}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              placeholder="Enter a title for your health log"
              maxLength={200}
              editable={!isLoading}
            />
            {getFieldError('title') && (
              <Text className="text-red-500 text-sm mt-1">{getFieldError('title')}</Text>
            )}
          </View>

          {/* Category */}
          <View>
            <Text className="text-lg font-semibold text-gray-800 mb-2">Category *</Text>
            <View className="flex-row flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  className={`px-4 py-2 rounded-full border ${
                    formData.category === category.value
                      ? 'bg-blue-500 border-blue-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setFormData(prev => ({ ...prev, category: category.value }))}
                  disabled={isLoading}
                >
                  <Text
                    className={`text-sm font-medium ${
                      formData.category === category.value ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {getFieldError('category') && (
              <Text className="text-red-500 text-sm mt-1">{getFieldError('category')}</Text>
            )}
          </View>

          {/* Severity (only for symptoms) */}
          {showSeverity && (
            <View>
              <Text className="text-lg font-semibold text-gray-800 mb-2">Severity</Text>
              <View className="space-y-2">
                {SEVERITY_LEVELS.map((level) => (
                  <TouchableOpacity
                    key={level.value}
                    className={`p-3 rounded-lg border ${
                      formData.severity === level.value
                        ? 'bg-red-50 border-red-300'
                        : 'bg-white border-gray-300'
                    }`}
                    onPress={() => setFormData(prev => ({ ...prev, severity: level.value }))}
                    disabled={isLoading}
                  >
                    <Text
                      className={`text-base ${
                        formData.severity === level.value ? 'text-red-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {level.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {getFieldError('severity') && (
                <Text className="text-red-500 text-sm mt-1">{getFieldError('severity')}</Text>
              )}
            </View>
          )}

          {/* Date */}
          <View>
            <Text className="text-lg font-semibold text-gray-800 mb-2">Date *</Text>
            <TextInput
              className={`border rounded-lg p-3 text-base ${
                getFieldError('date') ? 'border-red-500' : 'border-gray-300'
              }`}
              value={formData.date}
              onChangeText={(text) => setFormData(prev => ({ ...prev, date: text }))}
              placeholder="YYYY-MM-DD"
              editable={!isLoading}
            />
            {getFieldError('date') && (
              <Text className="text-red-500 text-sm mt-1">{getFieldError('date')}</Text>
            )}
          </View>

          {/* Description */}
          <View>
            <Text className="text-lg font-semibold text-gray-800 mb-2">Description *</Text>
            <TextInput
              className={`border rounded-lg p-3 text-base ${
                getFieldError('description') ? 'border-red-500' : 'border-gray-300'
              }`}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              placeholder="Describe your health log entry"
              multiline
              numberOfLines={4}
              maxLength={2000}
              editable={!isLoading}
            />
            {getFieldError('description') && (
              <Text className="text-red-500 text-sm mt-1">{getFieldError('description')}</Text>
            )}
          </View>

          {/* Tags */}
          <View>
            <Text className="text-lg font-semibold text-gray-800 mb-2">Tags</Text>
            <View className="flex-row mb-2">
              <TextInput
                className="flex-1 border border-gray-300 rounded-l-lg p-3 text-base"
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add a tag"
                maxLength={50}
                editable={!isLoading}
                onSubmitEditing={handleAddTag}
              />
              <TouchableOpacity
                className="bg-blue-500 px-4 rounded-r-lg justify-center"
                onPress={handleAddTag}
                disabled={isLoading || !tagInput.trim()}
              >
                <Text className="text-white font-medium">Add</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <View key={index} className="bg-gray-100 px-3 py-1 rounded-full flex-row items-center">
                  <Text className="text-gray-700 text-sm">{tag}</Text>
                  <TouchableOpacity
                    className="ml-2"
                    onPress={() => handleRemoveTag(tag)}
                    disabled={isLoading}
                  >
                    <Text className="text-gray-500 text-lg">×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            {getFieldError('tags') && (
              <Text className="text-red-500 text-sm mt-1">{getFieldError('tags')}</Text>
            )}
          </View>

          {/* Notes */}
          <View>
            <Text className="text-lg font-semibold text-gray-800 mb-2">Notes</Text>
            <TextInput
              className={`border rounded-lg p-3 text-base ${
                getFieldError('notes') ? 'border-red-500' : 'border-gray-300'
              }`}
              value={formData.notes}
              onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
              placeholder="Additional notes (optional)"
              multiline
              numberOfLines={3}
              maxLength={5000}
              editable={!isLoading}
            />
            {getFieldError('notes') && (
              <Text className="text-red-500 text-sm mt-1">{getFieldError('notes')}</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View className="p-4 border-t border-gray-200 bg-white">
        <View className="flex-row space-x-3">
          <TouchableOpacity
            className="flex-1 bg-gray-200 py-3 rounded-lg"
            onPress={onCancel}
            disabled={isLoading}
          >
            <Text className="text-center text-gray-700 font-medium text-base">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 rounded-lg ${
              isLoading ? 'bg-gray-400' : 'bg-blue-500'
            }`}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text className="text-center text-white font-medium text-base">
              {isLoading ? 'Saving...' : initialData ? 'Update' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};