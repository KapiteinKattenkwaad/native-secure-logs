import { HealthLogService } from '../services/HealthLogService';
import { DatabaseService } from '../services/DatabaseService';
import { CreateHealthLogData } from '../types';

// Test database connection errors separately to avoid singleton issues
describe('Health Log Database Error Handling', () => {
  it('should handle database connection errors gracefully', async () => {
    // Create a mock database service that simulates connection errors
    const mockDatabaseService = {
      createHealthLog: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      getHealthLogById: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      getHealthLogsByUserId: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      updateHealthLog: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      deleteHealthLog: jest.fn().mockRejectedValue(new Error('Database connection failed')),
    } as any;

    const healthLogService = new HealthLogService('test-key', mockDatabaseService);

    const logData: CreateHealthLogData = {
      title: 'Test Log',
      description: 'Test description',
      category: 'other',
      tags: [],
      date: '2024-01-15',
      attachments: [],
    };

    await expect(healthLogService.createHealthLog(1, logData))
      .rejects.toThrow('Failed to create health log');

    await expect(healthLogService.getAllHealthLogs(1))
      .rejects.toThrow('Failed to retrieve health logs');

    await expect(healthLogService.getHealthLog(1))
      .rejects.toThrow('Failed to retrieve health log');

    await expect(healthLogService.updateHealthLog(1, { id: 'test', title: 'Updated' }))
      .rejects.toThrow('Failed to update health log');

    await expect(healthLogService.deleteHealthLog(1))
      .rejects.toThrow('Failed to delete health log');
  });
});