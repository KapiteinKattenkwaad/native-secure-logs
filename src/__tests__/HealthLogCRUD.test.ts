import { HealthLogService } from '../services/HealthLogService';
import { DatabaseService } from '../services/DatabaseService';
import { AuthService } from '../services/AuthService';
import { HealthLog, CreateHealthLogData, UpdateHealthLogData } from '../types';

// Integration test for complete CRUD workflows
describe('Health Log CRUD Integration', () => {
  let healthLogService: HealthLogService;
  let databaseService: DatabaseService;
  let authService: AuthService;
  let testUser: any;

  beforeEach(async () => {
    // Get real instances for integration testing
    authService = AuthService.getInstance();
    databaseService = DatabaseService.getInstance();
    
    // Initialize database
    await databaseService.initialize();
    
    // Clear any existing data
    await databaseService.clearAllData();

    // Create a test user
    const credentials = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
    };

    testUser = await authService.register(credentials);
    
    // Initialize health log service with user's encryption key
    healthLogService = new HealthLogService(testUser.encryptionKey, databaseService);
  });

  afterEach(async () => {
    // Clean up
    await databaseService.clearAllData();
    await databaseService.close();
  });

  describe('Create Health Log', () => {
    it('should create a new health log with encryption', async () => {
      const healthLogData: CreateHealthLogData = {
        title: 'Morning Headache',
        description: 'Woke up with a mild headache on the left side',
        category: 'symptom',
        severity: 2,
        tags: ['headache', 'morning'],
        date: '2024-01-15',
        notes: 'Might be related to poor sleep',
        attachments: [],
      };

      const createdLog = await healthLogService.createHealthLog(testUser.id, healthLogData);

      expect(createdLog).toEqual({
        id: expect.any(String),
        title: 'Morning Headache',
        description: 'Woke up with a mild headache on the left side',
        category: 'symptom',
        severity: 2,
        tags: ['headache', 'morning'],
        date: '2024-01-15',
        notes: 'Might be related to poor sleep',
        attachments: [],
      });

      // Verify it was stored encrypted in database
      const encryptedLogs = await databaseService.getHealthLogsByUserId(testUser.id);
      expect(encryptedLogs).toHaveLength(1);
      expect(encryptedLogs[0].encrypted_data).toBeTruthy();
      expect(encryptedLogs[0].encrypted_data).not.toContain('Morning Headache');
    });

    it('should validate health log data before creation', async () => {
      const invalidData: CreateHealthLogData = {
        title: '', // Invalid: empty title
        description: 'Test description',
        category: 'symptom',
        tags: [],
        date: '2024-01-15',
        attachments: [],
      };

      await expect(healthLogService.createHealthLog(testUser.id, invalidData))
        .rejects.toThrow('Validation failed');
    });

    it('should sanitize health log data during creation', async () => {
      const dataWithWhitespace: CreateHealthLogData = {
        title: '  Morning Headache  ',
        description: '  Woke up with a headache  ',
        category: 'symptom',
        tags: ['  headache  ', '  morning  ', ''],
        date: '2024-01-15',
        notes: '  Some notes  ',
        attachments: ['  attachment1  ', ''],
      };

      const createdLog = await healthLogService.createHealthLog(testUser.id, dataWithWhitespace);

      expect(createdLog.title).toBe('Morning Headache');
      expect(createdLog.description).toBe('Woke up with a headache');
      expect(createdLog.tags).toEqual(['headache', 'morning']);
      expect(createdLog.notes).toBe('Some notes');
      expect(createdLog.attachments).toEqual(['attachment1']);
    });
  });

  describe('Read Health Logs', () => {
    let createdLogs: HealthLog[];

    beforeEach(async () => {
      // Create multiple test logs
      const logData1: CreateHealthLogData = {
        title: 'Morning Headache',
        description: 'Mild headache',
        category: 'symptom',
        severity: 2,
        tags: ['headache'],
        date: '2024-01-15',
        attachments: [],
      };

      const logData2: CreateHealthLogData = {
        title: 'Blood Pressure Check',
        description: 'Regular BP measurement',
        category: 'measurement',
        tags: ['blood-pressure'],
        date: '2024-01-16',
        attachments: [],
      };

      const logData3: CreateHealthLogData = {
        title: 'Doctor Appointment',
        description: 'Annual checkup',
        category: 'appointment',
        tags: ['checkup'],
        date: '2024-01-17',
        attachments: [],
      };

      createdLogs = [
        await healthLogService.createHealthLog(testUser.id, logData1),
        await healthLogService.createHealthLog(testUser.id, logData2),
        await healthLogService.createHealthLog(testUser.id, logData3),
      ];
    });

    it('should retrieve all health logs for a user', async () => {
      const allLogs = await healthLogService.getAllHealthLogs(testUser.id);

      expect(allLogs).toHaveLength(3);
      
      // Should be sorted by date (most recent first)
      expect(allLogs[0].title).toBe('Doctor Appointment');
      expect(allLogs[1].title).toBe('Blood Pressure Check');
      expect(allLogs[2].title).toBe('Morning Headache');
    });

    it('should retrieve a specific health log by database ID', async () => {
      // Get the database ID for the first log
      const encryptedLogs = await databaseService.getHealthLogsByUserId(testUser.id);
      const firstEncryptedLog = encryptedLogs[0];

      const retrievedLog = await healthLogService.getHealthLog(firstEncryptedLog.id);

      expect(retrievedLog).toBeTruthy();
      expect(retrievedLog!.title).toBe(createdLogs[0].title);
      expect(retrievedLog!.description).toBe(createdLogs[0].description);
    });

    it('should return null for non-existent health log', async () => {
      const nonExistentLog = await healthLogService.getHealthLog(99999);
      expect(nonExistentLog).toBeNull();
    });

    it('should handle decryption errors gracefully', async () => {
      // Create a log with corrupted encrypted data
      await databaseService.createHealthLog(testUser.id, 'corrupted-encrypted-data');

      // Should still return other valid logs
      const allLogs = await healthLogService.getAllHealthLogs(testUser.id);
      expect(allLogs).toHaveLength(3); // Original 3 logs, corrupted one filtered out
    });

    it('should search health logs by title and description', async () => {
      const searchResults = await healthLogService.searchHealthLogs(testUser.id, 'headache');
      
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].title).toBe('Morning Headache');
    });

    it('should filter health logs by category', async () => {
      const symptomLogs = await healthLogService.getHealthLogsByCategory(testUser.id, 'symptom');
      
      expect(symptomLogs).toHaveLength(1);
      expect(symptomLogs[0].title).toBe('Morning Headache');
    });
  });

  describe('Update Health Log', () => {
    let createdLog: HealthLog;
    let databaseId: number;

    beforeEach(async () => {
      const logData: CreateHealthLogData = {
        title: 'Original Title',
        description: 'Original description',
        category: 'symptom',
        severity: 2,
        tags: ['original'],
        date: '2024-01-15',
        notes: 'Original notes',
        attachments: [],
      };

      createdLog = await healthLogService.createHealthLog(testUser.id, logData);
      
      // Get database ID
      const encryptedLogs = await databaseService.getHealthLogsByUserId(testUser.id);
      databaseId = encryptedLogs[0].id;
    });

    it('should update an existing health log with re-encryption', async () => {
      const updateData: UpdateHealthLogData = {
        id: createdLog.id,
        title: 'Updated Title',
        description: 'Updated description',
        severity: 4,
        tags: ['updated', 'severe'],
        notes: 'Updated notes',
      };

      const updatedLog = await healthLogService.updateHealthLog(databaseId, updateData);

      expect(updatedLog).toEqual({
        id: createdLog.id, // ID should remain the same
        title: 'Updated Title',
        description: 'Updated description',
        category: 'symptom', // Unchanged fields should remain
        severity: 4,
        tags: ['updated', 'severe'],
        date: '2024-01-15', // Unchanged
        notes: 'Updated notes',
        attachments: [],
      });

      // Verify it was re-encrypted in database
      const encryptedLogs = await databaseService.getHealthLogsByUserId(testUser.id);
      expect(encryptedLogs[0].encrypted_data).not.toContain('Original Title');
      expect(encryptedLogs[0].encrypted_data).not.toContain('Updated Title');
    });

    it('should validate update data', async () => {
      const invalidUpdateData: UpdateHealthLogData = {
        id: createdLog.id,
        title: '', // Invalid: empty title
      };

      await expect(healthLogService.updateHealthLog(databaseId, invalidUpdateData))
        .rejects.toThrow('Validation failed');
    });

    it('should sanitize update data', async () => {
      const updateDataWithWhitespace: UpdateHealthLogData = {
        id: createdLog.id,
        title: '  Updated Title  ',
        tags: ['  updated  ', '  tag  ', ''],
        notes: '  Updated notes  ',
      };

      const updatedLog = await healthLogService.updateHealthLog(databaseId, updateDataWithWhitespace);

      expect(updatedLog.title).toBe('Updated Title');
      expect(updatedLog.tags).toEqual(['updated', 'tag']);
      expect(updatedLog.notes).toBe('Updated notes');
    });

    it('should throw error for non-existent health log', async () => {
      const updateData: UpdateHealthLogData = {
        id: createdLog.id,
        title: 'Updated Title',
      };

      await expect(healthLogService.updateHealthLog(99999, updateData))
        .rejects.toThrow('Health log not found');
    });

    it('should require ID in update data', async () => {
      const updateDataWithoutId = {
        title: 'Updated Title',
      } as UpdateHealthLogData;

      await expect(healthLogService.updateHealthLog(databaseId, updateDataWithoutId))
        .rejects.toThrow('ID is required for updates');
    });
  });

  describe('Delete Health Log', () => {
    let createdLog: HealthLog;
    let databaseId: number;

    beforeEach(async () => {
      const logData: CreateHealthLogData = {
        title: 'Log to Delete',
        description: 'This log will be deleted',
        category: 'other',
        tags: ['delete-test'],
        date: '2024-01-15',
        attachments: [],
      };

      createdLog = await healthLogService.createHealthLog(testUser.id, logData);
      
      // Get database ID
      const encryptedLogs = await databaseService.getHealthLogsByUserId(testUser.id);
      databaseId = encryptedLogs[0].id;
    });

    it('should delete an existing health log', async () => {
      // Verify log exists before deletion
      const logBeforeDeletion = await healthLogService.getHealthLog(databaseId);
      expect(logBeforeDeletion).toBeTruthy();

      // Delete the log
      await healthLogService.deleteHealthLog(databaseId);

      // Verify log no longer exists
      const logAfterDeletion = await healthLogService.getHealthLog(databaseId);
      expect(logAfterDeletion).toBeNull();

      // Verify it's removed from user's logs
      const allLogs = await healthLogService.getAllHealthLogs(testUser.id);
      expect(allLogs).toHaveLength(0);
    });

    it('should throw error for non-existent health log', async () => {
      await expect(healthLogService.deleteHealthLog(99999))
        .rejects.toThrow('Health log not found');
    });
  });

  describe('Complete CRUD Workflow', () => {
    it('should handle complete create-read-update-delete workflow', async () => {
      // CREATE
      const createData: CreateHealthLogData = {
        title: 'Workflow Test Log',
        description: 'Testing complete CRUD workflow',
        category: 'other',
        tags: ['workflow', 'test'],
        date: '2024-01-15',
        notes: 'Initial notes',
        attachments: [],
      };

      const createdLog = await healthLogService.createHealthLog(testUser.id, createData);
      expect(createdLog.title).toBe('Workflow Test Log');

      // READ
      const allLogs = await healthLogService.getAllHealthLogs(testUser.id);
      expect(allLogs).toHaveLength(1);
      expect(allLogs[0].id).toBe(createdLog.id);

      // Get database ID for update/delete operations
      const encryptedLogs = await databaseService.getHealthLogsByUserId(testUser.id);
      const databaseId = encryptedLogs[0].id;

      // UPDATE
      const updateData: UpdateHealthLogData = {
        id: createdLog.id,
        title: 'Updated Workflow Test Log',
        description: 'Updated description for workflow test',
        notes: 'Updated notes',
      };

      const updatedLog = await healthLogService.updateHealthLog(databaseId, updateData);
      expect(updatedLog.title).toBe('Updated Workflow Test Log');
      expect(updatedLog.description).toBe('Updated description for workflow test');
      expect(updatedLog.category).toBe('other'); // Unchanged field

      // Verify update in database
      const logsAfterUpdate = await healthLogService.getAllHealthLogs(testUser.id);
      expect(logsAfterUpdate).toHaveLength(1);
      expect(logsAfterUpdate[0].title).toBe('Updated Workflow Test Log');

      // DELETE
      await healthLogService.deleteHealthLog(databaseId);

      // Verify deletion
      const logsAfterDelete = await healthLogService.getAllHealthLogs(testUser.id);
      expect(logsAfterDelete).toHaveLength(0);
    });

    it('should handle multiple health logs with different operations', async () => {
      // Create multiple logs
      const logs = [];
      for (let i = 1; i <= 3; i++) {
        const logData: CreateHealthLogData = {
          title: `Test Log ${i}`,
          description: `Description for log ${i}`,
          category: 'other',
          tags: [`tag${i}`],
          date: `2024-01-${15 + i}`,
          attachments: [],
        };
        logs.push(await healthLogService.createHealthLog(testUser.id, logData));
      }

      // Verify all created
      let allLogs = await healthLogService.getAllHealthLogs(testUser.id);
      expect(allLogs).toHaveLength(3);

      // Update middle log
      const encryptedLogs = await databaseService.getHealthLogsByUserId(testUser.id);
      const middleLogDbId = encryptedLogs.find(log => {
        // Find the middle log by decrypting and checking title
        try {
          const decryptionResult = require('../services/EncryptionService').EncryptionService.decrypt(
            log.encrypted_data, 
            testUser.encryptionKey
          );
          if (decryptionResult.success) {
            const decryptedLog = JSON.parse(decryptionResult.decryptedData);
            return decryptedLog.title === 'Test Log 2';
          }
        } catch {
          return false;
        }
        return false;
      })?.id;

      expect(middleLogDbId).toBeTruthy();

      const updateData: UpdateHealthLogData = {
        id: logs[1].id,
        title: 'Updated Test Log 2',
      };

      await healthLogService.updateHealthLog(middleLogDbId!, updateData);

      // Delete first log
      const firstLogDbId = encryptedLogs.find(log => {
        try {
          const decryptionResult = require('../services/EncryptionService').EncryptionService.decrypt(
            log.encrypted_data, 
            testUser.encryptionKey
          );
          if (decryptionResult.success) {
            const decryptedLog = JSON.parse(decryptionResult.decryptedData);
            return decryptedLog.title === 'Test Log 1';
          }
        } catch {
          return false;
        }
        return false;
      })?.id;

      await healthLogService.deleteHealthLog(firstLogDbId!);

      // Verify final state
      allLogs = await healthLogService.getAllHealthLogs(testUser.id);
      expect(allLogs).toHaveLength(2);
      
      const titles = allLogs.map(log => log.title).sort();
      expect(titles).toEqual(['Test Log 3', 'Updated Test Log 2']);
    });
  });

  describe('Error Handling', () => {
    it('should handle encryption errors', async () => {
      // Create service with empty encryption key to force encryption failure
      const invalidService = new HealthLogService('', databaseService);

      const logData: CreateHealthLogData = {
        title: 'Test Log',
        description: 'Test description',
        category: 'other',
        tags: [],
        date: '2024-01-15',
        attachments: [],
      };

      await expect(invalidService.createHealthLog(testUser.id, logData))
        .rejects.toThrow('Failed to create health log');
    });
  });
});