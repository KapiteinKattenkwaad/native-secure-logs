

// Mock expo-secure-store for testing
const mockSecureStore = {
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  isAvailableAsync: jest.fn().mockResolvedValue(true)
};

jest.mock('expo-secure-store', () => mockSecureStore);

// Mock expo-sqlite for testing
const mockDatabase = {
  execAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1 }),
  closeAsync: jest.fn(),
};

const mockSQLite = {
  openDatabaseAsync: jest.fn().mockResolvedValue(mockDatabase),
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