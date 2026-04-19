import { useState, useEffect, useCallback, useRef } from 'react';
import { LocalStorageKey, SessionStorageKey } from '../extension/constants';
import { MessageType } from '../extension/messaging';

export function useSessionTimeout(lock: () => void, isActive: boolean) {
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(60);
  
  const lockCallbackRef = useRef(lock);
  const lastMsgTimeRef = useRef<number>(0);
  const wasActiveRef = useRef(isActive);

  // Load initial settings and cleanup legacy storage
  useEffect(() => {
    // 1. Cleanup legacy localStorage (Security Hardening)
    localStorage.removeItem('vault_timeout');
    localStorage.removeItem('vault_last_activity');

    // 2. Load from new synchronized storage
    chrome.storage.local.get([LocalStorageKey.VAULT_TIMEOUT], (result) => {
      const timeout = result[LocalStorageKey.VAULT_TIMEOUT] as number | undefined;
      if (timeout) {
        setTimeoutMinutes(timeout);
      }
    });

    // Listen for storage changes (for multi-page sync)
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[LocalStorageKey.VAULT_TIMEOUT]) {
        setTimeoutMinutes(changes[LocalStorageKey.VAULT_TIMEOUT].newValue as number);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    lockCallbackRef.current = lock;
  }, [lock]);

  const resetActivity = useCallback(() => {
    const now = Date.now();
    // Use session storage for session-bound timestamps
    chrome.storage.session.set({ [SessionStorageKey.VAULT_LAST_ACTIVITY]: now });
    
    // Throttle background notification (max once every 30 seconds)
    if (now - lastMsgTimeRef.current > 30000) {
      lastMsgTimeRef.current = now;
      chrome.runtime.sendMessage({ 
        type: MessageType.EXTEND_SESSION, 
        payload: { timeoutMinutes } 
      }).catch(() => {});
    }
  }, [timeoutMinutes]);

  // Reset activity immediately when vault is unlocked
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      console.log('[SessionTimeout] Vault unlocked, resetting activity timer.');
      resetActivity();
    }
    wasActiveRef.current = isActive;
  }, [isActive, resetActivity]);

  const updateTimeout = (minutes: number) => {
    setTimeoutMinutes(minutes);
    chrome.storage.local.set({ [LocalStorageKey.VAULT_TIMEOUT]: minutes });
    
    lastMsgTimeRef.current = Date.now();
    chrome.runtime.sendMessage({ 
      type: MessageType.EXTEND_SESSION, 
      payload: { timeoutMinutes: minutes } 
    }).catch(() => {});
   };

  useEffect(() => {
    if (!isActive || timeoutMinutes === 0) return;

    const checkLock = () => {
      chrome.storage.session.get([SessionStorageKey.VAULT_LAST_ACTIVITY], (result) => {
        const lastActivity = (result[SessionStorageKey.VAULT_LAST_ACTIVITY] as number) || 0;
         if (lastActivity === 0) {
          resetActivity();
          return;
        }

        const now = Date.now();
        const diff = now - lastActivity;
        const timeoutMs = timeoutMinutes * 60 * 1000;

        if (diff >= timeoutMs) {
          console.log('[SessionTimeout] Locking vault due to inactivity.');
          lockCallbackRef.current();
        }
      });
    };

    checkLock();
    const intervalId = setInterval(checkLock, 5000);
    return () => clearInterval(intervalId);
  }, [timeoutMinutes, resetActivity, isActive]);

  return {
    timeoutMinutes,
    resetActivity,
    updateTimeout
  };
}


