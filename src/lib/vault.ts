import { MessageType } from '../extension/messaging';

export interface SecretEntry {
  id: string;
  name: string;
  username: string;
  url: string;
  payload: string; // encrypted ciphertext
  iv: string;      // initialization vector
  salt: string;    // random salt
  timestamp: number;
}

export const saveNewSecret = async (name: string, username: string, url: string, secret: string) => {
  // 1. Send plain secret to background for DEK encryption
  const entry = {
    id: crypto.randomUUID(),
    name,
    username,
    url,
    plainSecret: secret,
    timestamp: Date.now()
  };

  // 3. Save to Chrome Storage
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: MessageType.SAVE_SECRET, payload: entry }, (response) => {
      resolve(response);
    });
  });
};

export const getVault = (): Promise<SecretEntry[]> => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: MessageType.GET_VAULT }, (result) => {
      // Background returns SecretEntry[] directly
      resolve(Array.isArray(result) ? result : []);
    });
  });
};
