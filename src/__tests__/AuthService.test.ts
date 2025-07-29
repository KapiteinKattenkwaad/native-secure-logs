import { AuthService } from '../services/AuthService';
import { DatabaseService } from '../services/DatabaseService';
import { EncryptionService } from '../services/EncryptionService';
import { SessionStorage } from '../utils/SessionStorage';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('../services/DatabaseService');
jest.mock('../services/EncryptionService');
jest.mock('../utils/SessionStorage');
jest.mock('bcryptjs');

describe('AuthService', () => {
  let authService: AuthService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockSessionStorage: jest.Mocked<SessionStorage>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mocked instances
    mockDatabaseService = {
      getUserByEmail: jest.fn(),
      getUserById: jest.fn(),
      createUser: jest.fn(),
    } as any;

    mockSessionStorage = {
      setItem: jest.fn(),
      getItem: jest.fn(),
      removeItem: jest.fn(),
    } as any;

    // Mock static getInstance methods
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDatabaseService);
    (SessionStorage.getInstance as jest.Mock).mockReturnValue(mockSessionStorage);
    (EncryptionService.generateKey as jest.Mock).mockReturnValue('encryptionKey123');

    authService = AuthService.getInstance();
  });

  describe('register', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };

    it('should successfully register a new user', async () => {
      // Arrange
      mockDatabaseService.getUserByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockDatabaseService.createUser.mockResolvedValue(1);
      mockSessionStorage.setItem.mockResolvedValue();

      // Act
      const result = await authService.register(validCredentials);

      // Assert
      expect(result).toEqual({
        id: 1,
        email: 'test@example.com',
        encryptionKey: 'encryptionKey123',
      });
      expect(mockDatabaseService.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
      expect(EncryptionService.generateKey).toHaveBeenCalled();
      expect(mockDatabaseService.createUser).toHaveBeenCalledWith(
        'test@example.com',
        'hashedPassword',
        'encryptionKey123'
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'user_session',
        expect.stringContaining('"id":1')
      );
    });

    it('should throw error if user already exists', async () => {
      // Arrange
      mockDatabaseService.getUserByEmail.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        password_hash: 'hash',
        encryption_key: 'key',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      });

      // Act & Assert
      await expect(authService.register(validCredentials)).rejects.toThrow(
        'Registration failed: User with this email already exists'
      );
    });

    it('should throw error for invalid email', async () => {
      // Arrange
      const invalidCredentials = {
        ...validCredentials,
        email: 'invalid-email',
      };

      // Act & Assert
      await expect(authService.register(invalidCredentials)).rejects.toThrow(
        'Registration failed: Please enter a valid email address'
      );
    });

    it('should throw error for weak password', async () => {
      // Arrange
      const weakPasswordCredentials = {
        ...validCredentials,
        password: 'weak',
        confirmPassword: 'weak',
      };

      // Act & Assert
      await expect(authService.register(weakPasswordCredentials)).rejects.toThrow(
        'Registration failed: Password must be at least 8 characters long'
      );
    });

    it('should throw error for password mismatch', async () => {
      // Arrange
      const mismatchCredentials = {
        ...validCredentials,
        confirmPassword: 'DifferentPassword123!',
      };

      // Act & Assert
      await expect(authService.register(mismatchCredentials)).rejects.toThrow(
        'Registration failed: Passwords do not match'
      );
    });

    it('should throw error if database creation fails', async () => {
      // Arrange
      mockDatabaseService.getUserByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockDatabaseService.createUser.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(authService.register(validCredentials)).rejects.toThrow(
        'Registration failed: Database error'
      );
    });
  });

  describe('login', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    const mockUser = {
      id: 1,
      email: 'test@example.com',
      password_hash: 'hashedPassword',
      encryption_key: 'encryptionKey123',
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
    };

    it('should successfully login with valid credentials', async () => {
      // Arrange
      mockDatabaseService.getUserByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockSessionStorage.setItem.mockResolvedValue();

      // Act
      const result = await authService.login(validCredentials);

      // Assert
      expect(result).toEqual({
        id: 1,
        email: 'test@example.com',
        encryptionKey: 'encryptionKey123',
      });
      expect(mockDatabaseService.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('Password123!', 'hashedPassword');
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'user_session',
        expect.stringContaining('"id":1')
      );
    });

    it('should throw error for non-existent user', async () => {
      // Arrange
      mockDatabaseService.getUserByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(validCredentials)).rejects.toThrow(
        'Login failed: Invalid email or password'
      );
    });

    it('should throw error for invalid password', async () => {
      // Arrange
      mockDatabaseService.getUserByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(validCredentials)).rejects.toThrow(
        'Login failed: Invalid email or password'
      );
    });

    it('should throw error for empty email', async () => {
      // Arrange
      const invalidCredentials = {
        ...validCredentials,
        email: '',
      };

      // Act & Assert
      await expect(authService.login(invalidCredentials)).rejects.toThrow(
        'Login failed: Email is required'
      );
    });

    it('should throw error for empty password', async () => {
      // Arrange
      const invalidCredentials = {
        ...validCredentials,
        password: '',
      };

      // Act & Assert
      await expect(authService.login(invalidCredentials)).rejects.toThrow(
        'Login failed: Password is required'
      );
    });
  });

  describe('logout', () => {
    it('should successfully logout', async () => {
      // Arrange
      mockSessionStorage.removeItem.mockResolvedValue();

      // Act
      await authService.logout();

      // Assert
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user_session');
    });

    it('should handle logout errors gracefully', async () => {
      // Arrange
      mockSessionStorage.removeItem.mockRejectedValue(new Error('Storage error'));

      // Act & Assert
      await expect(authService.logout()).rejects.toThrow('Logout failed: Storage error');
    });
  });

  describe('getCurrentUser', () => {
    const mockSessionData = {
      id: 1,
      email: 'test@example.com',
      encryptionKey: 'encryptionKey123',
      timestamp: Date.now(),
    };

    const mockUser = {
      id: 1,
      email: 'test@example.com',
      password_hash: 'hashedPassword',
      encryption_key: 'encryptionKey123',
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
    };

    it('should return current user from valid session', async () => {
      // Arrange
      mockSessionStorage.getItem.mockResolvedValue(JSON.stringify(mockSessionData));
      mockDatabaseService.getUserById.mockResolvedValue(mockUser);

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toEqual({
        id: 1,
        email: 'test@example.com',
        encryptionKey: 'encryptionKey123',
      });
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('user_session');
      expect(mockDatabaseService.getUserById).toHaveBeenCalledWith(1);
    });

    it('should return null if no session exists', async () => {
      // Arrange
      mockSessionStorage.getItem.mockResolvedValue(null);

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toBeNull();
    });

    it('should clear session and return null if user no longer exists', async () => {
      // Arrange
      mockSessionStorage.getItem.mockResolvedValue(JSON.stringify(mockSessionData));
      mockDatabaseService.getUserById.mockResolvedValue(null);
      mockSessionStorage.removeItem.mockResolvedValue();

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toBeNull();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user_session');
    });

    it('should clear corrupted session and return null', async () => {
      // Arrange
      mockSessionStorage.getItem.mockResolvedValue('invalid-json');
      mockSessionStorage.removeItem.mockResolvedValue();

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toBeNull();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user_session');
    });

    it('should clear incomplete session and return null', async () => {
      // Arrange
      const incompleteSession = { id: 1 }; // missing email and encryptionKey
      mockSessionStorage.getItem.mockResolvedValue(JSON.stringify(incompleteSession));
      mockSessionStorage.removeItem.mockResolvedValue();

      // Act
      const result = await authService.getCurrentUser();

      // Assert
      expect(result).toBeNull();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user_session');
    });
  });
});