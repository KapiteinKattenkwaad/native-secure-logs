// Mock expo-secure-store for testing
const mockSecureStore = {
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  isAvailableAsync: jest.fn().mockResolvedValue(true)
};

jest.mock('expo-secure-store', () => mockSecureStore);

// Export mock for use in tests
export { mockSecureStore };