import { SecureStorage } from '../utils/SecureStorage';
import { mockSecureStore } from './setup';

describe('SecureStorage', () => {
  const testUserId = 'test-user-123';
  const testKey = 'test-encryption-key';
  const testData = {
    id: '1',
    title: 'Test Health Log',
    description: 'Test description',
    category: 'symptom' as const,
    severity: 3 as const,
    tags: ['headache', 'fatigue'],
    date: '2024-01-15',
    notes: 'Test notes'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('encryptAndStore', () => {
    it('should encrypt and store data successfully', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(testKey);
      
      const result = await SecureStorage.encryptAndStore(testUserId, testData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      expect(result.error).toBeUndefined();
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        `user_encryption_key_${testUserId}`
      );
    });

    it('should return error when userId is empty', async () => {
      const result = await SecureStorage.encryptAndStore('', testData);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('User ID and data are required');
      expect(mockSecureStore.getItemAsync).not.toHaveBeenCalled();
    });

    it('should return error when data is null', async () => {
      const result = await SecureStorage.encryptAndStore(testUserId, null);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('User ID and data are required');
    });

    it('should return error when data is undefined', async () => {
      const result = await SecureStorage.encryptAndStore(testUserId, undefined);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('User ID and data are required');
    });

    it('should return error when encryption key is not found', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      
      const result = await SecureStorage.encryptAndStore(testUserId, testData);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Failed to retrieve encryption key');
    });

    it('should handle key retrieval errors', async () => {
      const errorMessage = 'Key retrieval error';
      mockSecureStore.getItemAsync.mockRejectedValue(new Error(errorMessage));
      
      const result = await SecureStorage.encryptAndStore(testUserId, testData);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Failed to retrieve encryption key');
    });
  });

  describe('retrieveAndDecrypt', () => {
    let encryptedData: string;

    beforeEach(async () => {
      // Create encrypted data for testing
      mockSecureStore.getItemAsync.mockResolvedValue(testKey);
      const encryptResult = await SecureStorage.encryptAndStore(testUserId, testData);
      encryptedData = encryptResult.data as string;
      jest.clearAllMocks();
    });

    it('should retrieve and decrypt data successfully', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(testKey);
      
      const result = await SecureStorage.retrieveAndDecrypt(testUserId, encryptedData);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(testData);
      expect(result.error).toBeUndefined();
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        `user_encryption_key_${testUserId}`
      );
    });

    it('should return error when userId is empty', async () => {
      const result = await SecureStorage.retrieveAndDecrypt('', encryptedData);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('User ID and encrypted data are required');
      expect(mockSecureStore.getItemAsync).not.toHaveBeenCalled();
    });

    it('should return error when encrypted data is empty', async () => {
      const result = await SecureStorage.retrieveAndDecrypt(testUserId, '');
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('User ID and encrypted data are required');
    });

    it('should return error when encryption key is not found', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      
      const result = await SecureStorage.retrieveAndDecrypt(testUserId, encryptedData);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Failed to retrieve encryption key');
    });

    it('should return error when decryption fails with wrong key', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('wrong-key');
      
      const result = await SecureStorage.retrieveAndDecrypt(testUserId, encryptedData);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toContain('Decryption failed');
    });

    it('should handle invalid encrypted data', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(testKey);
      
      const result = await SecureStorage.retrieveAndDecrypt(testUserId, 'invalid-data');
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toContain('Decryption failed');
    });
  });

  describe('encryptWithKey', () => {
    it('should encrypt data with provided key successfully', () => {
      const result = SecureStorage.encryptWithKey(testData, testKey);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      expect(result.error).toBeUndefined();
    });

    it('should return error when data is null', () => {
      const result = SecureStorage.encryptWithKey(null, testKey);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Data and encryption key are required');
    });

    it('should return error when data is undefined', () => {
      const result = SecureStorage.encryptWithKey(undefined, testKey);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Data and encryption key are required');
    });

    it('should return error when key is empty', () => {
      const result = SecureStorage.encryptWithKey(testData, '');
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Data and encryption key are required');
    });
  });

  describe('decryptWithKey', () => {
    let encryptedData: string;

    beforeEach(() => {
      const encryptResult = SecureStorage.encryptWithKey(testData, testKey);
      encryptedData = encryptResult.data as string;
    });

    it('should decrypt data with provided key successfully', () => {
      const result = SecureStorage.decryptWithKey(encryptedData, testKey);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(testData);
      expect(result.error).toBeUndefined();
    });

    it('should return error when encrypted data is empty', () => {
      const result = SecureStorage.decryptWithKey('', testKey);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Encrypted data and encryption key are required');
    });

    it('should return error when key is empty', () => {
      const result = SecureStorage.decryptWithKey(encryptedData, '');
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Encrypted data and encryption key are required');
    });

    it('should return error when decrypting with wrong key', () => {
      const result = SecureStorage.decryptWithKey(encryptedData, 'wrong-key');
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toContain('Decryption failed');
    });

    it('should handle invalid encrypted data', () => {
      const result = SecureStorage.decryptWithKey('invalid-data', testKey);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toContain('Decryption failed');
    });
  });

  describe('validateEncryptedData', () => {
    let encryptedData: string;

    beforeEach(async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(testKey);
      const encryptResult = await SecureStorage.encryptAndStore(testUserId, testData);
      encryptedData = encryptResult.data as string;
      jest.clearAllMocks();
    });

    it('should return true for valid encrypted data', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(testKey);
      
      const result = await SecureStorage.validateEncryptedData(testUserId, encryptedData);
      
      expect(result).toBe(true);
    });

    it('should return false for invalid encrypted data', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(testKey);
      
      const result = await SecureStorage.validateEncryptedData(testUserId, 'invalid-data');
      
      expect(result).toBe(false);
    });

    it('should return false when key is not found', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      
      const result = await SecureStorage.validateEncryptedData(testUserId, encryptedData);
      
      expect(result).toBe(false);
    });

    it('should return false on errors', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Validation error'));
      
      const result = await SecureStorage.validateEncryptedData(testUserId, encryptedData);
      
      expect(result).toBe(false);
    });
  });

  describe('reEncryptData', () => {
    const oldKey = 'old-encryption-key';
    const newKey = 'new-encryption-key';
    let encryptedWithOldKey: string;

    beforeEach(() => {
      const encryptResult = SecureStorage.encryptWithKey(testData, oldKey);
      encryptedWithOldKey = encryptResult.data as string;
    });

    it('should re-encrypt data with new key successfully', () => {
      const result = SecureStorage.reEncryptData(encryptedWithOldKey, oldKey, newKey);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      expect(result.error).toBeUndefined();
      
      // Verify the re-encrypted data can be decrypted with new key
      const decryptResult = SecureStorage.decryptWithKey(result.data as string, newKey);
      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(testData);
    });

    it('should return error when encrypted data is empty', () => {
      const result = SecureStorage.reEncryptData('', oldKey, newKey);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Encrypted data, old key, and new key are required');
    });

    it('should return error when old key is empty', () => {
      const result = SecureStorage.reEncryptData(encryptedWithOldKey, '', newKey);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Encrypted data, old key, and new key are required');
    });

    it('should return error when new key is empty', () => {
      const result = SecureStorage.reEncryptData(encryptedWithOldKey, oldKey, '');
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Encrypted data, old key, and new key are required');
    });

    it('should return error when decryption with old key fails', () => {
      const result = SecureStorage.reEncryptData(encryptedWithOldKey, 'wrong-old-key', newKey);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Failed to decrypt with old key');
    });

    it('should handle invalid encrypted data', () => {
      const result = SecureStorage.reEncryptData('invalid-data', oldKey, newKey);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Failed to decrypt with old key');
    });
  });

  describe('end-to-end operations', () => {
    it('should handle complete encrypt-decrypt cycle', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(testKey);
      
      // Encrypt
      const encryptResult = await SecureStorage.encryptAndStore(testUserId, testData);
      expect(encryptResult.success).toBe(true);
      
      // Decrypt
      const decryptResult = await SecureStorage.retrieveAndDecrypt(
        testUserId,
        encryptResult.data as string
      );
      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(testData);
    });

    it('should handle complex nested data structures', async () => {
      const complexData = {
        user: {
          id: '123',
          profile: {
            name: 'John Doe',
            age: 30,
            conditions: ['diabetes', 'hypertension']
          }
        },
        logs: [
          { date: '2024-01-01', value: 120 },
          { date: '2024-01-02', value: 125 }
        ],
        metadata: {
          version: '1.0',
          encrypted: true,
          tags: ['health', 'personal']
        }
      };

      mockSecureStore.getItemAsync.mockResolvedValue(testKey);
      
      const encryptResult = await SecureStorage.encryptAndStore(testUserId, complexData);
      expect(encryptResult.success).toBe(true);
      
      const decryptResult = await SecureStorage.retrieveAndDecrypt(
        testUserId,
        encryptResult.data as string
      );
      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toEqual(complexData);
    });
  });
});