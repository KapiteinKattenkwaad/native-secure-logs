import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { LoginCredentials } from '../types/auth';
import { AuthStackParamList } from '../types/navigation';

type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: LoginScreenProps) {
  const { state, login, clearError } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<LoginCredentials>>({});

  // Clear errors when component mounts or when auth error changes
  useEffect(() => {
    if (state.error) {
      clearError();
    }
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginCredentials> = {};

    if (!credentials.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!credentials.password.trim()) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await login(credentials);
      // Navigation is handled by the root navigator based on auth state
    } catch (error) {
      // Error is handled by the AuthContext
      console.error('Login error:', error);
    }
  };

  const handleInputChange = (field: keyof LoginCredentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Clear auth error when user starts typing
    if (state.error) {
      clearError();
    }
  };

  return (
    <KeyboardAvoidingView 
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-8">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900 text-center mb-2">
              Welcome Back
            </Text>
            <Text className="text-gray-600 text-center">
              Sign in to access your health logs
            </Text>
          </View>

          {/* Error Message */}
          {state.error && (
            <View className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <Text className="text-red-700 text-sm">{state.error}</Text>
            </View>
          )}

          {/* Email Input */}
          <View className="mb-4">
            <Text className="text-gray-700 text-sm font-medium mb-2">
              Email Address
            </Text>
            <TextInput
              className={`w-full px-4 py-3 border rounded-lg text-gray-900 ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your email"
              value={credentials.email}
              onChangeText={(value) => handleInputChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!state.isLoading}
            />
            {errors.email && (
              <Text className="text-red-500 text-sm mt-1">{errors.email}</Text>
            )}
          </View>

          {/* Password Input */}
          <View className="mb-6">
            <Text className="text-gray-700 text-sm font-medium mb-2">
              Password
            </Text>
            <TextInput
              className={`w-full px-4 py-3 border rounded-lg text-gray-900 ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your password"
              value={credentials.password}
              onChangeText={(value) => handleInputChange('password', value)}
              secureTextEntry
              editable={!state.isLoading}
            />
            {errors.password && (
              <Text className="text-red-500 text-sm mt-1">{errors.password}</Text>
            )}
          </View>

          {/* Login Button */}
          <TouchableOpacity
            className={`w-full py-3 rounded-lg mb-4 ${
              state.isLoading 
                ? 'bg-blue-300' 
                : 'bg-blue-600'
            }`}
            onPress={handleLogin}
            disabled={state.isLoading}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {state.isLoading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {/* Register Link */}
          <View className="flex-row justify-center">
            <Text className="text-gray-600">Don't have an account? </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Register')}
              disabled={state.isLoading}
            >
              <Text className="text-blue-600 font-semibold">Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}