import { supabase, SupabaseHealthLog } from '../config/supabase';
import { DatabaseService, HealthLogRecord } from './DatabaseService';
import { AuthService } from './AuthService';
import * as Crypto from 'expo-crypto';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: SyncError[];
}

export interface SyncError {
  localId: number;
  error: string;
  retryable: boolean;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
}

export class SyncService {
  private static instance: SyncService;
  private databaseService: DatabaseService;
  private authService: AuthService;
  private isSyncing = false;
  private deviceId: string | null = null;

  private constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.authService = AuthService.getInstance();
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * Initialize the sync service and generate device ID
   */
  public async initialize(): Promise<void> {
    try {
      // Generate a unique device ID for this installation
      this.deviceId = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${Date.now()}-${Math.random()}`
      );
    } catch (error) {
      throw new Error(`Failed to initialize sync service: ${error}`);
    }
  }

  /**
   * Check if the device is online and can connect to Supabase
   */
  public async checkConnectivity(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('health_logs')
        .select('id')
        .limit(1);
      
      return !error;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current sync status
   */
  public async getSyncStatus(userId: number): Promise<SyncStatus> {
    const isOnline = await this.checkConnectivity();
    const unsyncedLogs = await this.databaseService.getUnsyncedHealthLogs(userId);
    
    return {
      isOnline,
      isSyncing: this.isSyncing,
      lastSyncAt: null, // TODO: Store last sync timestamp
      pendingCount: unsyncedLogs.length,
    };
  }

  /**
   * Sync all unsynced health logs to Supabase
   */
  public async syncHealthLogs(userId: number): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    if (!this.deviceId) {
      throw new Error('Sync service not initialized');
    }

    this.isSyncing = true;
    
    try {
      // Check connectivity first
      const isOnline = await this.checkConnectivity();
      if (!isOnline) {
        throw new Error('No internet connection available');
      }

      // Get current user's Supabase session
      const supabaseUser = await this.getSupabaseUser();
      if (!supabaseUser) {
        throw new Error('User not authenticated with Supabase');
      }

      // Get unsynced logs from local database
      const unsyncedLogs = await this.databaseService.getUnsyncedHealthLogs(userId);
      
      if (unsyncedLogs.length === 0) {
        return {
          success: true,
          syncedCount: 0,
          failedCount: 0,
          errors: [],
        };
      }

      const result: SyncResult = {
        success: true,
        syncedCount: 0,
        failedCount: 0,
        errors: [],
      };

      // Upload each log to Supabase
      for (const log of unsyncedLogs) {
        try {
          const cloudId = await this.uploadHealthLog(log, supabaseUser.id);
          await this.databaseService.markHealthLogAsSynced(log.id, cloudId);
          result.syncedCount++;
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            localId: log.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            retryable: this.isRetryableError(error),
          });
        }
      }

      // Mark overall success based on whether any logs were synced
      result.success = result.syncedCount > 0 || result.failedCount === 0;

      return result;
    } catch (error) {
      throw new Error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Upload a single health log to Supabase
   */
  private async uploadHealthLog(log: HealthLogRecord, supabaseUserId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('health_logs')
        .insert({
          user_id: supabaseUserId,
          encrypted_data: log.encrypted_data,
          device_id: this.deviceId!,
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Supabase insert error: ${error.message}`);
      }

      if (!data?.id) {
        throw new Error('No ID returned from Supabase insert');
      }

      return data.id;
    } catch (error) {
      throw new Error(`Failed to upload health log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the current Supabase user session
   */
  private async getSupabaseUser(): Promise<{ id: string } | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        throw new Error(`Failed to get Supabase user: ${error.message}`);
      }

      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Authenticate with Supabase using local user credentials
   */
  public async authenticateWithSupabase(email: string, password: string): Promise<void> {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(`Supabase authentication failed: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Failed to authenticate with Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign out from Supabase
   */
  public async signOutFromSupabase(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw new Error(`Failed to sign out from Supabase: ${error.message}`);
      }
    } catch (error) {
      // Log error but don't throw - sign out should be best effort
      console.warn('Error signing out from Supabase:', error);
    }
  }

  /**
   * Register a new user with Supabase
   */
  public async registerWithSupabase(email: string, password: string): Promise<void> {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw new Error(`Supabase registration failed: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Failed to register with Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Network-related errors are typically retryable
      if (message.includes('network') || 
          message.includes('timeout') || 
          message.includes('connection') ||
          message.includes('fetch')) {
        return true;
      }

      // Server errors (5xx) are typically retryable
      if (message.includes('500') || 
          message.includes('502') || 
          message.includes('503') || 
          message.includes('504')) {
        return true;
      }

      // Rate limiting is retryable
      if (message.includes('rate limit') || message.includes('429')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Retry failed syncs with exponential backoff
   */
  public async retrySyncWithBackoff(userId: number, maxRetries: number = 3): Promise<SyncResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.syncHealthLogs(userId);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Get sync statistics
   */
  public async getSyncStats(userId: number): Promise<{
    totalLogs: number;
    syncedLogs: number;
    unsyncedLogs: number;
    syncPercentage: number;
  }> {
    const allLogs = await this.databaseService.getHealthLogsByUserId(userId);
    const unsyncedLogs = await this.databaseService.getUnsyncedHealthLogs(userId);
    
    const totalLogs = allLogs.length;
    const unsyncedCount = unsyncedLogs.length;
    const syncedCount = totalLogs - unsyncedCount;
    const syncPercentage = totalLogs > 0 ? (syncedCount / totalLogs) * 100 : 100;

    return {
      totalLogs,
      syncedLogs: syncedCount,
      unsyncedLogs: unsyncedCount,
      syncPercentage: Math.round(syncPercentage),
    };
  }
}