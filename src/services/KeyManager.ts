import * as SecureStore from 'expo-secure-store';
import { EncryptionService } from './EncryptionService';

export interface KeyResult {
  key?: string;
  success: boolean;
  error?: string;
}

/**
 * KeyManager handles secure key generation and storage using Expo SecureStore
 * Implements requirements 3.1, 3.2, 3.3 for secure key management
 */
export class KeyManager {
  private static readonly USER_KEY_PREFIX = 'user_encryption_key_';
  private static readonly MASTER_KEY = 'master_encryption_key';
  private static readonly SALT_KEY = 'encryption_salt';

  /**
   * Generates and stores a new encryption key for a user
   * @param userId - The user ID to associate with the key
   * @returns KeyResult with success status and optional error
   */
  static async generateAndStoreUserKey(userId: string): Promise<KeyResult> {
    try {
      if (!userId) {
        return {
          success: false,
          error: 'User ID is required for key generation'
        };
      }

      // Generate a new encryption key
      const encryptionKey = EncryptionService.generateKey();
      
      // Store the key securely
      const keyName = `${this.USER_KEY_PREFIX}${userId}`;
      await SecureStore.setItemAsync(keyName, encryptionKey);

      return {
        key: encryptionKey,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate and store user key: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Retrieves a user's encryption key from secure storage
   * @param userId - The user ID to retrieve the key for
   * @returns KeyResult with the key or error
   */
  static async getUserKey(userId: string): Promise<KeyResult> {
    try {
      if (!userId) {
        return {
          success: false,
          error: 'User ID is required to retrieve key'
        };
      }

      const keyName = `${this.USER_KEY_PREFIX}${userId}`;
      const key = await SecureStore.getItemAsync(keyName);

      if (!key) {
        return {
          success: false,
          error: 'No encryption key found for user'
        };
      }

      return {
        key,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve user key: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Derives and stores a key from user password
   * @param userId - The user ID
   * @param password - The user's password
   * @returns KeyResult with success status
   */
  static async deriveAndStoreKeyFromPassword(userId: string, password: string): Promise<KeyResult> {
    try {
      if (!userId || !password) {
        return {
          success: false,
          error: 'User ID and password are required'
        };
      }

      // Get or generate salt
      let salt = await SecureStore.getItemAsync(`${this.SALT_KEY}_${userId}`);
      if (!salt) {
        salt = EncryptionService.generateKey();
        await SecureStore.setItemAsync(`${this.SALT_KEY}_${userId}`, salt);
      }

      // Derive key from password
      const derivedKey = EncryptionService.deriveKey(password, salt, 10000);
      
      // Store the derived key
      const keyName = `${this.USER_KEY_PREFIX}${userId}`;
      await SecureStore.setItemAsync(keyName, derivedKey);

      return {
        key: derivedKey,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to derive and store key: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Removes a user's encryption key from secure storage
   * @param userId - The user ID whose key should be removed
   * @returns Success status
   */
  static async removeUserKey(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!userId) {
        return {
          success: false,
          error: 'User ID is required to remove key'
        };
      }

      const keyName = `${this.USER_KEY_PREFIX}${userId}`;
      const saltName = `${this.SALT_KEY}_${userId}`;
      
      await SecureStore.deleteItemAsync(keyName);
      await SecureStore.deleteItemAsync(saltName);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to remove user key: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Checks if a user has an encryption key stored
   * @param userId - The user ID to check
   * @returns Boolean indicating if key exists
   */
  static async hasUserKey(userId: string): Promise<boolean> {
    try {
      if (!userId) return false;
      
      const keyName = `${this.USER_KEY_PREFIX}${userId}`;
      const key = await SecureStore.getItemAsync(keyName);
      return key !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Rotates a user's encryption key (generates new key and returns old one for re-encryption)
   * @param userId - The user ID whose key should be rotated
   * @returns Object with old and new keys
   */
  static async rotateUserKey(userId: string): Promise<{
    oldKey?: string;
    newKey?: string;
    success: boolean;
    error?: string;
  }> {
    try {
      if (!userId) {
        return {
          success: false,
          error: 'User ID is required for key rotation'
        };
      }

      // Get the current key
      const currentKeyResult = await this.getUserKey(userId);
      if (!currentKeyResult.success) {
        return {
          success: false,
          error: 'Cannot rotate key: No existing key found'
        };
      }

      // Generate new key
      const newKeyResult = await this.generateAndStoreUserKey(userId);
      if (!newKeyResult.success) {
        return {
          success: false,
          error: 'Failed to generate new key during rotation'
        };
      }

      return {
        oldKey: currentKeyResult.key,
        newKey: newKeyResult.key,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Key rotation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validates that SecureStore is available on the current platform
   * @returns Boolean indicating if SecureStore is available
   */
  static async isSecureStoreAvailable(): Promise<boolean> {
    try {
      return await SecureStore.isAvailableAsync();
    } catch (error) {
      return false;
    }
  }
}