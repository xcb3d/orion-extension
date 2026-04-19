import { useState } from 'react';
import { SuiSealClient } from '../lib/seal';
import { getZkProof } from '../lib/zklogin';
import { config } from '../config';
import { poll } from '../lib/utils';
import { sha256 } from 'hash-wasm';
import { MessageType } from '../extension/messaging';
import { LocalStorageKey, SessionStorageKey } from '../extension/constants';
import { CredentialManager } from '../lib/security';
import type { SealedPackage } from '../lib/crypto';

export function useOrionEngine(suiAddress: string | null) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared: Derive cryptoSecret and save session to background worker
  const deriveAndSetSession = async (
    password: string, timeoutMinutes: number, onComplete: (pin: string) => void
  ): Promise<string> => {
    const cryptoSecret = await sha256(password + suiAddress!);

    onComplete(password);
    chrome.runtime.sendMessage({
      type: MessageType.SET_SESSION,
      payload: { pin: password, timeoutMinutes, cryptoSecret }
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[OrionEngine] Session sync failed:', chrome.runtime.lastError.message);
      }
    });

    return cryptoSecret;
  };

  const handleInitialize = async (password: string, recoveryCode: string, timeoutMinutes: number, onComplete: (pin: string) => void) => {
    try {
      setIsInitializing(true);
      setError(null);

      const sessionRes = await chrome.storage.session.get([SessionStorageKey.JWT, SessionStorageKey.ZKLOGIN_STATE]);
      let jwt = sessionRes[SessionStorageKey.JWT] as string;
      let zkState = sessionRes[SessionStorageKey.ZKLOGIN_STATE] ? JSON.parse(sessionRes[SessionStorageKey.ZKLOGIN_STATE] as string) : {};

      // If missing from session, check if it's already encrypted in local
      const localRes = await chrome.storage.local.get([LocalStorageKey.ENCRYPTED_ZK_CREDENTIALS]);
      const sealed = localRes[LocalStorageKey.ENCRYPTED_ZK_CREDENTIALS] as SealedPackage;
      

      const cryptoSecret = await deriveAndSetSession(password, timeoutMinutes, () => {}); // defer onComplete
      const recoveryCryptoSecret = await sha256(recoveryCode + suiAddress!);

      // If we didn't have it in session but have it encrypted, decrypt now
      if (!jwt && sealed) {
        try {
          const creds = await CredentialManager.decryptCredentials(sealed, cryptoSecret);
          jwt = creds.jwt;
          zkState = creds.zkState;
          // Restore to current session
          await chrome.storage.session.set({
            [SessionStorageKey.JWT]: jwt,
            [SessionStorageKey.ZKLOGIN_STATE]: JSON.stringify(zkState)
          });
        } catch (e) {
          throw new Error('Incorrect Master Password');
        }
      }

      if (!jwt || !suiAddress) throw new Error('Authentication required');

      const sealClient = new SuiSealClient(config.network);
      const exists = await sealClient.checkSealExists(suiAddress);

      if (exists) {
        await sealClient.recoverVault(suiAddress, cryptoSecret);

        // Fetch và cache zkProof nếu chưa có trong session (backward compat với old credentials)
        const existingProofRes = await chrome.storage.session.get([SessionStorageKey.ZK_PROOF]);
        if (!existingProofRes[SessionStorageKey.ZK_PROOF] && jwt && zkState?.ephemeralPublicKey) {
          try {
            const freshZkProof = await getZkProof(jwt, {
              maxEpoch: zkState.maxEpoch,
              randomness: zkState.randomness,
              ephemeralPublicKey: zkState.ephemeralPublicKey
            });
            await chrome.storage.session.set({ [SessionStorageKey.ZK_PROOF]: JSON.stringify(freshZkProof) });
            // Update local storage sang format mới có zkProof
            const newSealedCreds = await CredentialManager.encryptCredentials(jwt, zkState, freshZkProof, cryptoSecret);
            await chrome.storage.local.set({ [LocalStorageKey.ENCRYPTED_ZK_CREDENTIALS]: newSealedCreds });
          } catch (e) {
            console.warn('[Initialize] Could not fetch zkProof, sync may not update chain pointer.');
          }
        }
      } else {
        const seal = await sealClient.createNewSeal(cryptoSecret, recoveryCryptoSecret);

        const zkProof = await getZkProof(jwt, {
          maxEpoch: zkState.maxEpoch,
          randomness: zkState.randomness,
          ephemeralPublicKey: zkState.ephemeralPublicKey
        });

        await sealClient.executeStoreKeyOnChain(
          seal.walrusBlobId,
          jwt,
          zkProof,
          zkState.ephemeralSecretKey,
          zkState.maxEpoch,
          zkState.randomness,
          config.gas.sponsorUrl
        );

        // Cache zkProof vào session RAM để background worker dùng luôn, không cần gọi Enoki nữa
        await chrome.storage.session.set({
          [SessionStorageKey.ZK_PROOF]: JSON.stringify(zkProof)
        });

        // Mã hóa jwt + zkState + zkProof cùng nhau vào Local Storage
        const sealedCreds = await CredentialManager.encryptCredentials(jwt, zkState, zkProof, cryptoSecret);
        await chrome.storage.local.set({
          [LocalStorageKey.ENCRYPTED_ZK_CREDENTIALS]: sealedCreds,
          [LocalStorageKey.ORION_HAS_VAULT]: true
        });

        await poll(async () => {
          try {
            return await sealClient.recoverVault(suiAddress, cryptoSecret);
          } catch (e) {
            return null;
          }
        }, { 
          interval: 1000, 
          maxTries: 10, 
          errorMsg: 'Sui Seal registration success but indexing timed out.' 
        });
      }

      onComplete(password);
      return true;
    } catch (e: any) {
      console.error('Initialization failed', e);
      setError(e.message || 'Failed to initialize secure vault');
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  const handleUnlock = async (password: string, timeoutMinutes: number, onComplete: (pin: string) => void) => {
    try {
      setIsUnlocking(true);
      setError(null);

      const cryptoSecret = await deriveAndSetSession(password, timeoutMinutes, () => {}); 
      
      // Decrypt credentials and restore to session
      const local = await chrome.storage.local.get([LocalStorageKey.ENCRYPTED_ZK_CREDENTIALS]);
      const sealedCreds = local[LocalStorageKey.ENCRYPTED_ZK_CREDENTIALS] as SealedPackage;
      
      if (sealedCreds) {
        try {
          const creds = await CredentialManager.decryptCredentials(sealedCreds, cryptoSecret);
          let zkProof = creds.zkProof;

          // Backward compat: nếu creds cũ không có zkProof, fetch mới từ Enoki và cập nhật local storage
          if (!zkProof && creds.jwt && creds.zkState?.ephemeralPublicKey) {
            try {
              zkProof = await getZkProof(creds.jwt, {
                maxEpoch: creds.zkState.maxEpoch,
                randomness: creds.zkState.randomness,
                ephemeralPublicKey: creds.zkState.ephemeralPublicKey
              });
              // Cập nhật local storage sang format mới (migration một lần duy nhất)
              const newSealedCreds = await CredentialManager.encryptCredentials(creds.jwt, creds.zkState, zkProof, cryptoSecret);
              await chrome.storage.local.set({ [LocalStorageKey.ENCRYPTED_ZK_CREDENTIALS]: newSealedCreds });
            } catch (e) {
              console.warn('[Unlock] Could not fetch zkProof, sync may not update chain pointer.');
            }
          }

          // Khôi phục JWT, zkState, và zkProof vào session RAM
          await chrome.storage.session.set({
            [SessionStorageKey.JWT]: creds.jwt,
            [SessionStorageKey.ZKLOGIN_STATE]: JSON.stringify(creds.zkState),
            ...(zkProof ? { [SessionStorageKey.ZK_PROOF]: JSON.stringify(zkProof) } : {})
          });
        } catch (e) {
          throw new Error('Incorrect Master Password');
        }
      }

      const sealClient = new SuiSealClient(config.network);
      await sealClient.recoverVault(suiAddress!, cryptoSecret);

      onComplete(password);
      return true;
    } catch (e: any) {
      console.error('Unlock failed', e);
      setError(e.message === 'Incorrect Master Password' ? e.message : 'Vault recovery failed');
      return false;
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleRecover = async (newPassword: string, recoveryCode: string, timeoutMinutes: number, onComplete: (pin: string) => void) => {
    try {
      setIsUnlocking(true);
      setError(null);

      const newCryptoSecret = await sha256(newPassword + suiAddress!);
      const recoveryCryptoSecret = await sha256(recoveryCode + suiAddress!);

      // Fetch required data for sync
      const sessionResData = await chrome.storage.session.get([
        SessionStorageKey.JWT,
        SessionStorageKey.ZKLOGIN_STATE,
        SessionStorageKey.ZK_PROOF
      ]);


      const jwt = sessionResData[SessionStorageKey.JWT];
      const zkStateStr = sessionResData[SessionStorageKey.ZKLOGIN_STATE] as string | undefined;
      const zkProofStr = sessionResData[SessionStorageKey.ZK_PROOF] as string | undefined;
      
      const zkState = JSON.parse(zkStateStr || '{}');
      const zkProof = JSON.parse(zkProofStr || 'null');

      if (!jwt) throw new Error('Missing authentication data. Please click "Logout" and sign in with Google again to verify your identity.');

      const res = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({
          type: MessageType.RECOVER_MASTER_PASSWORD,
          payload: {
            suiAddress,
            newPin: newPassword,
            newCryptoSecret,
            recoveryCryptoSecret,
            jwt,
            zkState,
            zkProof
          }
        }, resolve);
      });

      if (res.error) throw new Error(res.error);

      // Successfully recovered, set session
      await deriveAndSetSession(newPassword, timeoutMinutes, onComplete);
      return true;
    } catch (e: any) {
      console.error('Recovery failed', e);
      setError(e.message || 'Failed to recover vault');
      return false;
    } finally {
      setIsUnlocking(false);
    }
  };

  return {
    isInitializing,
    isUnlocking,
    error,
    handleInitialize,
    handleUnlock,
    handleRecover,
    clearError: () => setError(null)
  };
}
