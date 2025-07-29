import { AuthService } from '../services/AuthService';
import { DatabaseService } from '../services/DatabaseService';
import { EncryptionService } from '../services/EncryptionService';
import { SessionStorage } from '../utils/SessionStorage';

// This is an integration test to verify the authentication system works end-to-end
describe('Authentication Integration', () => {
  let authService: AuthService;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    // Get real instances for integration testing
    authService = AuthService.getInstance();
    databaseService = DatabaseService.getInstance();
    
    // Initialize database
    await databaseService.initialize();
    
    // Clear any existing data
    await databaseService.clearAllData();
  });

  afterEach(async () => {
    // Clean up
    await databaseService.clearAllData();
    await databaseService.close();
  });

  it('should complete full registration and login flow', async () => {
    const credentials = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
    };

    // Test registration
    const registeredUser = await authService.register(credentials);
    
    expect(registeredUser).toEqual({
      id: expect.any(Number),
      email: 'test@example.com',
      encryptionKey: expect.any(String),
    });

    // Verify user was created in database
    const dbUser = await databaseService.getUserByEmail('test@example.com');
    expect(dbUser).toBeTruthy();
    expect(dbUser!.email).toBe('test@example.com');
    expect(dbUser!.password_hash).toBeTruthy();
    expect(dbUser!.encryption_key).toBeTruthy();

    // Test logout
    await authService.logout();

    // Verify session is cleared
    const currentUser = await authService.getCurrentUser();
    expect(currentUser).toBeNull();

    // Test login with same credentials
    const loginCredentials = {
      email: 'test@example.com',
      password: 'TestPassword123!',
    };

    const loggedInUser = await authService.login(loginCredentials);
    
    expect(loggedInUser).toEqual({
      id: registeredUser.id,
      email: 'test@example.com',
      encryptionKey: expect.any(String),
    });

    // Verify session is restored
    const restoredUser = await authService.getCurrentUser();
    expect(restoredUser).toEqual(loggedInUser);
  });

  it('should handle invalid login attempts', async () => {
    const credentials = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
    };

    // Register user first
    await authService.register(credentials);
    await authService.logout();

    // Try login with wrong password
    const wrongCredentials = {
      email: 'test@example.com',
      password: 'WrongPassword123!',
    };

    await expect(authService.login(wrongCredentials)).rejects.toThrow(
      'Login failed: Invalid email or password'
    );

    // Try login with non-existent user
    const nonExistentCredentials = {
      email: 'nonexistent@example.com',
      password: 'TestPassword123!',
    };

    await expect(authService.login(nonExistentCredentials)).rejects.toThrow(
      'Login failed: Invalid email or password'
    );
  });

  it('should prevent duplicate user registration', async () => {
    const credentials = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
    };

    // Register user first time
    await authService.register(credentials);

    // Try to register same user again
    await expect(authService.register(credentials)).rejects.toThrow(
      'Registration failed: User with this email already exists'
    );
  });
});