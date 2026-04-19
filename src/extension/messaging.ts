// messaging.ts - Typed Message Dispatch System

export const MessageType = {
  SET_SESSION: 'SET_SESSION',
  GET_SESSION: 'GET_SESSION',
  EXTEND_SESSION: 'EXTEND_SESSION',
  CLEAR_SESSION: 'CLEAR_SESSION',
  GET_VAULT: 'GET_VAULT',
  SAVE_SECRET: 'SAVE_SECRET',
  DELETE_SECRET: 'DELETE_SECRET',
  UPDATE_SECRET: 'UPDATE_SECRET',
  SAVE_PROTECTED_KEY: 'SAVE_PROTECTED_KEY',
  SYNC_VAULT: 'SYNC_VAULT',
  AUTOFILL_REQUEST: 'AUTOFILL_REQUEST',
  FILL_FIELDS: 'FILL_FIELDS',
  GET_DECRYPTED: 'GET_DECRYPTED',
  GET_DOMAINS_CREDENTIALS: 'GET_DOMAINS_CREDENTIALS',
  INLINE_FILL_REQUEST: 'INLINE_FILL_REQUEST',
  START_LOGIN: 'START_LOGIN',
  CHANGE_MASTER_PASSWORD: 'CHANGE_MASTER_PASSWORD',
  RECOVER_MASTER_PASSWORD: 'RECOVER_MASTER_PASSWORD',
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

export const SyncStatus = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  ERROR: 'error',
} as const;

export type SyncStatus = typeof SyncStatus[keyof typeof SyncStatus];

export interface ChromeMessage<T = any> {
  type: MessageType;
  payload?: T;
}

export type Handler = (payload: any, sender: chrome.runtime.MessageSender) => Promise<any> | any;

export class MessageDispatcher {
  private handlers: Map<MessageType, Handler> = new Map();

  register(type: MessageType, handler: Handler) {
    this.handlers.set(type, handler);
    return this;
  }

  listen() {
    chrome.runtime.onMessage.addListener((message: ChromeMessage, sender, sendResponse) => {
      const handler = this.handlers.get(message.type);
      if (handler) {
        try {
          const result = handler(message.payload, sender);
          if (result instanceof Promise) {
            result.then(sendResponse).catch(error => sendResponse({ error: error.message }));
            return true; // Keep channel open for async
          } else {
            sendResponse(result);
          }
        } catch (error: any) {
          console.error(`[MessageDispatcher] Error in handler for ${message.type}:`, error);
          sendResponse({ error: error.message });
        }
      } else {
        // Always respond to avoid "Receiving end does not exist" on the caller side
        // if they provided a callback.
        sendResponse({ error: `No handler registered for type: ${message.type}` });
      }
    });
  }
}
