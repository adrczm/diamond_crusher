// Secure store for the database key and bootstrap values (DATA-012, DATA-022, PRIV-011).
import * as SecureStore from 'expo-secure-store';

const BASE: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const secureStore = {
  async get(key: string, auth?: { prompt: string }): Promise<string | null> {
    return SecureStore.getItemAsync(key, auth ? { ...BASE, requireAuthentication: true, authenticationPrompt: auth.prompt } : BASE);
  },
  async set(key: string, value: string, auth?: { prompt: string }): Promise<void> {
    await SecureStore.setItemAsync(key, value, auth ? { ...BASE, requireAuthentication: true, authenticationPrompt: auth.prompt } : BASE);
  },
  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key, BASE);
  },
  canUseAuth(): boolean {
    return SecureStore.canUseBiometricAuthentication();
  },
};
