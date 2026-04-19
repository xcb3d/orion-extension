// session.ts - Vault Session Manager
import { SessionStorageKey } from './constants';

export class SessionManager {
  static async setSession(pin: string, timeoutMinutes: number, cryptoSecret?: string, dek?: string): Promise<void> {
    const expiresAt = timeoutMinutes === 0 ? -1 : Date.now() + (timeoutMinutes * 60 * 1000);
    await chrome.storage.session.set({ 
      [SessionStorageKey.PIN]: pin, 
      [SessionStorageKey.CRYPTO_SECRET]: cryptoSecret,
      [SessionStorageKey.DEK]: dek,
      [SessionStorageKey.EXPIRES_AT]: expiresAt,
      [SessionStorageKey.VAULT_LAST_ACTIVITY]: Date.now()
    });
  }

  static async getSession(): Promise<{ pin: string, cryptoSecret?: string, dek?: string } | null> {
    const result = await chrome.storage.session.get([
      SessionStorageKey.PIN, 
      SessionStorageKey.CRYPTO_SECRET, 
      SessionStorageKey.DEK,
      SessionStorageKey.EXPIRES_AT
    ]);
    const pin = result[SessionStorageKey.PIN] as string | undefined;
    const cryptoSecret = result[SessionStorageKey.CRYPTO_SECRET] as string | undefined;
    const dek = result[SessionStorageKey.DEK] as string | undefined;
    const expiresAt = result[SessionStorageKey.EXPIRES_AT] as number | undefined;
    
    if (!pin) return null;
    
    if (expiresAt !== undefined && expiresAt !== -1 && Date.now() > expiresAt) {
      await this.clearSession();
      return null;
    }
    
    return { pin, cryptoSecret, dek };
  }

  static async getVault(): Promise<any[]> {
    const result = await chrome.storage.session.get([SessionStorageKey.VAULT]);
    return (result[SessionStorageKey.VAULT] as any[]) || [];
  }

  static async saveVault(vault: any[]): Promise<void> {
    await chrome.storage.session.set({ [SessionStorageKey.VAULT]: vault });
  }

  static async saveSecret(entry: any): Promise<void> {
    const vault = await this.getVault();
    await chrome.storage.session.set({ [SessionStorageKey.VAULT]: [...vault, entry] });
  }

  static async deleteSecret(id: string): Promise<void> {
    const vault = await this.getVault();
    const updated = vault.filter((e: any) => e.id !== id);
    await chrome.storage.session.set({ [SessionStorageKey.VAULT]: updated });
  }

  static async updateSecret(id: string, updates: any): Promise<void> {
    const vault = await this.getVault();
    const updated = vault.map((e: any) => e.id === id ? { ...e, ...updates } : e);
    await chrome.storage.session.set({ [SessionStorageKey.VAULT]: updated });
  }

  static async extendSession(timeoutMinutes: number): Promise<boolean> {
    const { [SessionStorageKey.PIN]: pin } = await chrome.storage.session.get([SessionStorageKey.PIN]);
    if (!pin || timeoutMinutes === 0) return !!pin;

    const expiresAt = Date.now() + (timeoutMinutes * 60 * 1000);
    await chrome.storage.session.set({ 
      [SessionStorageKey.EXPIRES_AT]: expiresAt,
      [SessionStorageKey.VAULT_LAST_ACTIVITY]: Date.now()
    });
    return true;
  }

  static async clearSession(): Promise<void> {
    await chrome.storage.session.remove([
      SessionStorageKey.PIN, 
      SessionStorageKey.CRYPTO_SECRET, 
      SessionStorageKey.DEK,
      SessionStorageKey.EXPIRES_AT, 
      SessionStorageKey.VAULT_LAST_ACTIVITY, 
      SessionStorageKey.VAULT
    ]);
  }

  static startExpiryListener() {
    setInterval(async () => {
      const session = await this.getSession();
      if (!session) {
        // Session handled by getSession (auto-clears if expired)
      }
    }, 10000);
  }
}
