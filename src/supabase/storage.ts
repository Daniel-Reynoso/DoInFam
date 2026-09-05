import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

type AuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const chunkSize = 1800;
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const metadataKey = (key: string) => `${key}.__chunks`;
const chunkKey = (key: string, index: number) => `${key}.__${index}`;

class ChunkedSecureStore implements AuthStorage {
  async getItem(key: string) {
    const rawChunkCount = await SecureStore.getItemAsync(metadataKey(key));
    if (!rawChunkCount) return null;

    const chunkCount = Number.parseInt(rawChunkCount, 10);
    if (!Number.isSafeInteger(chunkCount) || chunkCount < 1) {
      await this.removeItem(key);
      return null;
    }

    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index)),
      ),
    );

    if (chunks.some((chunk) => chunk === null)) {
      await this.removeItem(key);
      return null;
    }

    return chunks.join('');
  }

  async setItem(key: string, value: string) {
    const previousRawCount = await SecureStore.getItemAsync(metadataKey(key));
    const previousCount = Number.parseInt(previousRawCount ?? '0', 10) || 0;
    const chunks = value.match(new RegExp(`.{1,${chunkSize}}`, 'gs')) ?? [''];

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, index), chunk, secureStoreOptions),
      ),
    );
    await SecureStore.setItemAsync(metadataKey(key), String(chunks.length), secureStoreOptions);

    if (previousCount > chunks.length) {
      await Promise.all(
        Array.from({ length: previousCount - chunks.length }, (_, offset) =>
          SecureStore.deleteItemAsync(chunkKey(key, chunks.length + offset)),
        ),
      );
    }
  }

  async removeItem(key: string) {
    const rawChunkCount = await SecureStore.getItemAsync(metadataKey(key));
    const chunkCount = Number.parseInt(rawChunkCount ?? '0', 10) || 0;

    await Promise.all([
      SecureStore.deleteItemAsync(metadataKey(key)),
      ...Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, index)),
      ),
    ]);
  }
}

export const authStorage: AuthStorage =
  Platform.OS === 'web' ? AsyncStorage : new ChunkedSecureStore();
