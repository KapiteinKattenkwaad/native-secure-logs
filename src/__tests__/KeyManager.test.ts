import { KeyManager } from '../services/KeyManager';
import { mockSecureStore } from './setup';

describe('KeyManager', () => {
  const testUserId = 'test-user-123';
  const testPassword = 'user-password-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAndStoreUserKey', () => {
    it('should generate and store a new key successfully', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      
      const result = await KeyManager.generateAndStoreUserKey(testUserId);
      
      expect(result.success).toBe(true);
      expect(result.key).toBeDefined();
      expect(typeof result.key).toBe('string');
      expect(result.error).toBeUndefined();
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        `user_encryption_key_${testUserId}`,
        result.key
      );
    });

    it('should return error when userId is empty', async () => {
      const result = await KeyManager.generateAndStoreUserKey('');
      
      expect(result.success).toBe(false);
      expect(result.key).toBeUndefined();
      expect(result.error).toBe('User ID is required for key generation');
      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should handle SecureStore errors', async () => {
      const errorMessage = 'SecureStore error';
      mockSecureStore.setItemAsync.mockRejectedValue(new Error(errorMessage));
      
      const result = await KeyManager.generateAndStoreUserKey(testUserId);
      
      expect(result.success).toBe(false);
      expect(result.key).toBeUndefined();
      expect(result.error).toContain('Failed to generate and store user key');
      expect(result.error).toContain(errorMessage);
    });
  });

  describe('getUserKey', () => {
    const testKey = 'stored-encryption-key';

    it('should retrieve existing user key successfully', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(testKey);
      
      const result = await KeyManager.getUserKey(testUserId);
      
      expect(result.success).toBe(true);
      expect(result.key).toBe(testKey);
      expect(result.error).toBeUndefined();
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        `user_encryption_key_${testUserId}`
      );
    });

    it('should return error when userId is empty', async () => {
      const result = await KeyManager.getUserKey('');
      
      expect(result.success).toBe(false);
      expect(result.key).toBeUndefined();
      expect(result.error).toBe('User ID is required to retrieve key');
      expect(mockSecureStore.getItemAsync).not.toHaveBeenCalled();
    });

    it('should return error when no key is found', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      
      const result = await KeyManager.getUserKey(testUserId);
      
      expect(result.success).toBe(false);
      expect(result.key).toBeUndefined();
      expect(result.error).toBe('No encryption key found for user');
    });

    it('should handle SecureStore errors', async () => {
      const errorMessage = 'SecureStore retrieval error';
      mockSecureStore.getItemAsync.mockRejectedValue(new Error(errorMessage));
      
      const result = await KeyManager.getUserKey(testUserId);
      
      expect(result.success).toBe(false);
      expect(result.key).toBeUndefined();
      expect(result.error).toContain('Failed to retrieve user key');
      expect(result.error).toContain(errorMessage);
    });
  });

  describe('deriveAndStoreKeyFromPassword', () => {
    it('should derive and store key from password successfully', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null); // No existing salt
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      
      const result = await KeyManager.deriveAndStoreKeyFromPassword(testUserId, testPassword);
      
      expect(result.success).toBe(true);
      expect(result.key).toBeDefined();
      expect(typeof result.key).toBe('string');
      expect(result.error).toBeUndefined();
      
      // Should store both salt and derived key
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(2);
    });

    it('should use existing salt if available', async () => {
      const existingSalt = 'existing-salt-123';
      mockSecureStore.getItemAsync.mockResolvedValue(existingSalt);
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      
      const result = await KeyManager.deriveAndStoreKeyFromPassword(testUserId, testPassword);
      
      expect(result.success).toBe(true);
      expect(result.key).toBeDefined();
      
      // Should only store the derived key (salt already exists)
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    });

    it('should return error when userId is empty', async () => {
      const result = await KeyManager.deriveAndStoreKeyFromPassword('', testPassword);
      
      expect(result.success).toBe(false);
      expect(result.key).toBeUndefined();
      expect(result.error).toBe('User ID and password are required');
    });

    it('should return error when password is empty', async () => {
      const result = await KeyManager.deriveAndStoreKeyFromPassword(testUserId, '');
      
      expect(result.success).toBe(false);
      expect(result.key).toBeUndefined();
      expect(result.error).toBe('User ID and password are required');
    });

    it('should handle SecureStore errors', async () => {
      const errorMessage = 'SecureStore error';
      mockSecureStore.getItemAsync.mockRejectedValue(new Error(errorMessage));
      
      const result = await KeyManager.deriveAndStoreKeyFromPassword(testUserId, testPassword);
      
      expect(result.success).toBe(false);
      expect(result.key).toBeUndefined();
      expect(result.error).toContain('Failed to derive and store key');
    });
  });

  describe('removeUserKey', () => {
    it('should remove user key and salt successfully', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
      
      const result = await KeyManager.removeUserKey(testUserId);
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        `user_encryption_key_${testUserId}`
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        `encryption_salt_${testUserId}`
      );
    });

    it('should return error when userId is empty', async () => {
      const result = await KeyManager.removeUserKey('');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required to remove key');
      expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });

    it('should handle SecureStore errors', async () => {
      const errorMessage = 'SecureStore deletion error';
      mockSecureStore.deleteItemAsync.mockRejectedValue(new Error(errorMessage));
      
      const result = await KeyManager.removeUserKey(testUserId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to remove user key');
      expect(result.error).toContain(errorMessage);
    });
  });

  describe('hasUserKey', () => {
    it('should return true when user has a key', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('some-key');
      
      const result = await KeyManager.hasUserKey(testUserId);
      
      expect(result).toBe(true);
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        `user_encryption_key_${testUserId}`
      );
    });

    it('should return false when user has no key', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      
      const result = await KeyManager.hasUserKey(testUserId);
      
      expect(result).toBe(false);
    });

    it('should return false when userId is empty', async () => {
      const result = await KeyManager.hasUserKey('');
      
      expect(result).toBe(false);
      expect(mockSecureStore.getItemAsync).not.toHaveBeenCalled();
    });

    it('should return false on SecureStore errors', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('SecureStore error'));
      
      const result = await KeyManager.hasUserKey(testUserId);
      
      expect(result).toBe(false);
    });
  });

  describe('rotateUserKey', () => {
    const oldKey = 'old-encryption-key';

    it('should rotate user key successfully', async () => {
      // Mock getting existing key
      mockSecureStore.getItemAsync.mockResolvedValue(oldKey);
      // Mock storing new key
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      
      const result = await KeyManager.rotateUserKey(testUserId);
      
      expect(result.success).toBe(true);
      expect(result.oldKey).toBe(oldKey);
      expect(result.newKey).toBeDefined();
      expect(result.newKey).not.toBe(oldKey);
      expect(result.error).toBeUndefined();
    });

    it('should return error when userId is empty', async () => {
      const result = await KeyManager.rotateUserKey('');
      
      expect(result.success).toBe(false);
      expect(result.oldKey).toBeUndefined();
      expect(result.newKey).toBeUndefined();
      expect(result.error).toBe('User ID is required for key rotation');
    });

    it('should return error when no existing key found', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      
      const result = await KeyManager.rotateUserKey(testUserId);
      
      expect(result.success).toBe(false);
      expect(result.oldKey).toBeUndefined();
      expect(result.newKey).toBeUndefined();
      expect(result.error).toBe('Cannot rotate key: No existing key found');
    });

    it('should handle SecureStore errors during key generation', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(oldKey);
      mockSecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));
      
      const result = await KeyManager.rotateUserKey(testUserId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to generate new key during rotation');
    });
  });

  describe('isSecureStoreAvailable', () => {
    it('should return true when SecureStore is available', async () => {
      mockSecureStore.isAvailableAsync.mockResolvedValue(true);
      
      const result = await KeyManager.isSecureStoreAvailable();
      
      expect(result).toBe(true);
      expect(mockSecureStore.isAvailableAsync).toHaveBeenCalled();
    });

    it('should return false when SecureStore is not available', async () => {
      mockSecureStore.isAvailableAsync.mockResolvedValue(false);
      
      const result = await KeyManager.isSecureStoreAvailable();
      
      expect(result).toBe(false);
    });

    it('should return false on errors', async () => {
      mockSecureStore.isAvailableAsync.mockRejectedValue(new Error('Availability check error'));
      
      const result = await KeyManager.isSecureStoreAvailable();
      
      expect(result).toBe(false);
    });
  });
});