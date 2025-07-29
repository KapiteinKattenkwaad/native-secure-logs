import { DatabaseService, User, HealthLogRecord } from '../services/DatabaseService';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let mockDb: any;

  beforeEach(() => {
    // Reset the singleton instance
    (DatabaseService as any).instance = undefined;
    databaseService = DatabaseService.getInstance();

    // Create mock database
    mockDb = {
      execAsync: jest.fn(),
      runAsync: jest.fn(),
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
      closeAsync: jest.fn(),
    };

    // Mock the openDatabaseAsync to return our mock
    const { openDatabaseAsync } = require('expo-sqlite');
    openDatabaseAsync.mockResolvedValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Database Initialization', () => {
    it('should initialize database and run migrations', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ version: 0 });

      await databaseService.initialize();

      expect(mockDb.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS migrations')
      );
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT MAX(version) as version FROM migrations')
      );
    });

    it('should apply migration 1 when current version is 0', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ version: 0 });
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1 });

      await databaseService.initialize();

      expect(mockDb.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE users')
      );
      expect(mockDb.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE health_logs')
      );
      expect(mockDb.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX idx_health_logs_user_id')
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO migrations (version) VALUES (1)')
      );
    });

    it('should not apply migration 1 when current version is already 1', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ version: 1 });

      await databaseService.initialize();

      expect(mockDb.execAsync).not.toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE users')
      );
    });

    it('should throw error if database initialization fails', async () => {
      const { openDatabaseAsync } = require('expo-sqlite');
      openDatabaseAsync.mockRejectedValue(new Error('Database error'));

      await expect(databaseService.initialize()).rejects.toThrow(
        'Failed to initialize database: Error: Database error'
      );
    });
  });

  describe('User Operations', () => {
    beforeEach(async () => {
      mockDb.getFirstAsync.mockResolvedValue({ version: 1 });
      await databaseService.initialize();
    });

    describe('createUser', () => {
      it('should create a new user successfully', async () => {
        const mockResult = { lastInsertRowId: 1 };
        mockDb.runAsync.mockResolvedValue(mockResult);

        const userId = await databaseService.createUser(
          'test@example.com',
          'hashedPassword',
          'encryptionKey'
        );

        expect(userId).toBe(1);
        expect(mockDb.runAsync).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO users'),
          ['test@example.com', 'hashedPassword', 'encryptionKey']
        );
      });

      it('should throw error if user creation fails', async () => {
        mockDb.runAsync.mockRejectedValue(new Error('Constraint violation'));

        await expect(
          databaseService.createUser('test@example.com', 'hashedPassword', 'encryptionKey')
        ).rejects.toThrow('Failed to create user: Error: Constraint violation');
      });
    });

    describe('getUserByEmail', () => {
      it('should return user when found', async () => {
        const mockUser: User = {
          id: 1,
          email: 'test@example.com',
          password_hash: 'hashedPassword',
          encryption_key: 'encryptionKey',
          created_at: '2023-01-01 00:00:00',
          updated_at: '2023-01-01 00:00:00',
        };
        mockDb.getFirstAsync.mockResolvedValue(mockUser);

        const user = await databaseService.getUserByEmail('test@example.com');

        expect(user).toEqual(mockUser);
        expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM users WHERE email = ?'),
          ['test@example.com']
        );
      });

      it('should return null when user not found', async () => {
        mockDb.getFirstAsync.mockResolvedValue(null);

        const user = await databaseService.getUserByEmail('nonexistent@example.com');

        expect(user).toBeNull();
      });

      it('should throw error if query fails', async () => {
        mockDb.getFirstAsync.mockRejectedValue(new Error('Database error'));

        await expect(
          databaseService.getUserByEmail('test@example.com')
        ).rejects.toThrow('Failed to get user: Error: Database error');
      });
    });

    describe('getUserById', () => {
      it('should return user when found', async () => {
        const mockUser: User = {
          id: 1,
          email: 'test@example.com',
          password_hash: 'hashedPassword',
          encryption_key: 'encryptionKey',
          created_at: '2023-01-01 00:00:00',
          updated_at: '2023-01-01 00:00:00',
        };
        mockDb.getFirstAsync.mockResolvedValue(mockUser);

        const user = await databaseService.getUserById(1);

        expect(user).toEqual(mockUser);
        expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM users WHERE id = ?'),
          [1]
        );
      });

      it('should return null when user not found', async () => {
        mockDb.getFirstAsync.mockResolvedValue(null);

        const user = await databaseService.getUserById(999);

        expect(user).toBeNull();
      });
    });
  });

  describe('Health Log Operations', () => {
    beforeEach(async () => {
      mockDb.getFirstAsync.mockResolvedValue({ version: 1 });
      await databaseService.initialize();
    });

    describe('createHealthLog', () => {
      it('should create a new health log successfully', async () => {
        const mockResult = { lastInsertRowId: 1 };
        mockDb.runAsync.mockResolvedValue(mockResult);

        const logId = await databaseService.createHealthLog(1, 'encryptedData');

        expect(logId).toBe(1);
        expect(mockDb.runAsync).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO health_logs'),
          [1, 'encryptedData']
        );
      });

      it('should throw error if health log creation fails', async () => {
        mockDb.runAsync.mockRejectedValue(new Error('Foreign key constraint'));

        await expect(
          databaseService.createHealthLog(999, 'encryptedData')
        ).rejects.toThrow('Failed to create health log: Error: Foreign key constraint');
      });
    });

    describe('getHealthLogsByUserId', () => {
      it('should return health logs for user', async () => {
        const mockLogs: HealthLogRecord[] = [
          {
            id: 1,
            user_id: 1,
            encrypted_data: 'encryptedData1',
            created_at: '2023-01-01 00:00:00',
            updated_at: '2023-01-01 00:00:00',
            synced_at: null,
            cloud_id: null,
          },
          {
            id: 2,
            user_id: 1,
            encrypted_data: 'encryptedData2',
            created_at: '2023-01-02 00:00:00',
            updated_at: '2023-01-02 00:00:00',
            synced_at: '2023-01-02 01:00:00',
            cloud_id: 'cloud-id-123',
          },
        ];
        mockDb.getAllAsync.mockResolvedValue(mockLogs);

        const logs = await databaseService.getHealthLogsByUserId(1);

        expect(logs).toEqual(mockLogs);
        expect(mockDb.getAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM health_logs'),
          [1]
        );
      });

      it('should return empty array when no logs found', async () => {
        mockDb.getAllAsync.mockResolvedValue([]);

        const logs = await databaseService.getHealthLogsByUserId(1);

        expect(logs).toEqual([]);
      });

      it('should throw error if query fails', async () => {
        mockDb.getAllAsync.mockRejectedValue(new Error('Database error'));

        await expect(
          databaseService.getHealthLogsByUserId(1)
        ).rejects.toThrow('Failed to get health logs: Error: Database error');
      });
    });

    describe('getHealthLogById', () => {
      it('should return health log when found', async () => {
        const mockLog: HealthLogRecord = {
          id: 1,
          user_id: 1,
          encrypted_data: 'encryptedData',
          created_at: '2023-01-01 00:00:00',
          updated_at: '2023-01-01 00:00:00',
          synced_at: null,
          cloud_id: null,
        };
        mockDb.getFirstAsync.mockResolvedValue(mockLog);

        const log = await databaseService.getHealthLogById(1);

        expect(log).toEqual(mockLog);
        expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM health_logs WHERE id = ?'),
          [1]
        );
      });

      it('should return null when log not found', async () => {
        mockDb.getFirstAsync.mockResolvedValue(null);

        const log = await databaseService.getHealthLogById(999);

        expect(log).toBeNull();
      });
    });

    describe('updateHealthLog', () => {
      it('should update health log successfully', async () => {
        mockDb.runAsync.mockResolvedValue({});

        await databaseService.updateHealthLog(1, 'updatedEncryptedData');

        expect(mockDb.runAsync).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE health_logs'),
          ['updatedEncryptedData', 1]
        );
      });

      it('should throw error if update fails', async () => {
        mockDb.runAsync.mockRejectedValue(new Error('Update failed'));

        await expect(
          databaseService.updateHealthLog(1, 'updatedEncryptedData')
        ).rejects.toThrow('Failed to update health log: Error: Update failed');
      });
    });

    describe('deleteHealthLog', () => {
      it('should delete health log successfully', async () => {
        mockDb.runAsync.mockResolvedValue({});

        await databaseService.deleteHealthLog(1);

        expect(mockDb.runAsync).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM health_logs WHERE id = ?'),
          [1]
        );
      });

      it('should throw error if delete fails', async () => {
        mockDb.runAsync.mockRejectedValue(new Error('Delete failed'));

        await expect(
          databaseService.deleteHealthLog(1)
        ).rejects.toThrow('Failed to delete health log: Error: Delete failed');
      });
    });

    describe('markHealthLogAsSynced', () => {
      it('should mark health log as synced successfully', async () => {
        mockDb.runAsync.mockResolvedValue({});

        await databaseService.markHealthLogAsSynced(1, 'cloud-id-123');

        expect(mockDb.runAsync).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE health_logs'),
          ['cloud-id-123', 1]
        );
      });

      it('should throw error if marking as synced fails', async () => {
        mockDb.runAsync.mockRejectedValue(new Error('Sync update failed'));

        await expect(
          databaseService.markHealthLogAsSynced(1, 'cloud-id-123')
        ).rejects.toThrow('Failed to mark health log as synced: Error: Sync update failed');
      });
    });

    describe('getUnsyncedHealthLogs', () => {
      it('should return unsynced health logs for user', async () => {
        const mockLogs: HealthLogRecord[] = [
          {
            id: 1,
            user_id: 1,
            encrypted_data: 'encryptedData1',
            created_at: '2023-01-01 00:00:00',
            updated_at: '2023-01-01 00:00:00',
            synced_at: null,
            cloud_id: null,
          },
        ];
        mockDb.getAllAsync.mockResolvedValue(mockLogs);

        const logs = await databaseService.getUnsyncedHealthLogs(1);

        expect(logs).toEqual(mockLogs);
        expect(mockDb.getAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM health_logs'),
          [1]
        );
      });

      it('should return empty array when no unsynced logs found', async () => {
        mockDb.getAllAsync.mockResolvedValue([]);

        const logs = await databaseService.getUnsyncedHealthLogs(1);

        expect(logs).toEqual([]);
      });
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      mockDb.getFirstAsync.mockResolvedValue({ version: 1 });
      await databaseService.initialize();
    });

    describe('close', () => {
      it('should close database connection', async () => {
        await databaseService.close();

        expect(mockDb.closeAsync).toHaveBeenCalled();
      });

      it('should handle closing when database is null', async () => {
        await databaseService.close();
        await databaseService.close(); // Second call should not throw

        expect(mockDb.closeAsync).toHaveBeenCalledTimes(1);
      });
    });

    describe('clearAllData', () => {
      it('should clear all data from tables', async () => {
        mockDb.execAsync.mockResolvedValue({});

        await databaseService.clearAllData();

        expect(mockDb.execAsync).toHaveBeenCalledWith('DELETE FROM health_logs');
        expect(mockDb.execAsync).toHaveBeenCalledWith('DELETE FROM users');
        expect(mockDb.execAsync).toHaveBeenCalledWith('DELETE FROM migrations');
      });

      it('should throw error if clearing data fails', async () => {
        mockDb.execAsync.mockRejectedValue(new Error('Clear failed'));

        await expect(databaseService.clearAllData()).rejects.toThrow(
          'Failed to clear data: Error: Clear failed'
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when database not initialized for user operations', async () => {
      await expect(
        databaseService.createUser('test@example.com', 'hash', 'key')
      ).rejects.toThrow('Database not initialized');
    });

    it('should throw error when database not initialized for health log operations', async () => {
      await expect(
        databaseService.createHealthLog(1, 'data')
      ).rejects.toThrow('Database not initialized');
    });

    it('should throw error when database not initialized for utility operations', async () => {
      await expect(databaseService.clearAllData()).rejects.toThrow('Database not initialized');
    });
  });
});