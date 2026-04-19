import { useState, useEffect } from 'react';
import { LocalStorageKey } from '../extension/constants';
import { MessageType } from '../extension/messaging';

export function useAuth() {
  const [suiAddress, setSuiAddress] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const refreshAuth = () => {
      chrome.storage.local.get([LocalStorageKey.ORION_SUI_ADDRESS, LocalStorageKey.ORION_USER_EMAIL, 'orion_jwt', 'zklogin_state'], (res) => {
        setSuiAddress((res[LocalStorageKey.ORION_SUI_ADDRESS] as string) || null);
        setUserEmail((res[LocalStorageKey.ORION_USER_EMAIL] as string) || null);
         
        if (res['orion_jwt'] || res['zklogin_state']) {
          chrome.storage.local.remove(['orion_jwt', 'zklogin_state']);
        }
        setIsLoadingAuth(false);
      });
    };

    refreshAuth();
    chrome.storage.onChanged.addListener(refreshAuth);
    return () => chrome.storage.onChanged.removeListener(refreshAuth);
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    chrome.runtime.sendMessage({ type: MessageType.START_LOGIN }, (response) => {
      setIsLoggingIn(false);
      if (chrome.runtime.lastError) {
        console.error('[Auth] Background login trigger failed:', chrome.runtime.lastError.message);
      } else if (response?.error) {
        console.warn('[Auth] Background login error:', response.error);
      }
    });
  };

  const handleLogout = async () => {
    setSuiAddress(null);
    setUserEmail(null);
    await chrome.storage.local.remove([
      LocalStorageKey.ORION_SUI_ADDRESS, 
       LocalStorageKey.ORION_USER_EMAIL, 
      LocalStorageKey.ORION_SEAL_OBJECT_ID,
      LocalStorageKey.ENCRYPTED_VAULT,
      LocalStorageKey.ORION_HAS_VAULT,
      LocalStorageKey.ENCRYPTED_ZK_CREDENTIALS
     ]);
     await chrome.storage.session.clear();
   };

  return {
    suiAddress,
    userEmail,
    isLoggingIn,
    isLoadingAuth,
    handleLogin,
    handleLogout
  };
}
