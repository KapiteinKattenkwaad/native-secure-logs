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

// Mock network connectivity
const mockNetInfo = {
  isConnected: true,
  isInternetReachable: true,
};

// Remove this mock as it's not needed for this test

describe('Sync Integration Tests', () => {
  let syncService: SyncService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSupabase: any;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    password: 'password123',
    encryptionKey: 'test-encryption-key',
  };

  const mockHealthLogRecord: HealthLogRecord = {
    id: 1,
    user_id: 1,
    encrypted_data: JSON.stringify({
      id: 'log-1',
      title: 'Test Log',
      description: 'Test Description',
      category: 'symptom',
      date: '2024-01-01',
      tags: ['test'],
    }),
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
      getUnsyncedHealthLogs: jest.fn(),
      markHealthLogAsSynced: jest.fn(),
      getHealthLogsByUserId: jest.fn(),
      initialize: jest.fn(),
    } as any;

    mockAuthService = {
      getCurrentUser: jest.fn().mockResolvedValue(mockUser),
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

  describe('Complete Sync Workflow', () => {
    beforeEach(async () => {
      await syncService.initialize();
    });

    it('should complete full sync workflow successfully', async () => {
      // Setup: Mock connectivity check
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

      // Setup: Mock authentication
      mockSupabase.auth.signInWithPassword.mockResolvedValue({ error: null });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      // Setup: Mock database operations
      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValue([mockHealthLogRecord]);
      mockDatabaseService.markHealthLogAsSynced.mockResolvedValue();

      // Execute: Authenticate with Supabase
      await syncService.authenticateWithSupabase(mockUser.email, mockUser.password);

      // Execute: Perform sync
      const result = await syncService.syncHealthLogs(mockUser.id);

      // Verify: Sync result
      expect(result).toEqual({
        success: true,
        syncedCount: 1,
        failedCount: 0,
        errors: [],
      });

      // Verify: Database operations
      expect(mockDatabaseService.getUnsyncedHealthLogs).toHaveBeenCalledWith(mockUser.id);
      expect(mockDatabaseService.markHealthLogAsSynced).toHaveBeenCalledWith(1, 'cloud-id-123');

      // Verify: Supabase operations
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: mockUser.email,
        password: mockUser.password,
      });
    });

    it('should handle offline scenario gracefully', async () => {
      // Setup: Mock offline connectivity
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: null, error: new Error('Network error') }),
        }),
      });

      // Setup: Mock database to return empty array for unsynced logs
      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValue([]);

      // Execute: Check sync status
      const status = await syncService.getSyncStatus(mockUser.id);

      // Verify: Offline status
      expect(status.isOnline).toBe(false);

      // Execute: Attempt sync
      await expect(syncService.syncHealthLogs(mockUser.id)).rejects.toThrow('No internet connection available');
    });

    it('should handle authentication failure during sync', async () => {
      // Setup: Mock connectivity check (online)
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      // Setup: Mock authentication failure
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        error: new Error('Invalid credentials'),
      });

      // Execute & Verify: Authentication should fail
      await expect(
        syncService.authenticateWithSupabase(mockUser.email, 'wrong-password')
      ).rejects.toThrow('Supabase authentication failed: Invalid credentials');
    });

    it('should handle partial sync failures with retry logic', async () => {
      const mockHealthLogRecord2: HealthLogRecord = {
        ...mockHealthLogRecord,
        id: 2,
      };

      // Setup: Mock connectivity and partial failure
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
                  error: new Error('Network timeout'),
                }),
              }),
            };
          }
        }),
      });

      // Setup: Mock authentication
      mockSupabase.auth.signInWithPassword.mockResolvedValue({ error: null });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      // Setup: Mock database
      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValue([
        mockHealthLogRecord,
        mockHealthLogRecord2,
      ]);
      mockDatabaseService.markHealthLogAsSynced.mockResolvedValue();

      // Execute: Authenticate and sync
      await syncService.authenticateWithSupabase(mockUser.email, mockUser.password);
      const result = await syncService.syncHealthLogs(mockUser.id);

      // Verify: Partial success
      expect(result).toEqual({
        success: true,
        syncedCount: 1,
        failedCount: 1,
        errors: [
          {
            localId: 2,
            error: 'Failed to upload health log: Supabase insert error: Network timeout',
            retryable: true,
          },
        ],
      });

      // Verify: Only successful log was marked as synced
      expect(mockDatabaseService.markHealthLogAsSynced).toHaveBeenCalledTimes(1);
      expect(mockDatabaseService.markHealthLogAsSynced).toHaveBeenCalledWith(1, 'cloud-id-123');
    });

    it('should handle retry with exponential backoff', async () => {
      let attemptCount = 0;

      // Setup: Mock connectivity with failures then success
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

      // Setup: Mock authentication
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      // Setup: Mock database
      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValue([]);

      // Execute: Retry sync with backoff
      const startTime = Date.now();
      const result = await syncService.retrySyncWithBackoff(mockUser.id, 3);
      const endTime = Date.now();

      // Verify: Eventually succeeded
      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);

      // Verify: Backoff delay was applied (should take at least 3 seconds: 1s + 2s)
      expect(endTime - startTime).toBeGreaterThan(2900);
    });

    it('should provide accurate sync statistics', async () => {
      const allLogs = [
        mockHealthLogRecord,
        { ...mockHealthLogRecord, id: 2, synced_at: '2024-01-01T12:00:00Z', cloud_id: 'cloud-2' },
        { ...mockHealthLogRecord, id: 3, synced_at: '2024-01-01T12:00:00Z', cloud_id: 'cloud-3' },
      ];
      const unsyncedLogs = [mockHealthLogRecord];

      // Setup: Mock database
      mockDatabaseService.getHealthLogsByUserId.mockResolvedValue(allLogs);
      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValue(unsyncedLogs);

      // Execute: Get sync stats
      const stats = await syncService.getSyncStats(mockUser.id);

      // Verify: Correct statistics
      expect(stats).toEqual({
        totalLogs: 3,
        syncedLogs: 2,
        unsyncedLogs: 1,
        syncPercentage: 67,
      });
    });
  });

  describe('Error Scenarios', () => {
    beforeEach(async () => {
      await syncService.initialize();
    });

    it('should handle database errors during sync', async () => {
      // Setup: Mock connectivity
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      // Setup: Mock authentication
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      // Setup: Mock database error
      mockDatabaseService.getUnsyncedHealthLogs.mockRejectedValue(new Error('Database connection failed'));

      // Execute & Verify: Should handle database error
      await expect(syncService.syncHealthLogs(mockUser.id)).rejects.toThrow('Sync failed: Database connection failed');
    });

    it('should handle Supabase service errors', async () => {
      // Setup: Mock connectivity
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Supabase service unavailable')),
          }),
        }),
      });

      // Setup: Mock authentication
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      // Setup: Mock database
      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValue([mockHealthLogRecord]);

      // Execute: Sync should handle Supabase error
      const result = await syncService.syncHealthLogs(mockUser.id);

      // Verify: Error is captured in result
      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
      expect(result.errors[0].error).toContain('Supabase service unavailable');
    });

    it('should handle concurrent sync attempts', async () => {
      // Setup: Mock slow sync operation
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

      // Execute: Start first sync
      const firstSyncPromise = syncService.syncHealthLogs(mockUser.id);

      // Execute: Attempt second sync immediately
      await expect(syncService.syncHealthLogs(mockUser.id)).rejects.toThrow('Sync already in progress');

      // Wait for first sync to complete
      await firstSyncPromise;
    });
  });

  describe('Network State Changes', () => {
    beforeEach(async () => {
      await syncService.initialize();
    });

    it('should detect network state changes', async () => {
      // Setup: Mock online state
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValue([]);

      // Execute: Check online status
      let status = await syncService.getSyncStatus(mockUser.id);
      expect(status.isOnline).toBe(true);

      // Setup: Mock offline state
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: null, error: new Error('Network error') }),
        }),
      });

      // Execute: Check offline status
      status = await syncService.getSyncStatus(mockUser.id);
      expect(status.isOnline).toBe(false);
    });

    it('should handle network interruption during sync', async () => {
      let callCount = 0;

      // Setup: Mock network failure during sync
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Network connection lost');
          }
          return {
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'cloud-id-123' },
                error: null,
              }),
            }),
          };
        }),
      });

      // Setup: Mock authentication
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-id' } },
        error: null,
      });

      // Setup: Mock database
      mockDatabaseService.getUnsyncedHealthLogs.mockResolvedValue([mockHealthLogRecord]);

      // Execute: Sync should handle network interruption
      const result = await syncService.syncHealthLogs(mockUser.id);

      // Verify: Network error is captured
      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
      expect(result.errors[0].error).toContain('Network connection lost');
      expect(result.errors[0].retryable).toBe(true);
    });
  });
});