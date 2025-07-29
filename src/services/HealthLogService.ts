import { 
  HealthLog, 
  CreateHealthLogData, 
  UpdateHealthLogData, 
  EncryptedHealthLog 
} from '../types';
import { EncryptionService } from './EncryptionService';
import { DatabaseService } from './DatabaseService';
import { validateHealthLogData, validateUpdateHealthLogData, sanitizeHealthLogData } from '../utils/healthLogValidation';

export class HealthLogService {
  private encryptionKey: string;
  private databaseService: DatabaseService;

  constructor(encryptionKey: string, databaseService: DatabaseService) {
    this.encryptionKey = encryptionKey;
    this.databaseService = databaseService;
  }

  /**
   * Create a new health log with encryption
   */
  async createHealthLog(userId: number, data: CreateHealthLogData): Promise<HealthLog> {
    // Sanitize the data first
    const sanitizedData = sanitizeHealthLogData(data);

    // Validate sanitized data
    const validation = validateHealthLogData(sanitizedData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Generate unique ID for the health log
    const healthLogId = this.generateHealthLogId();

    // Create the health log object
    const healthLog: HealthLog = {
      id: healthLogId,
      ...sanitizedData
    };

    try {
      // Encrypt the health log data
      const encryptionResult = EncryptionService.encrypt(JSON.stringify(healthLog), this.encryptionKey);
      if (!encryptionResult.success) {
        throw new Error(encryptionResult.error || 'Encryption failed');
      }

      // Store in database
      await this.databaseService.createHealthLog(userId, encryptionResult.encryptedData);

      return healthLog;
    } catch (error) {
      throw new Error(`Failed to create health log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve and decrypt a health log by ID
   */
  async getHealthLog(healthLogId: number): Promise<HealthLog | null> {
    try {
      const encryptedLog = await this.databaseService.getHealthLogById(healthLogId);
      if (!encryptedLog) {
        return null;
      }

      // Decrypt the health log data
      const decryptionResult = EncryptionService.decrypt(encryptedLog.encrypted_data, this.encryptionKey);
      if (!decryptionResult.success) {
        throw new Error(decryptionResult.error || 'Decryption failed');
      }
      
      const healthLog: HealthLog = JSON.parse(decryptionResult.decryptedData);

      return healthLog;
    } catch (error) {
      throw new Error(`Failed to retrieve health log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve and decrypt all health logs for a user
   */
  async getAllHealthLogs(userId: number): Promise<HealthLog[]> {
    try {
      const encryptedLogs = await this.databaseService.getHealthLogsByUserId(userId);
      const healthLogs: HealthLog[] = [];

      for (const encryptedLog of encryptedLogs) {
        try {
          const decryptionResult = EncryptionService.decrypt(encryptedLog.encrypted_data, this.encryptionKey);
          if (!decryptionResult.success) {
            console.error(`Failed to decrypt health log ${encryptedLog.id}:`, decryptionResult.error);
            continue;
          }
          
          const healthLog: HealthLog = JSON.parse(decryptionResult.decryptedData);
          healthLogs.push(healthLog);
        } catch (decryptError) {
          // Log the error but continue processing other logs
          console.error(`Failed to decrypt health log ${encryptedLog.id}:`, decryptError);
        }
      }

      // Sort by date (most recent first)
      return healthLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      throw new Error(`Failed to retrieve health logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing health log with re-encryption
   */
  async updateHealthLog(healthLogId: number, data: UpdateHealthLogData): Promise<HealthLog> {
    // First validate that the update data has required ID
    if (!data.id || typeof data.id !== 'string' || data.id.trim().length === 0) {
      throw new Error('Validation failed: ID is required for updates and must be a string');
    }

    try {
      // Get the existing health log
      const existingLog = await this.getHealthLog(healthLogId);
      if (!existingLog) {
        throw new Error('Health log not found');
      }

      // Merge the updates with existing data
      const updatedLog: HealthLog = {
        ...existingLog,
        ...data,
        id: existingLog.id // Ensure ID doesn't change
      };

      // Sanitize the updated data
      const sanitizedLog = {
        ...updatedLog,
        title: updatedLog.title.trim(),
        description: updatedLog.description.trim(),
        tags: updatedLog.tags.map(tag => tag.trim()).filter(tag => tag.length > 0),
        notes: updatedLog.notes?.trim(),
        attachments: updatedLog.attachments?.map(attachment => attachment.trim()).filter(attachment => attachment.length > 0)
      };

      // Validate the complete sanitized data
      const completeValidation = validateHealthLogData(sanitizedLog);
      if (!completeValidation.isValid) {
        throw new Error(`Validation failed: ${completeValidation.errors.map(e => e.message).join(', ')}`);
      }

      // Re-encrypt the updated health log data
      const encryptionResult = EncryptionService.encrypt(JSON.stringify(sanitizedLog), this.encryptionKey);
      if (!encryptionResult.success) {
        throw new Error(encryptionResult.error || 'Encryption failed');
      }

      // Update in database
      await this.databaseService.updateHealthLog(healthLogId, encryptionResult.encryptedData);

      return sanitizedLog;
    } catch (error) {
      throw new Error(`Failed to update health log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a health log
   */
  async deleteHealthLog(healthLogId: number): Promise<void> {
    try {
      // Verify the health log exists
      const existingLog = await this.getHealthLog(healthLogId);
      if (!existingLog) {
        throw new Error('Health log not found');
      }

      // Delete from database
      await this.databaseService.deleteHealthLog(healthLogId);
    } catch (error) {
      throw new Error(`Failed to delete health log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get health logs by category
   */
  async getHealthLogsByCategory(userId: number, category: string): Promise<HealthLog[]> {
    try {
      const allLogs = await this.getAllHealthLogs(userId);
      return allLogs.filter(log => log.category === category);
    } catch (error) {
      throw new Error(`Failed to retrieve health logs by category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search health logs by title or description
   */
  async searchHealthLogs(userId: number, searchTerm: string): Promise<HealthLog[]> {
    try {
      const allLogs = await this.getAllHealthLogs(userId);
      const lowercaseSearch = searchTerm.toLowerCase();
      
      return allLogs.filter(log => 
        log.title.toLowerCase().includes(lowercaseSearch) ||
        log.description.toLowerCase().includes(lowercaseSearch) ||
        log.tags.some(tag => tag.toLowerCase().includes(lowercaseSearch)) ||
        (log.notes && log.notes.toLowerCase().includes(lowercaseSearch))
      );
    } catch (error) {
      throw new Error(`Failed to search health logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a unique ID for health logs
   */
  private generateHealthLogId(): string {
    return `health_log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}