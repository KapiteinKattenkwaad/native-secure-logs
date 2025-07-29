import * as SecureStore from 'expo-secure-store';

export class SessionStorage {
  private static instance: SessionStorage;

  private constructor() {}

  public static getInstance(): SessionStorage {
    if (!SessionStorage.instance) {
      SessionStorage.instance = new SessionStorage();
    }
    return SessionStorage.instance;
  }

  public async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  }

  public async getItem(key: string): Promise<string | null> {
    return await SecureStore.getItemAsync(key);
  }

  public async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }
}