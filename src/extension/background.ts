// background.ts - Orion Secrets Engine (Refactored)

import { MessageDispatcher, MessageType, SyncStatus } from './messaging';
import { SessionManager } from './session';
import { StorageManager } from './storage';
import { CryptoEngine } from '../lib/crypto';
import { storeBlob } from '../lib/walrus';
import { SuiSealClient } from '../lib/seal';
import { getZkProof, prepareZkLogin, getGoogleAuthUrl, deriveSuiAddress } from '../lib/zklogin';
import { config } from '../config';
import { SessionStorageKey, LocalStorageKey } from './constants';
import { getExtendedEphemeralPublicKey } from '@mysten/zklogin';
import { CredentialManager } from '../lib/security';
import { WalrusAdapter } from '../lib/walrus-adapter';

console.log('Orion Background Service Worker Initialized');

// ...
chrome.runtime.onInstalled.addListener(() => {
  console.log('Orion Extension Installed');
  SessionManager.getVault().then(vault => {
    if (!vault || vault.length === 0) SessionManager.saveVault([]);
  });
});

SessionManager.startExpiryListener();

const dispatcher = new MessageDispatcher();

// Simple Serial Sync Queue to prevent "Sync Chaos" (Race conditions on Sui/Walrus)
let syncPromise: Promise<any> = Promise.resolve();

// Helper: Get session + static salt (No longer used for actual crypto, but kept for legacy if needed)
async function getDecryptionContext(): Promise<{ cryptoSecret: string, dek: string } | null> {
  const session = await SessionManager.getSession();
  if (!session?.cryptoSecret || !session?.dek) return null;
  return { cryptoSecret: session.cryptoSecret, dek: session.dek };
}

async function executeSyncVault(payload: any) {
  // Wrap the entire sync logic in a serial queue
  syncPromise = syncPromise.then(async () => {
    try {
      console.log('[Background Sync] Starting...');
      await chrome.storage.local.set({ [LocalStorageKey.SYNC_STATUS]: SyncStatus.SYNCING });

      const ctx = await getDecryptionContext();
      if (!ctx) {
        await chrome.storage.local.set({ [LocalStorageKey.SYNC_STATUS]: SyncStatus.ERROR });
        return { success: false, error: 'Vault is locked. Cannot sync.' };
      }

      const vault = await SessionManager.getVault();
      const vaultData = JSON.stringify(vault);

      console.log('[Background Sync] Encrypting vault data (with DEK)...');
      const vaultPackage = await CryptoEngine.encryptWithDEK(vaultData, ctx.dek);
      
      console.log('[Background Sync] Encrypting DEK (with KEK)...');
      const encryptedDEK = await CryptoEngine.encrypt(ctx.dek, ctx.cryptoSecret);

      let recoveryDEK = undefined;
      try {
        const oldWrapped = await StorageManager.getEncryptedVault();
        if (oldWrapped?.recoveryDEK) {
          recoveryDEK = oldWrapped.recoveryDEK;
        } else {
          // If not in local storage, fetch from Walrus just in case
          const local = await chrome.storage.local.get([LocalStorageKey.ORION_LAST_BLOB_ID]);
          const blobId = local[LocalStorageKey.ORION_LAST_BLOB_ID];
          if (blobId) {
            const storage = new WalrusAdapter();
            const fetched = await storage.readWrappedPayload(blobId as string);
            if (fetched?.recoveryDEK) recoveryDEK = fetched.recoveryDEK;
          }
        }
      } catch (e) {
        console.warn('[Background Sync] Failed to read old recoveryDEK, proceeding without it', e);
      }

      const wrappedPayload = { encryptedDEK, vaultPackage, ...(recoveryDEK ? { recoveryDEK } : {}) };

      console.log('[Background Sync] Storing blob on Walrus...');
      const bytes = new TextEncoder().encode(JSON.stringify(wrappedPayload));
      const blobId = await storeBlob(bytes);

      // SUI Blockchain Update
      if (payload && payload.jwt && payload.zkState && payload.objectId) {
        let zkProof = payload.zkProof;

        // Fallback cho ví cũ chưa có cached zkProof: fetch lại từ Enoki
        if (!zkProof && payload.zkState.ephemeralPublicKey) {
          try {
            console.log('[Background Sync] No cached zkProof, fetching fresh from Enoki (old wallet migration)...');
            zkProof = await getZkProof(payload.jwt, {
              maxEpoch: payload.zkState.maxEpoch,
              randomness: payload.zkState.randomness,
              ephemeralPublicKey: payload.zkState.ephemeralPublicKey
            });
          } catch (e) {
            console.warn('[Background Sync] Could not fetch zkProof from Enoki:', e);
          }
        }

        if (!zkProof) {
          console.warn('[Background Sync] No zkProof available, skipping chain update.');
        } else {
          console.log('[Background Sync] Updating SUI Blockchain pointer...');
          const sealClient = new SuiSealClient(config.network);
          await sealClient.executeUpdateKeyOnChain(
            payload.objectId,
            blobId,
            payload.jwt,
            zkProof,
            payload.zkState.ephemeralSecretKey,
            payload.zkState.maxEpoch,
            payload.zkState.randomness,
            payload.sponsorUrl || config.gas.sponsorUrl
          );
          console.log('[Background Sync] SUI Blockchain Update Successful!');
        }
      }

      // Save offline cache and sync state
      await StorageManager.saveEncryptedVault(wrappedPayload);
      await chrome.storage.local.set({
        [LocalStorageKey.ORION_LAST_BLOB_ID]: blobId,
        [LocalStorageKey.SYNC_STATUS]: SyncStatus.IDLE
      });
      console.log('[Background Sync] Success! BlobId:', blobId);
      return { success: true, blobId };
    } catch (error: any) {
      console.error('[Background Sync] Failed:', error);
      if (error.stack) console.error(error.stack);
      await chrome.storage.local.set({ [LocalStorageKey.SYNC_STATUS]: SyncStatus.ERROR });
      return { success: false, error: error.message };
    }
  });
  return syncPromise;
}

