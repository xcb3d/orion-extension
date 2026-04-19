import { useState, useEffect } from 'react';
import { getVault, saveNewSecret } from '../lib/vault';
import type { SecretEntry } from '../lib/vault';
import { SuiSealClient } from '../lib/seal';
import { config } from '../config';
import { MessageType, SyncStatus } from '../extension/messaging';
import { LocalStorageKey, SessionStorageKey } from '../extension/constants';
import type { WrappedVaultPayload } from '../lib/crypto';

export function useVault(suiAddress: string | null, pin: string | null) {
  const [vault, setVault] = useState<SecretEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasLocalPin, setHasLocalPin] = useState<boolean>(true); // Default to true to prevent Create Vault flicker
  const [error, setError] = useState<string | null>(null);
  const [lastSyncId, setLastSyncId] = useState<string | null>(null);

  const refreshVault = async (forceRecoverKeys: boolean = false) => {
    try {
      if (forceRecoverKeys && suiAddress && pin) {
        const response: any = await new Promise(resolve => {
          chrome.runtime.sendMessage({ type: MessageType.GET_SESSION }, resolve);
        });

        if (!response || !response.cryptoSecret) {
           throw new Error('Vault is locked or session missing.');
        }

        const sealClient = new SuiSealClient(config.network);
        await sealClient.recoverVault(suiAddress, response.cryptoSecret);
      }

      const data = await getVault();
      setVault(data);
      return data;
    } catch (e: any) {
      setError('Vault recovery failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    chrome.storage.local.get([LocalStorageKey.ORION_HAS_VAULT, LocalStorageKey.ORION_SEAL_OBJECT_ID], (res) => {
      if (res[LocalStorageKey.ORION_HAS_VAULT] || res[LocalStorageKey.ORION_SEAL_OBJECT_ID]) {
        setHasLocalPin(true);
      } else {
        // Fallback check on chain if state is somehow missing but address exists
        if (suiAddress) {
          const sealClient = new SuiSealClient(config.network);
          sealClient.checkSealExists(suiAddress).then(exists => {
             setHasLocalPin(exists);
             if (exists) {
               chrome.storage.local.set({ [LocalStorageKey.ORION_HAS_VAULT]: true });
             }
          }).catch(() => setHasLocalPin(false));
        } else {
          setHasLocalPin(false);
        }
      }
    });
  }, [suiAddress]);

  useEffect(() => {
    if (suiAddress && pin) {
      setIsLoading(true);
      refreshVault(false); // Đổi thành false để không giải mã lại lần 2
    }
  }, [suiAddress, pin]);

  useEffect(() => {
    // 1. Initial State Load
    chrome.storage.local.get([LocalStorageKey.ORION_LAST_BLOB_ID, LocalStorageKey.SYNC_STATUS], (res) => {
      if (res[LocalStorageKey.ORION_LAST_BLOB_ID]) setLastSyncId(res[LocalStorageKey.ORION_LAST_BLOB_ID] as string);
      if (res[LocalStorageKey.SYNC_STATUS]) setIsSyncing(res[LocalStorageKey.SYNC_STATUS] === SyncStatus.SYNCING);
    });

    // 2. Storage Listener (Sync status updates from background)
    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[LocalStorageKey.ORION_LAST_BLOB_ID]) {
        setLastSyncId(changes[LocalStorageKey.ORION_LAST_BLOB_ID].newValue as string);
      }
      if (changes[LocalStorageKey.SYNC_STATUS]) {
        setIsSyncing(changes[LocalStorageKey.SYNC_STATUS].newValue === SyncStatus.SYNCING);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);
    return () => chrome.storage.onChanged.removeListener(storageListener);
  }, []);

  const handleSync = async () => {
    if (!suiAddress || !pin) return;

    chrome.storage.session.get([SessionStorageKey.JWT, SessionStorageKey.ZKLOGIN_STATE, SessionStorageKey.ZK_PROOF], (sessionRes) => {
      chrome.storage.local.get([LocalStorageKey.ORION_SEAL_OBJECT_ID], (localRes) => {
        const jwt = sessionRes[SessionStorageKey.JWT] as string;
        const zkState = sessionRes[SessionStorageKey.ZKLOGIN_STATE] ? JSON.parse(sessionRes[SessionStorageKey.ZKLOGIN_STATE] as string) : {};
        // Dùng zkProof đã cache sẵn trong session, không cần gọi lại Enoki API
        const zkProof = sessionRes[SessionStorageKey.ZK_PROOF] ? JSON.parse(sessionRes[SessionStorageKey.ZK_PROOF] as string) : null;
        const objectId = localRes[LocalStorageKey.ORION_SEAL_OBJECT_ID] as string;
        const SPONSOR_URL = config.gas.sponsorUrl;

      // Trigger Background Sync and delegate SUI update to the service worker
      chrome.runtime.sendMessage({
        type: MessageType.SYNC_VAULT,
        payload: {
          jwt,
          zkState,
          zkProof,
          objectId,
          sponsorUrl: SPONSOR_URL
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Vault] Sync trigger failed:', chrome.runtime.lastError.message);
        } else if (response && response.success) {
          console.log('[Vault] Background sync initiated successfully');
        }
        });
      });
    });
  };

  const addSecret = async (name: string, username: string, url: string, secret: string) => {
    // 1. Get CryptoSecret from Session
    const response: any = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: MessageType.GET_SESSION }, resolve);
    });

    if (!response || !response.cryptoSecret) {
      throw new Error('Vault is locked or session missing. Please re-unlock.');
    }

    // 2. Save using cryptoSecret (Local Storage first)
    await saveNewSecret(name, username, url, secret);

    // 3. Fast UI Refresh (Storage only, no network)
    await refreshVault(false);

    // 4. Trigger Background Sync to Walrus
    handleSync().catch(err => {
      console.error('Failed to trigger background sync:', err);
    });
  };

  const deleteSecret = async (id: string) => {
    // 1. Xóa khỏi session RAM
    await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: MessageType.DELETE_SECRET, payload: { id } }, resolve);
    });

    // 2. Ghi đè Local Storage ngay lập tức (không chờ Walrus sync)
    // để lần mở extension tiếp theo không bị "sống lại"
    const sessionRes: any = await new Promise(resolve =>
      chrome.runtime.sendMessage({ type: MessageType.GET_SESSION }, resolve)
    );
    if (sessionRes?.cryptoSecret && sessionRes?.dek) {
      const updatedVault: any = await new Promise(resolve =>
        chrome.runtime.sendMessage({ type: MessageType.GET_VAULT }, resolve)
      );
      if (Array.isArray(updatedVault)) {
        const { CryptoEngine } = await import('../lib/crypto');
        const vaultPackage = await CryptoEngine.encryptWithDEK(JSON.stringify(updatedVault), sessionRes.dek);
        const encryptedDEK = await CryptoEngine.encrypt(sessionRes.dek, sessionRes.cryptoSecret);
        
        // Preserve recoveryDEK if exists
        const oldRes = await chrome.storage.local.get([LocalStorageKey.ENCRYPTED_VAULT]);
        const oldWrapped = oldRes[LocalStorageKey.ENCRYPTED_VAULT] as WrappedVaultPayload | undefined;
        
        const wrapped = { 
          encryptedDEK, 
          vaultPackage,
          ...(oldWrapped?.recoveryDEK ? { recoveryDEK: oldWrapped.recoveryDEK } : {})
        };
        await chrome.storage.local.set({ [LocalStorageKey.ENCRYPTED_VAULT]: wrapped });
      }
    }

    // 3. Refresh UI từ RAM
    await refreshVault(false);

    // 4. Sync lên Walrus/Sui (async)
    handleSync().catch(err => console.error('Failed to sync after delete:', err));
  };

  const updateSecret = async (id: string, name: string, username: string, url: string, newPassword?: string) => {
    const updates: any = { name, username, url };
    if (newPassword) updates.newPassword = newPassword;

    // 1. Update session RAM
    await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: MessageType.UPDATE_SECRET, payload: { id, updates } }, resolve);
    });

    // 2. Ghi đè Local Storage ngay lập tức (không chờ Walrus sync)
    // để lần mở extension tiếp theo không bị mất thay đổi
    const sessionRes: any = await new Promise(resolve =>
      chrome.runtime.sendMessage({ type: MessageType.GET_SESSION }, resolve)
    );
    if (sessionRes?.cryptoSecret && sessionRes?.dek) {
      const updatedVault: any = await new Promise(resolve =>
        chrome.runtime.sendMessage({ type: MessageType.GET_VAULT }, resolve)
      );
      if (Array.isArray(updatedVault)) {
        const { CryptoEngine } = await import('../lib/crypto');
        const vaultPackage = await CryptoEngine.encryptWithDEK(JSON.stringify(updatedVault), sessionRes.dek);
        const encryptedDEK = await CryptoEngine.encrypt(sessionRes.dek, sessionRes.cryptoSecret);
        
        // Preserve recoveryDEK if exists
        const oldRes = await chrome.storage.local.get([LocalStorageKey.ENCRYPTED_VAULT]);
        const oldWrapped = oldRes[LocalStorageKey.ENCRYPTED_VAULT] as WrappedVaultPayload | undefined;
        
        const wrapped = { 
          encryptedDEK, 
          vaultPackage,
          ...(oldWrapped?.recoveryDEK ? { recoveryDEK: oldWrapped.recoveryDEK } : {})
        };
        await chrome.storage.local.set({ [LocalStorageKey.ENCRYPTED_VAULT]: wrapped });
      }
    }

    // 3. Refresh UI từ RAM
    await refreshVault(false);

    // 4. Sync lên Walrus/Sui (async)
    handleSync().catch(err => console.error('Failed to sync after update:', err));
  };

  return {
    vault,
    isLoading,
    isSyncing,
    hasLocalPin,
    error,
    lastSyncId,
    refreshVault,
    handleSync,
    addSecret,
    deleteSecret,
    updateSecret
  };
}
