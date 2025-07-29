import * as SQLite from 'expo-sqlite';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  encryption_key: string;
  created_at: string;
  updated_at: string;
}

export interface HealthLogRecord {
  id: number;
  user_id: number;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  cloud_id: string | null;
}

export class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private static instance: DatabaseService;
  private readonly DB_NAME = 'health_logs.db';
  private readonly DB_VERSION = 1;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(this.DB_NAME);
      await this.runMigrations();
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Create migrations table if it doesn't exist
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check current version
    const result = await this.db.getFirstAsync<{ version: number }>(`
      SELECT MAX(version) as version FROM migrations
    `);
    
    const currentVersion = result?.version || 0;

    // Apply migrations
    if (currentVersion < 1) {
      await this.applyMigration1();
    }
  }

  private async applyMigration1(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.execAsync(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        encryption_key TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.db.execAsync(`
      CREATE TABLE health_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        encrypted_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced_at DATETIME NULL,
        cloud_id TEXT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);

    // Create indexes for better performance
    await this.db.execAsync(`
      CREATE INDEX idx_health_logs_user_id ON health_logs(user_id);
    `);

    await this.db.execAsync(`
      CREATE INDEX idx_health_logs_created_at ON health_logs(created_at);
    `);

    // Record migration
    await this.db.runAsync(`
      INSERT INTO migrations (version) VALUES (1)
    `);
  }

  // User CRUD operations
  public async createUser(email: string, passwordHash: string, encryptionKey: string): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.runAsync(`
        INSERT INTO users (email, password_hash, encryption_key, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `, [email, passwordHash, encryptionKey]);

      return result.lastInsertRowId;
    } catch (error) {
      throw new Error(`Failed to create user: ${error}`);
    }
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const user = await this.db.getFirstAsync<User>(`
        SELECT * FROM users WHERE email = ?
      `, [email]);

      return user || null;
    } catch (error) {
      throw new Error(`Failed to get user: ${error}`);
    }
  }

  public async getUserById(id: number): Promise<User | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const user = await this.db.getFirstAsync<User>(`
        SELECT * FROM users WHERE id = ?
      `, [id]);

      return user || null;
    } catch (error) {
      throw new Error(`Failed to get user: ${error}`);
    }
  }

  // Health Log CRUD operations
  public async createHealthLog(userId: number, encryptedData: string): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.runAsync(`
        INSERT INTO health_logs (user_id, encrypted_data, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `, [userId, encryptedData]);

      return result.lastInsertRowId;
    } catch (error) {
      throw new Error(`Failed to create health log: ${error}`);
    }
  }

  public async getHealthLogsByUserId(userId: number): Promise<HealthLogRecord[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const logs = await this.db.getAllAsync<HealthLogRecord>(`
        SELECT * FROM health_logs 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `, [userId]);

      return logs || [];
    } catch (error) {
      throw new Error(`Failed to get health logs: ${error}`);
    }
  }

  public async getHealthLogById(id: number): Promise<HealthLogRecord | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const log = await this.db.getFirstAsync<HealthLogRecord>(`
        SELECT * FROM health_logs WHERE id = ?
      `, [id]);

      return log || null;
    } catch (error) {
      throw new Error(`Failed to get health log: ${error}`);
    }
  }

  public async updateHealthLog(id: number, encryptedData: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.runAsync(`
        UPDATE health_logs 
        SET encrypted_data = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [encryptedData, id]);
    } catch (error) {
      throw new Error(`Failed to update health log: ${error}`);
    }
  }

  public async deleteHealthLog(id: number): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.runAsync(`
        DELETE FROM health_logs WHERE id = ?
      `, [id]);
    } catch (error) {
      throw new Error(`Failed to delete health log: ${error}`);
    }
  }

  public async markHealthLogAsSynced(id: number, cloudId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.runAsync(`
        UPDATE health_logs 
        SET synced_at = CURRENT_TIMESTAMP, cloud_id = ?
        WHERE id = ?
      `, [cloudId, id]);
    } catch (error) {
      throw new Error(`Failed to mark health log as synced: ${error}`);
    }
  }

  public async getUnsyncedHealthLogs(userId: number): Promise<HealthLogRecord[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const logs = await this.db.getAllAsync<HealthLogRecord>(`
        SELECT * FROM health_logs 
        WHERE user_id = ? AND synced_at IS NULL
        ORDER BY created_at ASC
      `, [userId]);

      return logs || [];
    } catch (error) {
      throw new Error(`Failed to get unsynced health logs: ${error}`);
    }
  }

  // Utility methods
  public async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }

  public async clearAllData(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.execAsync(`DELETE FROM health_logs`);
      await this.db.execAsync(`DELETE FROM users`);
      await this.db.execAsync(`DELETE FROM migrations`);
    } catch (error) {
      throw new Error(`Failed to clear data: ${error}`);
    }
  }
}