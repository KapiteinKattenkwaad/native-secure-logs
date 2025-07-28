import { EncryptionService } from '../services/EncryptionService';

describe('EncryptionService', () => {
  const testData = 'This is sensitive health data that needs encryption';
  const testKey = 'test-encryption-key-123';

  describe('encrypt', () => {
    it('should successfully encrypt data with valid inputs', () => {
      const result = EncryptionService.encrypt(testData, testKey);
      
      expect(result.success).toBe(true);
      expect(result.encryptedData).toBeDefined();
      expect(result.encryptedData).not.toBe(testData);
      expect(result.error).toBeUndefined();
    });

    it('should return error when data is empty', () => {
      const result = EncryptionService.encrypt('', testKey);
      
      expect(result.success).toBe(false);
      expect(result.encryptedData).toBe('');
      expect(result.error).toBe('Data and key are required for encryption');
    });

    it('should return error when key is empty', () => {
      const result = EncryptionService.encrypt(testData, '');
      
      expect(result.success).toBe(false);
      expect(result.encryptedData).toBe('');
      expect(result.error).toBe('Data and key are required for encryption');
    });

    it('should produce different encrypted outputs for same data (due to random IV)', () => {
      const result1 = EncryptionService.encrypt(testData, testKey);
      const result2 = EncryptionService.encrypt(testData, testKey);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.encryptedData).not.toBe(result2.encryptedData);
    });
  });

  describe('decrypt', () => {
    it('should successfully decrypt data that was encrypted', () => {
      const encryptResult = EncryptionService.encrypt(testData, testKey);
      expect(encryptResult.success).toBe(true);
      
      const decryptResult = EncryptionService.decrypt(encryptResult.encryptedData, testKey);
      
      expect(decryptResult.success).toBe(true);
      expect(decryptResult.decryptedData).toBe(testData);
      expect(decryptResult.error).toBeUndefined();
    });

    it('should return error when encrypted data is empty', () => {
      const result = EncryptionService.decrypt('', testKey);
      
      expect(result.success).toBe(false);
      expect(result.decryptedData).toBe('');
      expect(result.error).toBe('Encrypted data and key are required for decryption');
    });

    it('should return error when key is empty', () => {
      const result = EncryptionService.decrypt('some-encrypted-data', '');
      
      expect(result.success).toBe(false);
      expect(result.decryptedData).toBe('');
      expect(result.error).toBe('Encrypted data and key are required for decryption');
    });

    it('should return error when decrypting with wrong key', () => {
      const encryptResult = EncryptionService.encrypt(testData, testKey);
      expect(encryptResult.success).toBe(true);
      
      const decryptResult = EncryptionService.decrypt(encryptResult.encryptedData, 'wrong-key');
      
      expect(decryptResult.success).toBe(false);
      expect(decryptResult.decryptedData).toBe('');
      expect(decryptResult.error).toContain('Decryption failed');
    });

    it('should return error when decrypting invalid data', () => {
      const result = EncryptionService.decrypt('invalid-encrypted-data', testKey);
      
      expect(result.success).toBe(false);
      expect(result.decryptedData).toBe('');
      expect(result.error).toContain('Decryption failed');
    });
  });

  describe('generateKey', () => {
    it('should generate a valid base64 key', () => {
      const key = EncryptionService.generateKey();
      
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
      
      // Should be valid base64
      expect(() => Buffer.from(key, 'base64')).not.toThrow();
    });

    it('should generate different keys each time', () => {
      const key1 = EncryptionService.generateKey();
      const key2 = EncryptionService.generateKey();
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('deriveKey', () => {
    const password = 'user-password-123';
    const salt = 'random-salt-456';

    it('should derive a key from password and salt', () => {
      const key = EncryptionService.deriveKey(password, salt);
      
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('should produce same key for same password and salt', () => {
      const key1 = EncryptionService.deriveKey(password, salt);
      const key2 = EncryptionService.deriveKey(password, salt);
      
      expect(key1).toBe(key2);
    });

    it('should produce different keys for different passwords', () => {
      const key1 = EncryptionService.deriveKey(password, salt);
      const key2 = EncryptionService.deriveKey('different-password', salt);
      
      expect(key1).not.toBe(key2);
    });

    it('should produce different keys for different salts', () => {
      const key1 = EncryptionService.deriveKey(password, salt);
      const key2 = EncryptionService.deriveKey(password, 'different-salt');
      
      expect(key1).not.toBe(key2);
    });

    it('should use custom iteration count', () => {
      const key1 = EncryptionService.deriveKey(password, salt, 1000);
      const key2 = EncryptionService.deriveKey(password, salt, 5000);
      
      // Different iteration counts should produce different keys
      expect(key1).not.toBe(key2);
    });
  });

  describe('clearSensitiveData', () => {
    it('should clear string data', () => {
      let sensitiveData = 'sensitive-information';
      EncryptionService.clearSensitiveData(sensitiveData);
      
      // Note: In JavaScript, strings are immutable, so this test mainly ensures no errors
      expect(() => EncryptionService.clearSensitiveData(sensitiveData)).not.toThrow();
    });

    it('should clear object data', () => {
      const sensitiveObject = {
        password: 'secret',
        key: 'encryption-key',
        data: 'sensitive-data'
      };
      
      EncryptionService.clearSensitiveData(sensitiveObject);
      
      expect(Object.keys(sensitiveObject)).toHaveLength(0);
    });

    it('should handle null and undefined', () => {
      expect(() => EncryptionService.clearSensitiveData(null)).not.toThrow();
      expect(() => EncryptionService.clearSensitiveData(undefined)).not.toThrow();
    });
  });

  describe('end-to-end encryption/decryption', () => {
    it('should handle complex JSON data', () => {
      const complexData = {
        id: '123',
        title: 'Health Log Entry',
        symptoms: ['headache', 'fatigue'],
        severity: 3,
        date: '2024-01-15',
        notes: 'Feeling unwell today',
        metadata: {
          location: 'home',
          weather: 'rainy'
        }
      };
      
      const dataString = JSON.stringify(complexData);
      const encryptResult = EncryptionService.encrypt(dataString, testKey);
      expect(encryptResult.success).toBe(true);
      
      const decryptResult = EncryptionService.decrypt(encryptResult.encryptedData, testKey);
      expect(decryptResult.success).toBe(true);
      
      const decryptedData = JSON.parse(decryptResult.decryptedData);
      expect(decryptedData).toEqual(complexData);
    });

    it('should handle unicode characters', () => {
      const unicodeData = 'Health data with émojis 🏥💊 and spëcial chars';
      
      const encryptResult = EncryptionService.encrypt(unicodeData, testKey);
      expect(encryptResult.success).toBe(true);
      
      const decryptResult = EncryptionService.decrypt(encryptResult.encryptedData, testKey);
      expect(decryptResult.success).toBe(true);
      expect(decryptResult.decryptedData).toBe(unicodeData);
    });

    it('should handle large data', () => {
      const largeData = 'x'.repeat(10000); // 10KB of data
      
      const encryptResult = EncryptionService.encrypt(largeData, testKey);
      expect(encryptResult.success).toBe(true);
      
      const decryptResult = EncryptionService.decrypt(encryptResult.encryptedData, testKey);
      expect(decryptResult.success).toBe(true);
      expect(decryptResult.decryptedData).toBe(largeData);
    });
  });
});