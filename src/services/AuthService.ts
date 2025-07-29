import bcrypt from 'bcryptjs';
import { DatabaseService } from './DatabaseService';
import { EncryptionService } from './EncryptionService';
import { SessionStorage } from '../utils/SessionStorage';
import { AuthUser, LoginCredentials, RegisterCredentials } from '../types/auth';

export class AuthService {
  private static instance: AuthService;
  private databaseService: DatabaseService;
  private sessionStorage: SessionStorage;

  private constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.sessionStorage = SessionStorage.getInstance();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async register(credentials: RegisterCredentials): Promise<AuthUser> {
    const { email, password, confirmPassword } = credentials;

    try {
      // Validate input
      this.validateRegistrationInput(email, password, confirmPassword);

      // Check if user already exists
      const existingUser = await this.databaseService.getUserByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Generate encryption key for the user
      const encryptionKey = EncryptionService.generateKey();

      // Create user in database
      const userId = await this.databaseService.createUser(
        email,
        passwordHash,
        encryptionKey
      );

      // Create auth user object
      const authUser: AuthUser = {
        id: userId,
        email,
        encryptionKey
      };

      // Store session
      await this.storeSession(authUser);

      return authUser;
    } catch (error) {
      throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async login(credentials: LoginCredentials): Promise<AuthUser> {
    const { email, password } = credentials;

    try {
      // Validate input
      this.validateLoginInput(email, password);
      // Get user from database
      const user = await this.databaseService.getUserByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Create auth user object
      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        encryptionKey: user.encryption_key
      };

      // Store session
      await this.storeSession(authUser);

      return authUser;
    } catch (error) {
      throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async logout(): Promise<void> {
    try {
      await this.clearSession();
    } catch (error) {
      throw new Error(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const sessionData = await this.sessionStorage.getItem('user_session');
      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData);
      
      // Validate session structure
      if (!session.id || !session.email || !session.encryptionKey) {
        await this.clearSession();
        return null;
      }

      // Verify user still exists in database
      const user = await this.databaseService.getUserById(session.id);
      if (!user) {
        await this.clearSession();
        return null;
      }

      return {
        id: session.id,
        email: session.email,
        encryptionKey: session.encryptionKey
      };
    } catch (error) {
      // Clear potentially corrupted session
      await this.clearSession();
      return null;
    }
  }

  private validateRegistrationInput(email: string, password: string, confirmPassword: string): void {
    if (!email || !email.trim()) {
      throw new Error('Email is required');
    }

    if (!this.isValidEmail(email)) {
      throw new Error('Please enter a valid email address');
    }

    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    // Check password strength
    if (!this.isStrongPassword(password)) {
      throw new Error('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
    }
  }

  private validateLoginInput(email: string, password: string): void {
    if (!email || !email.trim()) {
      throw new Error('Email is required');
    }

    if (!password || !password.trim()) {
      throw new Error('Password is required');
    }

    if (!this.isValidEmail(email)) {
      throw new Error('Please enter a valid email address');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isStrongPassword(password: string): boolean {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
  }

  private async storeSession(user: AuthUser): Promise<void> {
    const sessionData = JSON.stringify({
      id: user.id,
      email: user.email,
      encryptionKey: user.encryptionKey,
      timestamp: Date.now()
    });

    await this.sessionStorage.setItem('user_session', sessionData);
  }

  private async clearSession(): Promise<void> {
    await this.sessionStorage.removeItem('user_session');
  }
}