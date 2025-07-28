import { EncryptionService, EncryptionResult, DecryptionResult } from '../services/EncryptionService';
import { KeyManager } from '../services/KeyManager';

export interface SecureStorageResult<T = any> {
  data?: T;
  success: boolean;
  error?: string;
}

/**
 * SecureStorage utility for handling encrypted local data operations
 * Implements requirements 3.1, 3.2, 3.3, 3.4, 3.5 for secure data handling
 */
export class SecureStorage {
  /**
   * Encrypts and stores data for a specific user
   * @param userId - The user ID
   * @param data - The data to encrypt and store
   * @returns SecureStorageResult with success status
   */
  static async encryptAndStore<T>(userId: string, data: T): Promise<SecureStorageResult> {
    try {
      if (!userId || data === undefined || data === null) {
        return {
          success: false,
          error: 'User ID and data are required'
        };
      }

      // Get user's encryption key
      const keyResult = await KeyManager.getUserKey(userId);
      if (!keyResult.success || !keyResult.key) {
        return {
          success: false,
          error: 'Failed to retrieve encryption key'
        };
      }

      // Serialize data to JSON string
      const jsonData = JSON.stringify(data);

      // Encrypt the data
      const encryptionResult: EncryptionResult = EncryptionService.encrypt(jsonData, keyResult.key);
      
      if (!encryptionResult.success) {
        return {
          success: false,
          error: encryptionResult.error || 'Encryption failed'
        };
      }

      // Clear sensitive data from memory
      EncryptionService.clearSensitiveData(keyResult.key);
      EncryptionService.clearSensitiveData(jsonData);

      return {
        data: encryptionResult.encryptedData,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Secure storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Retrieves and decrypts data for a specific user
   * @param userId - The user ID
   * @param encryptedData - The encrypted data to decrypt
   * @returns SecureStorageResult with decrypted data
   */
  static async retrieveAndDecrypt<T>(userId: string, encryptedData: string): Promise<SecureStorageResult<T>> {
    try {
      if (!userId || !encryptedData) {
        return {
          success: false,
          error: 'User ID and encrypted data are required'
        };
      }

      // Get user's encryption key
      const keyResult = await KeyManager.getUserKey(userId);
      if (!keyResult.success || !keyResult.key) {
        return {
          success: false,
          error: 'Failed to retrieve encryption key'
        };
      }

      // Decrypt the data
      const decryptionResult: DecryptionResult = EncryptionService.decrypt(encryptedData, keyResult.key);
      
      if (!decryptionResult.success) {
        // Clear sensitive data from memory
        EncryptionService.clearSensitiveData(keyResult.key);
        return {
          success: false,
          error: decryptionResult.error || 'Decryption failed'
        };
      }

      // Parse JSON data
      let parsedData: T;
      try {
        parsedData = JSON.parse(decryptionResult.decryptedData);
      } catch (parseError) {
        // Clear sensitive data from memory
        EncryptionService.clearSensitiveData(keyResult.key);
        EncryptionService.clearSensitiveData(decryptionResult.decryptedData);
        return {
          success: false,
          error: 'Failed to parse decrypted data'
        };
      }

      // Clear sensitive data from memory
      EncryptionService.clearSensitiveData(keyResult.key);
      EncryptionService.clearSensitiveData(decryptionResult.decryptedData);

      return {
        data: parsedData,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Secure retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Encrypts data with a provided key (for batch operations)
   * @param data - The data to encrypt
   * @param encryptionKey - The encryption key to use
   * @returns SecureStorageResult with encrypted data
   */
  static encryptWithKey<T>(data: T, encryptionKey: string): SecureStorageResult {
    try {
      if (data === undefined || data === null || !encryptionKey) {
        return {
          success: false,
          error: 'Data and encryption key are required'
        };
      }

      // Serialize data to JSON string
      const jsonData = JSON.stringify(data);

      // Encrypt the data
      const encryptionResult: EncryptionResult = EncryptionService.encrypt(jsonData, encryptionKey);
      
      if (!encryptionResult.success) {
        return {
          success: false,
          error: encryptionResult.error || 'Encryption failed'
        };
      }

      // Clear sensitive data from memory
      EncryptionService.clearSensitiveData(jsonData);

      return {
        data: encryptionResult.encryptedData,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Encryption with key failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Decrypts data with a provided key (for batch operations)
   * @param encryptedData - The encrypted data to decrypt
   * @param encryptionKey - The encryption key to use
   * @returns SecureStorageResult with decrypted data
   */
  static decryptWithKey<T>(encryptedData: string, encryptionKey: string): SecureStorageResult<T> {
    try {
      if (!encryptedData || !encryptionKey) {
        return {
          success: false,
          error: 'Encrypted data and encryption key are required'
        };
      }

      // Decrypt the data
      const decryptionResult: DecryptionResult = EncryptionService.decrypt(encryptedData, encryptionKey);
      
      if (!decryptionResult.success) {
        return {
          success: false,
          error: decryptionResult.error || 'Decryption failed'
        };
      }

      // Parse JSON data
      let parsedData: T;
      try {
        parsedData = JSON.parse(decryptionResult.decryptedData);
      } catch (parseError) {
        // Clear sensitive data from memory
        EncryptionService.clearSensitiveData(decryptionResult.decryptedData);
        return {
          success: false,
          error: 'Failed to parse decrypted data'
        };
      }

      // Clear sensitive data from memory
      EncryptionService.clearSensitiveData(decryptionResult.decryptedData);

      return {
        data: parsedData,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Decryption with key failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validates that encrypted data can be successfully decrypted
   * @param userId - The user ID
   * @param encryptedData - The encrypted data to validate
   * @returns Boolean indicating if data is valid
   */
  static async validateEncryptedData(userId: string, encryptedData: string): Promise<boolean> {
    try {
      const result = await this.retrieveAndDecrypt(userId, encryptedData);
      return result.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Re-encrypts data with a new key (for key rotation)
   * @param userId - The user ID
   * @param encryptedData - The data encrypted with old key
   * @param oldKey - The old encryption key
   * @param newKey - The new encryption key
   * @returns SecureStorageResult with re-encrypted data
   */
  static reEncryptData(
    encryptedData: string,
    oldKey: string,
    newKey: string
  ): SecureStorageResult {
    try {
      if (!encryptedData || !oldKey || !newKey) {
        return {
          success: false,
          error: 'Encrypted data, old key, and new key are required'
        };
      }

      // Decrypt with old key
      const decryptResult = EncryptionService.decrypt(encryptedData, oldKey);
      if (!decryptResult.success) {
        return {
          success: false,
          error: 'Failed to decrypt with old key'
        };
      }

      // Encrypt with new key
      const encryptResult = EncryptionService.encrypt(decryptResult.decryptedData, newKey);
      if (!encryptResult.success) {
        // Clear sensitive data
        EncryptionService.clearSensitiveData(decryptResult.decryptedData);
        return {
          success: false,
          error: 'Failed to encrypt with new key'
        };
      }

      // Clear sensitive data from memory
      EncryptionService.clearSensitiveData(decryptResult.decryptedData);

      return {
        data: encryptResult.encryptedData,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Re-encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}