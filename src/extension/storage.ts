// storage.ts - Vault Storage Manager
import { LocalStorageKey } from './constants';

export interface SecretEntry {
  id: string;
  name: string;
  username: string;
  url: string;
  payload: string;
  ciphertext: string;
  timestamp: number;
}

import type { WrappedVaultPayload } from '../lib/crypto';

export class StorageManager {
  static async getEncryptedVault(): Promise<WrappedVaultPayload | null> {
    const result = await chrome.storage.local.get([LocalStorageKey.ENCRYPTED_VAULT]);
    return (result[LocalStorageKey.ENCRYPTED_VAULT] as WrappedVaultPayload) || null;
  }

  static async saveEncryptedVault(blob: WrappedVaultPayload): Promise<void> {
    await chrome.storage.local.set({ [LocalStorageKey.ENCRYPTED_VAULT]: blob });
  }

  static async clearEncryptedVault(): Promise<void> {
    await chrome.storage.local.remove([LocalStorageKey.ENCRYPTED_VAULT]);
  }
}