dispatcher
  .register(MessageType.SET_SESSION, (payload) =>
    SessionManager.setSession(payload.pin, payload.timeoutMinutes, payload.cryptoSecret)
  )
  .register(MessageType.GET_SESSION, () =>
    SessionManager.getSession()
  )
  .register(MessageType.EXTEND_SESSION, (payload) =>
    SessionManager.extendSession(payload.timeoutMinutes)
  )
  .register(MessageType.CLEAR_SESSION, () =>
    SessionManager.clearSession()
  )
  .register(MessageType.GET_VAULT, () =>
    SessionManager.getVault()
  )
  .register(MessageType.SAVE_SECRET, async (payload) => {
    const ctx = await getDecryptionContext();
    if (!ctx) return { error: 'Vault is locked.' };

    const sealed = await CryptoEngine.encryptWithDEK(payload.plainSecret, ctx.dek);
    const entry = {
      id: payload.id,
      name: payload.name,
      username: payload.username,
      url: payload.url,
      payload: sealed.ciphertext,
      iv: sealed.iv,
      salt: sealed.salt,
      timestamp: payload.timestamp
    };
    await SessionManager.saveSecret(entry);
    return { success: true };
  })
  .register(MessageType.DELETE_SECRET, async (payload) => {
    await SessionManager.deleteSecret(payload.id);
    return { success: true };
  })
  .register(MessageType.UPDATE_SECRET, async (payload) => {
    const ctx = await getDecryptionContext();
    if (!ctx) return { error: 'Vault is locked.' };

    let updates = { ...payload.updates };

    // Nếu có password mới, mã hóa lại trước khi lưu
    if (updates.newPassword) {
      const sealed = await CryptoEngine.encryptWithDEK(updates.newPassword, ctx.dek);
      updates = {
        ...updates,
        payload: sealed.ciphertext,
        iv: sealed.iv,
        salt: sealed.salt,
        newPassword: undefined // Xóa trường plaintext, không lưu vào vault
      };
      delete updates.newPassword;
    }

    await SessionManager.updateSecret(payload.id, updates);
    return { success: true };
  })
  .register(MessageType.SYNC_VAULT, executeSyncVault)
  .register(MessageType.AUTOFILL_REQUEST, async (payload) => {
    try {
      const ctx = await getDecryptionContext();
      if (!ctx) return { error: 'Vault is locked. Please unlock to autofill.' };

      const entry = payload as any;
      if (!entry.iv || !entry.payload) return { error: 'Invalid secret entry.' };

      const sealed = { ciphertext: entry.payload, iv: entry.iv, salt: entry.salt };
      console.log('[Autofill] Decrypting credential:', entry.name);
      const decryptedPassword = await CryptoEngine.decryptWithDEK(sealed, ctx.dek);

      // 3. Find active tab and send FILL_FIELDS
      return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTab = tabs[0];
          if (!activeTab?.id || activeTab.url?.startsWith('chrome://')) {
            resolve({ error: 'Cannot autofill on this page' });
            return;
          }

          chrome.tabs.sendMessage(activeTab.id, {
            type: MessageType.FILL_FIELDS,
            payload: {
              username: entry.username,
              password: decryptedPassword
            }
          }, (res) => {
            if (chrome.runtime.lastError) {
              console.warn('[Autofill] Tab communication failed:', chrome.runtime.lastError.message);
              resolve({ error: 'Autofill not available on this tab' });
            } else {
              resolve(res || { success: true });
            }
          });
        });
      });
    } catch (error: any) {
      console.error('[Autofill] Failed:', error);
      return { error: `Autofill failed: ${error.message}` };
    }
  })
  .register(MessageType.GET_DECRYPTED, async (payload) => {
    try {
      const ctx = await getDecryptionContext();
      if (!ctx) return { error: 'Vault is locked. Cannot view password.' };
      const entry = payload as any;
      if (!entry.iv || !entry.payload) return { error: 'Invalid secret entry (missing encryption metadata).' };
      const sealed = { ciphertext: entry.payload, iv: entry.iv, salt: entry.salt || '' };
      const decryptedPassword = await CryptoEngine.decryptWithDEK(sealed, ctx.dek);
      return { password: decryptedPassword };
    } catch (error: any) {
      console.error('[GetDecrypted] Failed:', error);
      return { error: error.message };
    }
  })
  .register(MessageType.GET_DOMAINS_CREDENTIALS, async (payload) => {
    try {
      const session = await SessionManager.getSession();
      if (!session || !session.cryptoSecret) {
        console.log('[GetDomains] Failed: Vault is Locked');
        return { credentials: [], debug: 'Vault Locked' };
      }
      const vault = await SessionManager.getVault();
      if (!vault || vault.length === 0) {
        console.log('[GetDomains] Failed: Vault is empty array');
        return { credentials: [], debug: 'Vault is empty' };
      }

      const domain = payload?.domain || '';
      if (!domain) {
        console.log('[GetDomains] Failed: No domain passed');
        return { credentials: [], debug: 'Empty domain' };
      }

      console.log(`[GetDomains] User Vault has ${vault.length} items. Searching for domain: ${domain}`);

      const matches = vault.filter(entry => {
        const entryUrl = (entry.url || '').toLowerCase();
        if (!entryUrl) return false;

        try {
          const searchDomain = domain.toLowerCase().replace(/^www\./, '');
          const urlObj = new URL(entryUrl.startsWith('http') ? entryUrl : `https://${entryUrl}`);
          const entryDomain = urlObj.hostname.replace(/^www\./, '');

          // Strict hostname check (must match exactly or be a subdomain)
          return entryDomain === searchDomain || entryDomain.endsWith(`.${searchDomain}`);
        } catch {
          return false;
        }
      });

      const metadata = matches.map(m => ({ id: m.id, name: m.name, username: m.username }));
      console.log(`[GetDomains] Returning ${metadata.length} matches`);
      return { credentials: metadata, debug: `Success: matched ${metadata.length}/${vault.length} items` };
    } catch (error: any) {
      console.error('[GetDomainsCredentials] Error:', error);
      return { credentials: [], debug: error.message };
    }
  })
  .register(MessageType.INLINE_FILL_REQUEST, async (payload) => {
    try {
      const ctx = await getDecryptionContext();
      if (!ctx) return { error: 'Vault is locked. Cannot autofill.' };
      const vault = await SessionManager.getVault();
      const entry = vault?.find(v => v.id === payload.id);
      if (!entry) return { error: 'Credential not found.' };

      const sealed = { ciphertext: entry.payload, iv: entry.iv, salt: entry.salt };
      const decryptedPassword = await CryptoEngine.decryptWithDEK(sealed, ctx.dek);
      return { username: entry.username, password: decryptedPassword };
    } catch (error: any) {
      console.error('[InlineFillRequest] Failed:', error);
      return { error: error.message };
    }
  })
  .register(MessageType.CHANGE_MASTER_PASSWORD, async (payload) => {
    try {
      const ctx = await getDecryptionContext();
      if (!ctx) return { error: 'Vault is locked. Cannot change password.' };

      const { newCryptoSecret, jwt, zkState, zkProof, objectId, sponsorUrl } = payload;
      
      // 1. Re-encrypt local zkLogin credentials
      const sealedCreds = await CredentialManager.encryptCredentials(jwt, zkState, zkProof, newCryptoSecret);
      await chrome.storage.local.set({ [LocalStorageKey.ENCRYPTED_ZK_CREDENTIALS]: sealedCreds });

      // 2. Update session with new cryptoSecret
      await SessionManager.setSession(payload.newPin, 30, newCryptoSecret, ctx.dek);

      // 3. Trigger Sync (which will use the new cryptoSecret to re-encrypt DEK, and upload to Walrus, then update Sui)
      // 3. Trigger Sync in the background (fire-and-forget)
      executeSyncVault({ jwt, zkState, zkProof, objectId, sponsorUrl }).catch(err => {
        console.error('[ChangePassword] Background sync failed:', err);
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('[ChangePassword] Failed:', error);
      return { error: error.message };
    }
  })
  .register(MessageType.RECOVER_MASTER_PASSWORD, async (payload) => {
    try {
      const { suiAddress, newPin, newCryptoSecret, recoveryCryptoSecret, jwt, zkState, zkProof, sponsorUrl } = payload;

      // 1. Fetch latest blobId from SUI directly
      const sealClient = new SuiSealClient();
      const pointer = await sealClient.getLatestSeal(suiAddress);
      if (!pointer) return { error: 'No vault found to recover. Please clear data and start fresh.' };

      const storage = new WalrusAdapter();
      const wrapped = await storage.readWrappedPayload(pointer.walrusBlobId);

      if (!wrapped.recoveryDEK) {
        return { error: 'This vault does not support Recovery Codes (created before this feature was added).' };
      }

      // 2. Decrypt DEK using Recovery Code (recoveryCryptoSecret)
      let dek: string;
      try {
        dek = await CryptoEngine.decrypt(wrapped.recoveryDEK, recoveryCryptoSecret);
      } catch (e) {
        return { error: 'Incorrect Recovery Code' };
      }

      // 3. Re-encrypt local zkLogin credentials with new KEK
      const sealedCreds = await CredentialManager.encryptCredentials(jwt, zkState, zkProof, newCryptoSecret);
      await chrome.storage.local.set({ 
        [LocalStorageKey.ENCRYPTED_ZK_CREDENTIALS]: sealedCreds,
        [LocalStorageKey.ORION_SEAL_OBJECT_ID]: pointer.objectId 
      });

      // 4. Decrypt Vault using DEK and save to session
      console.log('[RecoverPassword] Decrypting vault data...');
      const decryptedVaultStr = await CryptoEngine.decryptWithDEK(wrapped.vaultPackage, dek);
      const vault = JSON.parse(decryptedVaultStr);
      await SessionManager.saveVault(vault);

      // 5. Set session
      await SessionManager.setSession(newPin, 30, newCryptoSecret, dek);

      // 6. Trigger sync (to re-encrypt DEK with new KEK and update Walrus/Sui)
      executeSyncVault({ jwt, zkState, zkProof, objectId: pointer.objectId, sponsorUrl }).catch(err => {
        console.error('[RecoverPassword] Background sync failed:', err);
      });

      return { success: true };
    } catch (error: any) {
      console.error('[RecoverPassword] Failed:', error);
      return { error: error.message };
    }
  })
  .register(MessageType.START_LOGIN, async () => {
    try {
      console.log('[Background Auth] Starting OAuth flow...');
      const state = await prepareZkLogin();
      const authUrl = getGoogleAuthUrl(state.nonce);

      // Save intermediate state to session storage
      await chrome.storage.session.set({
        [SessionStorageKey.ZKLOGIN_STATE]: JSON.stringify({
          maxEpoch: state.maxEpoch,
          randomness: state.randomness,
          ephemeralPublicKey: getExtendedEphemeralPublicKey(state.ephemeralKeyPair.getPublicKey()),
          ephemeralSecretKey: state.ephemeralKeyPair.getSecretKey()
        })
      });

      return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            console.error('[Background Auth] Flow failed:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError?.message || 'Login flow cancelled'));
            return;
          }

          try {
            const url = new URL(redirectUrl.replace('#', '?'));
            const jwt = url.searchParams.get('id_token');
            if (!jwt) throw new Error('No JWT found in redirect');

            const payload = JSON.parse(atob(jwt.split('.')[1]));
            const email = payload.email;

            console.log('[Background Auth] Deriving Sui Address...');
            const realAddress = await deriveSuiAddress(jwt);

            const sealClient = new SuiSealClient(config.network);
            const hasVault = await sealClient.checkSealExists(realAddress);

            // Persist the winning combo
            await chrome.storage.local.set({
              [LocalStorageKey.ORION_USER_EMAIL]: email,
              [LocalStorageKey.ORION_SUI_ADDRESS]: realAddress,
              [LocalStorageKey.ORION_HAS_VAULT]: hasVault
            });

            await chrome.storage.session.set({
              [SessionStorageKey.JWT]: jwt
            });

            console.log('[Background Auth] Login Successful for:', email);
            resolve({ success: true, email, address: realAddress });
          } catch (e: any) {
            console.error('[Background Auth] Processing failed:', e);
            reject(e);
          }
        });
      });
    } catch (error: any) {
      console.error('[Background Auth] Handler failed:', error);
      return { success: false, error: error.message };
    }
  })
  .listen();
