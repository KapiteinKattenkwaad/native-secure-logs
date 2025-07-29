
// Mock React Native components for testing
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  RefreshControl: 'RefreshControl',
  ActivityIndicator: 'ActivityIndicator',
  Platform: {
    OS: 'ios',
  },
  Alert: {
    alert: jest.fn(),
  },
}));

// Mock expo-secure-store for testing
const mockSecureStore = {
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  isAvailableAsync: jest.fn().mockResolvedValue(true)
};

jest.mock('expo-secure-store', () => mockSecureStore);

// Mock expo-sqlite for testing with in-memory simulation
class MockDatabase {
  private tables: { [tableName: string]: any[] } = {};
  private nextId = 1;

  async execAsync(sql: string): Promise<void> {
    this.checkClosed();
    // Handle CREATE TABLE statements
    if (sql.includes('CREATE TABLE')) {
      const match = sql.match(/CREATE TABLE (\w+)/);
      if (match) {
        const tableName = match[1];
        this.tables[tableName] = [];
      }
    }
    // Handle DELETE statements for clearing data
    if (sql.includes('DELETE FROM')) {
      const match = sql.match(/DELETE FROM (\w+)/);
      if (match) {
        const tableName = match[1];
        this.tables[tableName] = [];
      }
    }
  }

  async getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null> {
    this.checkClosed();
    // Handle SELECT queries
    if (sql.includes('SELECT') && sql.includes('FROM')) {
      const tableMatch = sql.match(/FROM (\w+)/);
      if (!tableMatch) return null;
      
      const tableName = tableMatch[1];
      const table = this.tables[tableName] || [];
      
      // Handle WHERE clauses
      if (sql.includes('WHERE') && params && params.length > 0) {
        const record = table.find(row => {
          if (sql.includes('email = ?')) {
            return row.email === params[0];
          }
          if (sql.includes('id = ?')) {
            return row.id === params[0];
          }
          return false;
        });
        return record || null;
      }
      
      // Handle COUNT queries
      if (sql.includes('COUNT(*)')) {
        return { count: table.length } as T;
      }
      
      return table[0] || null;
    }
    return null;
  }

  async getAllAsync<T>(sql: string, params?: any[]): Promise<T[]> {
    this.checkClosed();
    if (sql.includes('SELECT') && sql.includes('FROM')) {
      const tableMatch = sql.match(/FROM (\w+)/);
      if (!tableMatch) return [];
      
      const tableName = tableMatch[1];
      const table = this.tables[tableName] || [];
      
      // Handle WHERE clauses
      if (sql.includes('WHERE') && params && params.length > 0) {
        return table.filter(row => {
          if (sql.includes('user_id = ?')) {
            return row.user_id === params[0];
          }
          return true;
        });
      }
      
      return table;
    }
    return [];
  }

  async runAsync(sql: string, params?: any[]): Promise<{ lastInsertRowId: number; changes?: number }> {
    this.checkClosed();
    if (sql.includes('INSERT INTO')) {
      const tableMatch = sql.match(/INSERT INTO (\w+)/);
      if (!tableMatch) return { lastInsertRowId: 0 };
      
      const tableName = tableMatch[1];
      if (!this.tables[tableName]) {
        this.tables[tableName] = [];
      }
      
      const id = this.nextId++;
      const record: any = { id };
      
      // Parse INSERT statement to extract values
      if (tableName === 'users' && params) {
        record.email = params[0];
        record.password_hash = params[1];
        record.encryption_key = params[2];
        record.created_at = new Date().toISOString();
        record.updated_at = new Date().toISOString();
      } else if (tableName === 'health_logs' && params) {
        record.user_id = params[0];
        record.encrypted_data = params[1];
        record.created_at = new Date().toISOString();
        record.updated_at = new Date().toISOString();
        record.synced_at = null;
        record.cloud_id = null;
      }
      
      this.tables[tableName].push(record);
      return { lastInsertRowId: id };
    }
    
    if (sql.includes('UPDATE')) {
      const tableMatch = sql.match(/UPDATE (\w+)/);
      if (!tableMatch) return { lastInsertRowId: 0 };
      
      const tableName = tableMatch[1];
      const table = this.tables[tableName] || [];
      
      if (sql.includes('WHERE id = ?') && params) {
        const recordIndex = table.findIndex(row => row.id === params[params.length - 1]);
        if (recordIndex >= 0) {
          if (tableName === 'health_logs') {
            table[recordIndex].encrypted_data = params[0];
            table[recordIndex].updated_at = new Date().toISOString();
          }
        }
      }
      
      return { lastInsertRowId: 0, changes: 1 };
    }
    
    if (sql.includes('DELETE FROM')) {
      const tableMatch = sql.match(/DELETE FROM (\w+)/);
      if (!tableMatch) return { lastInsertRowId: 0 };
      
      const tableName = tableMatch[1];
      const table = this.tables[tableName] || [];
      
      if (sql.includes('WHERE id = ?') && params) {
        const recordIndex = table.findIndex(row => row.id === params[0]);
        if (recordIndex >= 0) {
          table.splice(recordIndex, 1);
        }
      }
      
      return { lastInsertRowId: 0, changes: 1 };
    }
    
    return { lastInsertRowId: 0 };
  }

  async closeAsync(): Promise<void> {
    // Clear all data when closing
    this.tables = {};
    this.nextId = 1;
    this.closed = true;
  }

  private closed = false;

  private checkClosed() {
    if (this.closed) {
      throw new Error('Database connection is closed');
    }
  }
}

const mockDatabase = new MockDatabase();

const mockSQLite = {
  openDatabaseAsync: jest.fn().mockImplementation(() => {
    // Reset the closed state when opening a new database
    (mockDatabase as any).closed = false;
    return Promise.resolve(mockDatabase);
  }),
  SQLiteDatabase: jest.fn()
};

jest.mock('expo-sqlite', () => mockSQLite);

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
}));

// Export mocks for use in tests
export { mockSecureStore, mockSQLite, mockDatabase };