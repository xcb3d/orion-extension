// background.ts already handles the GET_SESSION/SET_SESSION logic for the vault.
// We just need a simple hook to sync the local state with the background.
import { useState, useEffect } from 'react';
import { MessageType } from '../extension/messaging';

export function useSession(suiAddress: string | null) {
  const [pin, setPin] = useState<string | null>(null);

  useEffect(() => {
    if (suiAddress) {
      console.log('[useSession] Syncing session from background...');
      chrome.runtime.sendMessage({ type: MessageType.GET_SESSION }, (response) => {
        if (response?.pin) {
          setPin(response.pin);
        }
      });
    } else {
      setPin(null);
    }
  }, [suiAddress]);

  return { pin, setPin };
}
