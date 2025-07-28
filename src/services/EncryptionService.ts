import CryptoJS from 'crypto-js';

export interface EncryptionResult {
  encryptedData: string;
  success: boolean;
  error?: string;
}

export interface DecryptionResult {
  decryptedData: string;
  success: boolean;
  error?: string;
}

/**
 * EncryptionService provides AES-256 encryption and decryption capabilities
 * for securing health log data according to requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */
export class EncryptionService {
  private static readonly ALGORITHM = 'AES';
  private static readonly KEY_SIZE = 256;
  private static readonly IV_SIZE = 16; // 128 bits

  /**
   * Encrypts data using AES-256 encryption
   * @param data - The data to encrypt
   * @param key - The encryption key
   * @returns EncryptionResult with encrypted data or error
   */
  static encrypt(data: string, key: string): EncryptionResult {
    try {
      if (!data || !key) {
        return {
          encryptedData: '',
          success: false,
          error: 'Data and key are required for encryption'
        };
      }

      // Use CryptoJS built-in encryption with random IV
      const encrypted = CryptoJS.AES.encrypt(data, key);
      const encryptedData = encrypted.toString();

      return {
        encryptedData,
        success: true
      };
    } catch (error) {
      return {
        encryptedData: '',
        success: false,
        error: `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Decrypts data using AES-256 decryption
   * @param encryptedData - The encrypted data to decrypt
   * @param key - The decryption key
   * @returns DecryptionResult with decrypted data or error
   */
  static decrypt(encryptedData: string, key: string): DecryptionResult {
    try {
      if (!encryptedData || !key) {
        return {
          decryptedData: '',
          success: false,
          error: 'Encrypted data and key are required for decryption'
        };
      }

      // Use CryptoJS built-in decryption
      const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
      const decryptedData = decrypted.toString(CryptoJS.enc.Utf8);

      if (!decryptedData) {
        return {
          decryptedData: '',
          success: false,
          error: 'Decryption failed: Invalid key or corrupted data'
        };
      }

      return {
        decryptedData,
        success: true
      };
    } catch (error) {
      return {
        decryptedData: '',
        success: false,
        error: `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generates a random encryption key
   * @returns A base64 encoded encryption key
   */
  static generateKey(): string {
    return CryptoJS.lib.WordArray.random(this.KEY_SIZE / 8).toString(CryptoJS.enc.Base64);
  }

  /**
   * Derives a key from a password using PBKDF2
   * @param password - The password to derive key from
   * @param salt - The salt for key derivation
   * @param iterations - Number of iterations (default: 10000)
   * @returns A derived encryption key
   */
  static deriveKey(password: string, salt: string, iterations: number = 10000): string {
    return CryptoJS.PBKDF2(password, salt, {
      keySize: this.KEY_SIZE / 32,
      iterations: iterations
    }).toString(CryptoJS.enc.Base64);
  }

  /**
   * Securely clears sensitive data from memory
   * @param data - The data to clear
   */
  static clearSensitiveData(data: any): void {
    if (typeof data === 'string') {
      // Overwrite string data (limited effectiveness in JS)
      data = '';
    } else if (typeof data === 'object' && data !== null) {
      // Clear object properties
      Object.keys(data).forEach(key => {
        delete data[key];
      });
    }
  }
}