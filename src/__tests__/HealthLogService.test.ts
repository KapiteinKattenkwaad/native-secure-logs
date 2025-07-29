import { HealthLogService } from '../services/HealthLogService';
import { EncryptionService } from '../services/EncryptionService';
import { DatabaseService } from '../services/DatabaseService';
import { CreateHealthLogData, UpdateHealthLogData, HealthLog } from '../types';

// Mock the dependencies
jest.mock('../services/EncryptionService');
jest.mock('../services/DatabaseService');

describe('HealthLogService', () => {
  let healthLogService: HealthLogService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  const userId = 123;
  const encryptionKey = 'test-encryption-key';
  const validHealthLogData: CreateHealthLogData = {
    title: 'Test Health Log',
    description: 'This is a test health log description',
    category: 'symptom',
    severity: 3,
    tags: ['test', 'symptom'],
    date: '2024-01-15T10:00:00.000Z',
    notes: 'Some additional notes',
    attachments: ['attachment1.jpg']
  };

  beforeEach(() => {
    // Create mocked instances
    mockDatabaseService = {
      createHealthLog: jest.fn(),
      getHealthLogById: jest.fn(),
      getHealthLogsByUserId: jest.fn(),
      updateHealthLog: jest.fn(),
      deleteHealthLog: jest.fn(),
    } as any;
    
    // Create service instance with mocked dependencies
    healthLogService = new HealthLogService(encryptionKey, mockDatabaseService);

    // Setup default mock implementations
    (EncryptionService.encrypt as jest.Mock) = jest.fn().mockReturnValue({
      encryptedData: 'encrypted_data',
      success: true
    });
    (EncryptionService.decrypt as jest.Mock) = jest.fn().mockReturnValue({
      decryptedData: '{"id":"test_id","title":"Test"}',
      success: true
    });
    
    mockDatabaseService.createHealthLog.mockResolvedValue(1);
    mockDatabaseService.getHealthLogById.mockResolvedValue({
      id: 1,
      user_id: userId,
      encrypted_data: 'encrypted_data',
      created_at: '2024-01-15T10:00:00.000Z',
      updated_at: '2024-01-15T10:00:00.000Z',
      synced_at: null,
      cloud_id: null
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createHealthLog', () => {
    it('should create a health log successfully', async () => {
      const result = await healthLogService.createHealthLog(userId, validHealthLogData);

      expect(result).toMatchObject({
        title: validHealthLogData.title,
        description: validHealthLogData.description,
        category: validHealthLogData.category,
        severity: validHealthLogData.severity,
        tags: validHealthLogData.tags,
        date: validHealthLogData.date,
        notes: validHealthLogData.notes,
        attachments: validHealthLogData.attachments
      });
      expect(result.id).toBeDefined();
      expect(EncryptionService.encrypt).toHaveBeenCalledWith(JSON.stringify(result), encryptionKey);
      expect(mockDatabaseService.createHealthLog).toHaveBeenCalledWith(
        userId,
        'encrypted_data'
      );
    });

    it('should sanitize data before creating', async () => {
      const dataWithWhitespace: CreateHealthLogData = {
        ...validHealthLogData,
        title: '  Test Title  ',
        description: '  Test Description  ',
        tags: ['  tag1  ', '  tag2  ', ''],
        notes: '  Some notes  '
      };

      const result = await healthLogService.createHealthLog(userId, dataWithWhitespace);

      expect(result.title).toBe('Test Title');
      expect(result.description).toBe('Test Description');
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.notes).toBe('Some notes');
    });

    it('should throw error for invalid data', async () => {
      const invalidData = { ...validHealthLogData, title: '' };

      await expect(healthLogService.createHealthLog(userId, invalidData))
        .rejects.toThrow('Validation failed');
    });

    it('should throw error when encryption fails', async () => {
      (EncryptionService.encrypt as jest.Mock).mockReturnValue({
        encryptedData: '',
        success: false,
        error: 'Encryption failed'
      });

      await expect(healthLogService.createHealthLog(userId, validHealthLogData))
        .rejects.toThrow('Failed to create health log: Encryption failed');
    });

    it('should throw error when database operation fails', async () => {
      mockDatabaseService.createHealthLog.mockRejectedValue(new Error('Database error'));

      await expect(healthLogService.createHealthLog(userId, validHealthLogData))
        .rejects.toThrow('Failed to create health log: Database error');
    });
  });

  describe('getHealthLog', () => {
    const healthLogId = 123;
    const mockHealthLog: HealthLog = {
      id: 'health_log_123',
      title: 'Test Log',
      description: 'Test Description',
      category: 'symptom',
      tags: ['test'],
      date: '2024-01-15T10:00:00.000Z'
    };

    it('should retrieve and decrypt a health log successfully', async () => {
      mockDatabaseService.getHealthLogById.mockResolvedValue({
        id: healthLogId,
        user_id: userId,
        encrypted_data: 'encrypted_data',
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        synced_at: null,
        cloud_id: null
      });
      (EncryptionService.decrypt as jest.Mock).mockReturnValue({
        decryptedData: JSON.stringify(mockHealthLog),
        success: true
      });

      const result = await healthLogService.getHealthLog(healthLogId);

      expect(result).toEqual(mockHealthLog);
      expect(mockDatabaseService.getHealthLogById).toHaveBeenCalledWith(healthLogId);
      expect(EncryptionService.decrypt).toHaveBeenCalledWith('encrypted_data', encryptionKey);
    });

    it('should return null when health log not found', async () => {
      mockDatabaseService.getHealthLogById.mockResolvedValue(null);

      const result = await healthLogService.getHealthLog(healthLogId);

      expect(result).toBeNull();
    });

    it('should throw error when decryption fails', async () => {
      (EncryptionService.decrypt as jest.Mock).mockReturnValue({
        decryptedData: '',
        success: false,
        error: 'Decryption failed'
      });

      await expect(healthLogService.getHealthLog(healthLogId))
        .rejects.toThrow('Failed to retrieve health log: Decryption failed');
    });
  });

  describe('getAllHealthLogs', () => {
    const mockHealthLogs = [
      {
        id: 1,
        user_id: userId,
        encrypted_data: 'encrypted_data_1',
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        synced_at: null,
        cloud_id: null
      },
      {
        id: 2,
        user_id: userId,
        encrypted_data: 'encrypted_data_2',
        created_at: '2024-01-16T10:00:00.000Z',
        updated_at: '2024-01-16T10:00:00.000Z',
        synced_at: null,
        cloud_id: null
      }
    ];

    const decryptedLogs: HealthLog[] = [
      {
        id: 'log1',
        title: 'Log 1',
        description: 'Description 1',
        category: 'symptom',
        tags: ['tag1'],
        date: '2024-01-15T10:00:00.000Z'
      },
      {
        id: 'log2',
        title: 'Log 2',
        description: 'Description 2',
        category: 'medication',
        tags: ['tag2'],
        date: '2024-01-16T10:00:00.000Z'
      }
    ];

    it('should retrieve and decrypt all health logs', async () => {
      mockDatabaseService.getHealthLogsByUserId.mockResolvedValue(mockHealthLogs);
      (EncryptionService.decrypt as jest.Mock)
        .mockReturnValueOnce({
          decryptedData: JSON.stringify(decryptedLogs[0]),
          success: true
        })
        .mockReturnValueOnce({
          decryptedData: JSON.stringify(decryptedLogs[1]),
          success: true
        });

      const result = await healthLogService.getAllHealthLogs(userId);

      expect(result).toHaveLength(2);
      // Should be sorted by date (most recent first)
      expect(result[0].date).toBe('2024-01-16T10:00:00.000Z');
      expect(result[1].date).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should handle decryption errors gracefully', async () => {
      mockDatabaseService.getHealthLogsByUserId.mockResolvedValue(mockHealthLogs);
      (EncryptionService.decrypt as jest.Mock)
        .mockReturnValueOnce({
          decryptedData: JSON.stringify(decryptedLogs[0]),
          success: true
        })
        .mockReturnValueOnce({
          decryptedData: '',
          success: false,
          error: 'Decryption failed'
        });

      // Mock console.error to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await healthLogService.getAllHealthLogs(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(decryptedLogs[0]);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to decrypt health log 2:', 'Decryption failed');

      consoleSpy.mockRestore();
    });

    it('should return empty array when no logs exist', async () => {
      mockDatabaseService.getHealthLogsByUserId.mockResolvedValue([]);

      const result = await healthLogService.getAllHealthLogs(userId);

      expect(result).toEqual([]);
    });
  });

  describe('updateHealthLog', () => {
    const healthLogId = 123;
    const existingLog: HealthLog = {
      id: 'health_log_123',
      title: 'Original Title',
      description: 'Original Description',
      category: 'symptom',
      tags: ['original'],
      date: '2024-01-15T10:00:00.000Z'
    };

    const updateData: UpdateHealthLogData = {
      id: 'health_log_123',
      title: 'Updated Title',
      tags: ['updated']
    };

    beforeEach(() => {
      // Mock getHealthLog to return existing log
      mockDatabaseService.getHealthLogById.mockResolvedValue({
        id: healthLogId,
        user_id: userId,
        encrypted_data: 'encrypted_data',
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        synced_at: null,
        cloud_id: null
      });
      (EncryptionService.decrypt as jest.Mock).mockReturnValue({
        decryptedData: JSON.stringify(existingLog),
        success: true
      });
      mockDatabaseService.updateHealthLog.mockResolvedValue();
    });

    it('should update a health log successfully', async () => {
      const result = await healthLogService.updateHealthLog(healthLogId, updateData);

      expect(result).toMatchObject({
        ...existingLog,
        title: 'Updated Title',
        tags: ['updated']
      });
      expect(EncryptionService.encrypt).toHaveBeenCalledWith(JSON.stringify(result), encryptionKey);
      expect(mockDatabaseService.updateHealthLog).toHaveBeenCalledWith(
        healthLogId,
        'encrypted_data'
      );
    });

    it('should throw error when health log not found', async () => {
      mockDatabaseService.getHealthLogById.mockResolvedValue(null);

      await expect(healthLogService.updateHealthLog(healthLogId, updateData))
        .rejects.toThrow('Failed to update health log: Health log not found');
    });

    it('should throw error for invalid update data', async () => {
      const invalidUpdate = { ...updateData, title: '' };

      await expect(healthLogService.updateHealthLog(healthLogId, invalidUpdate))
        .rejects.toThrow('Validation failed');
    });

    it('should sanitize updated data', async () => {
      const updateWithWhitespace: UpdateHealthLogData = {
        id: 'health_log_123',
        title: '  Updated Title  ',
        tags: ['  updated  ', '']
      };

      const result = await healthLogService.updateHealthLog(healthLogId, updateWithWhitespace);

      expect(result.title).toBe('Updated Title');
      expect(result.tags).toEqual(['updated']);
    });
  });

  describe('deleteHealthLog', () => {
    const healthLogId = 123;

    it('should delete a health log successfully', async () => {
      // Mock that the health log exists
      mockDatabaseService.getHealthLogById.mockResolvedValue({
        id: healthLogId,
        user_id: userId,
        encrypted_data: 'encrypted_data',
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        synced_at: null,
        cloud_id: null
      });
      (EncryptionService.decrypt as jest.Mock).mockReturnValue({
        decryptedData: JSON.stringify({
          id: 'health_log_123',
          title: 'Test Log',
          description: 'Test Description',
          category: 'symptom',
          tags: ['test'],
          date: '2024-01-15T10:00:00.000Z'
        }),
        success: true
      });
      mockDatabaseService.deleteHealthLog.mockResolvedValue();

      await healthLogService.deleteHealthLog(healthLogId);

      expect(mockDatabaseService.deleteHealthLog).toHaveBeenCalledWith(healthLogId);
    });

    it('should throw error when health log not found', async () => {
      mockDatabaseService.getHealthLogById.mockResolvedValue(null);

      await expect(healthLogService.deleteHealthLog(healthLogId))
        .rejects.toThrow('Failed to delete health log: Health log not found');
    });
  });

  describe('getHealthLogsByCategory', () => {
    it('should filter health logs by category', async () => {
      const mockLogs: HealthLog[] = [
        {
          id: 'log1',
          title: 'Symptom Log',
          description: 'Description',
          category: 'symptom',
          tags: [],
          date: '2024-01-15T10:00:00.000Z'
        },
        {
          id: 'log2',
          title: 'Medication Log',
          description: 'Description',
          category: 'medication',
          tags: [],
          date: '2024-01-16T10:00:00.000Z'
        }
      ];

      // Mock getAllHealthLogs to return the mock logs
      jest.spyOn(healthLogService, 'getAllHealthLogs').mockResolvedValue(mockLogs);

      const result = await healthLogService.getHealthLogsByCategory(userId, 'symptom');

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('symptom');
    });
  });

  describe('searchHealthLogs', () => {
    it('should search health logs by title, description, tags, and notes', async () => {
      const mockLogs: HealthLog[] = [
        {
          id: 'log1',
          title: 'Headache Log',
          description: 'Severe headache',
          category: 'symptom',
          tags: ['pain'],
          date: '2024-01-15T10:00:00.000Z',
          notes: 'Morning headache'
        },
        {
          id: 'log2',
          title: 'Medication Log',
          description: 'Took aspirin',
          category: 'medication',
          tags: ['headache'],
          date: '2024-01-16T10:00:00.000Z'
        },
        {
          id: 'log3',
          title: 'Exercise Log',
          description: 'Went for a run',
          category: 'other',
          tags: ['fitness'],
          date: '2024-01-17T10:00:00.000Z'
        }
      ];

      // Mock getAllHealthLogs to return the mock logs
      jest.spyOn(healthLogService, 'getAllHealthLogs').mockResolvedValue(mockLogs);

      const result = await healthLogService.searchHealthLogs(userId, 'headache');

      expect(result).toHaveLength(2);
      expect(result.map(log => log.id)).toEqual(['log1', 'log2']);
    });

    it('should perform case-insensitive search', async () => {
      const mockLogs: HealthLog[] = [
        {
          id: 'log1',
          title: 'HEADACHE Log',
          description: 'Description',
          category: 'symptom',
          tags: [],
          date: '2024-01-15T10:00:00.000Z'
        }
      ];

      jest.spyOn(healthLogService, 'getAllHealthLogs').mockResolvedValue(mockLogs);

      const result = await healthLogService.searchHealthLogs(userId, 'headache');

      expect(result).toHaveLength(1);
    });
  });
});