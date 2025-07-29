import { SyncService, SyncResult, SyncStatus } from '../services/SyncService';
import { DatabaseService, HealthLogRecord } from '../services/DatabaseService';
import { AuthService } from '../services/AuthService';
import { supabase } from '../config/supabase';

// Mock dependencies
jest.mock('../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
    },
  },
}));

jest.mock('../services/DatabaseService');
jest.mock('../services/AuthService');
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
}));

describe('SyncService', () => {
  let syncService: SyncService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSupabase: any;

  const mockHealthLogRecord: HealthLogRecord = {
    id: 1,
    user_id: 1,
    encrypted_data: 'encrypted-data-123',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    synced_at: null,
    cloud_id: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (SyncService as any).instance = undefined;
    
    // Setup mocks
    mockDatabaseService = {
      getUnsyncedHealthLogs: jest.fn().mockResolvedValue([]),
      markHealthLogAsSynced: jest.fn().mockResolvedValue(undefined),
      getHealthLogsByUserId: jest.fn().mockResolvedValue([]),
    } as any;

    mockAuthService = {
      getInstance: jest.fn(),
    } as any;

    mockSupabase = supabase as any;

    // Mock static getInstance methods
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDatabaseService);
    (AuthService.getInstance as jest.Mock).mockReturnValue(mockAuthService);

    // Mock crypto
    const mockCrypto = require('expo-crypto');
    mockCrypto.digestStringAsync.mockResolvedValue('mock-device-id');

    syncService = SyncService.getInstance();
  });

  describe('initialize', () => {
    it('should initialize successfully and generate device ID', async () => {
      await expect(syncService.initialize()).resolves.not.toThrow();
    });

    it('should throw error if device ID generation fails', async () => {
      const mockCrypto = require('expo-crypto');
      mockCrypto.digestStringAsync.mockRejectedValue(new Error('Crypto error'));

      await expect(syncService.initialize()).rejects.toThrow('Failed to initialize sync service');
    });
  });

  describe('checkConnectivity', () => {
    it('should return true when connection is successful', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await syncService.checkConnectivity();
      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: null, error: new Error('Network error') }),
        }),
      });

      const result = await syncService.checkConnectivity();
      expect(result).toBe(false);
    });

    it('should return false when exception is thrown', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Connection error');
      });

      const result = await syncService.checkConnectivity();
      expect(result).toBe(false);
    });
  });

  describe('getSyncStatus', () => {
    beforeEach(async () => {
      await syncService.initialize();
    });

    it('should return correct sync status when online', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValueOnce([mockHealthLogRecord]);

      const status: SyncStatus = await syncService.getSyncStatus(1);

      expect(status).toEqual({
        isOnline: true,
        isSyncing: false,
        lastSyncAt: null,
        pendingCount: 1,
      });
    });

    it('should return correct sync status when offline', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: null, error: new Error('Network error') }),
        }),
      });

      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValue([]);

      const status: SyncStatus = await syncService.getSyncStatus(1);

      expect(status).toEqual({
        isOnline: false,
        isSyncing: false,
        lastSyncAt: null,
        pendingCount: 0,
      });
    });
  });

  describe('syncHealthLogs', () => {
    beforeEach(async () => {
      await syncService.initialize();
    });

    it('should successfully sync health logs', async () => {
      // Mock connectivity check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'cloud-id-123' },
              error: null,
            }),
          }),
        }),
      });

      // Mock auth
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      // Mock database
      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValueOnce([mockHealthLogRecord]);
      mockDatabaseService.markHealthLogAsSynced.mockResolvedValue();

      const result: SyncResult = await syncService.syncHealthLogs(1);

      expect(result).toEqual({
        success: true,
        syncedCount: 1,
        failedCount: 0,
        errors: [],
      });

      expect(mockDatabaseService.markHealthLogAsSynced).toHaveBeenCalledWith(1, 'cloud-id-123');
    });

    it('should handle no unsynced logs', async () => {
      // Mock connectivity check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      // Mock auth
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      // Mock database
      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValue([]);

      const result: SyncResult = await syncService.syncHealthLogs(1);

      expect(result).toEqual({
        success: true,
        syncedCount: 0,
        failedCount: 0,
        errors: [],
      });
    });

    it('should throw error when sync is already in progress', async () => {
      // Start first sync
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      mockDatabaseService.getUnsyncedHealthLogs.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      // Start sync and immediately try to start another
      const syncPromise = syncService.syncHealthLogs(1);
      
      await expect(syncService.syncHealthLogs(1)).rejects.toThrow('Sync already in progress');
      
      await syncPromise; // Wait for first sync to complete
    });

    it('should throw error when not initialized', async () => {
      // Create a fresh instance without initializing
      const freshService = Object.create(SyncService.prototype);
      freshService.databaseService = mockDatabaseService;
      freshService.authService = mockAuthService;
      freshService.isSyncing = false;
      freshService.deviceId = null; // This should cause the error

      await expect(freshService.syncHealthLogs(1)).rejects.toThrow('Sync service not initialized');
    });

    it('should throw error when offline', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: null, error: new Error('Network error') }),
        }),
      });

      await expect(syncService.syncHealthLogs(1)).rejects.toThrow('No internet connection available');
    });

    it('should throw error when user not authenticated', async () => {
      // Mock connectivity check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      // Mock auth failure
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(syncService.syncHealthLogs(1)).rejects.toThrow('User not authenticated with Supabase');
    });

    it('should handle partial sync failures', async () => {
      const mockHealthLogRecord2: HealthLogRecord = {
        ...mockHealthLogRecord,
        id: 2,
      };

      // Mock connectivity check and insert with different responses
      let insertCallCount = 0;
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: jest.fn().mockImplementation(() => {
          insertCallCount++;
          if (insertCallCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'cloud-id-123' },
                  error: null,
                }),
              }),
            };
          } else {
            return {
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: new Error('Upload failed'),
                }),
              }),
            };
          }
        }),
      });

      // Mock auth
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      // Mock database
      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValueOnce([mockHealthLogRecord, mockHealthLogRecord2]);
      mockDatabaseService.markHealthLogAsSynced.mockResolvedValue();

      const result: SyncResult = await syncService.syncHealthLogs(1);

      expect(result).toEqual({
        success: true,
        syncedCount: 1,
        failedCount: 1,
        errors: [
          {
            localId: 2,
            error: 'Failed to upload health log: Supabase insert error: Upload failed',
            retryable: false,
          },
        ],
      });
    });
  });

  describe('authenticateWithSupabase', () => {
    it('should authenticate successfully', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        error: null,
      });

      await expect(syncService.authenticateWithSupabase('test@example.com', 'password')).resolves.not.toThrow();
    });

    it('should throw error on authentication failure', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        error: new Error('Invalid credentials'),
      });

      await expect(syncService.authenticateWithSupabase('test@example.com', 'password'))
        .rejects.toThrow('Supabase authentication failed: Invalid credentials');
    });
  });

  describe('registerWithSupabase', () => {
    it('should register successfully', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        error: null,
      });

      await expect(syncService.registerWithSupabase('test@example.com', 'password')).resolves.not.toThrow();
    });

    it('should throw error on registration failure', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        error: new Error('Email already exists'),
      });

      await expect(syncService.registerWithSupabase('test@example.com', 'password'))
        .rejects.toThrow('Supabase registration failed: Email already exists');
    });
  });

  describe('signOutFromSupabase', () => {
    it('should sign out successfully', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: null,
      });

      await expect(syncService.signOutFromSupabase()).resolves.not.toThrow();
    });

    it('should not throw error on sign out failure', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: new Error('Sign out failed'),
      });

      // Should not throw, just log warning
      await expect(syncService.signOutFromSupabase()).resolves.not.toThrow();
    });
  });

  describe('retrySyncWithBackoff', () => {
    beforeEach(async () => {
      await syncService.initialize();
    });

    it('should succeed on first attempt', async () => {
      // Mock successful sync
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValue([]);

      const result = await syncService.retrySyncWithBackoff(1, 3);

      expect(result).toEqual({
        success: true,
        syncedCount: 0,
        failedCount: 0,
        errors: [],
      });
    });

    it('should retry on failure and eventually succeed', async () => {
      let attemptCount = 0;

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockImplementation(() => {
            attemptCount++;
            if (attemptCount < 3) {
              return Promise.resolve({ data: null, error: new Error('Network error') });
            }
            return Promise.resolve({ data: [], error: null });
          }),
        }),
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValue([]);

      const result = await syncService.retrySyncWithBackoff(1, 3);

      expect(result).toEqual({
        success: true,
        syncedCount: 0,
        failedCount: 0,
        errors: [],
      });

      expect(attemptCount).toBe(3);
    });

    it('should throw error after max retries', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: null, error: new Error('Network error') }),
        }),
      });

      await expect(syncService.retrySyncWithBackoff(1, 2)).rejects.toThrow('No internet connection available');
    });
  });

  describe('getSyncStats', () => {
    beforeEach(async () => {
      await syncService.initialize();
    });

    it('should return correct sync statistics', async () => {
      const allLogs = [mockHealthLogRecord, { ...mockHealthLogRecord, id: 2 }];
      const unsyncedLogs = [mockHealthLogRecord];

      mockDatabaseService.getHealthLogsByUserId.mockResolvedValueOnce(allLogs);
      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValueOnce(unsyncedLogs);

      const stats = await syncService.getSyncStats(1);

      expect(stats).toEqual({
        totalLogs: 2,
        syncedLogs: 1,
        unsyncedLogs: 1,
        syncPercentage: 50,
      });
    });

    it('should handle empty logs', async () => {
      mockDatabaseService.getHealthLogsByUserId.mockResolvedValue([]);
      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValue([]);

      const stats = await syncService.getSyncStats(1);

      expect(stats).toEqual({
        totalLogs: 0,
        syncedLogs: 0,
        unsyncedLogs: 0,
        syncPercentage: 100,
      });
    });
  });
});