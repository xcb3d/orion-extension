import { argon2id } from 'hash-wasm';

export interface SealedPackage {
  ciphertext: string; // Base64 AES-GCM encrypted vault
  iv: string; // Base64 IV
  salt: string; // Base64 Random Salt
}

export interface WrappedVaultPayload {
  encryptedDEK: SealedPackage; // DEK encrypted with KEK
  recoveryDEK?: SealedPackage; // DEK encrypted with Recovery Code (Recovery KEK)
  vaultPackage: SealedPackage; // Vault data encrypted with DEK
}

export class CryptoEngine {
  /**
   * Derives a 256-bit AES key from the master cryptoSecret using Argon2id.
   */
  private static async deriveAESKey(cryptoSecret: string, salt: Uint8Array): Promise<CryptoKey> {
    const hash = await argon2id({
      password: cryptoSecret,
      salt: salt,
      parallelism: 1,
      iterations: 15, // Increased from 10
      memorySize: 65536, // 64MB
      hashLength: 32,
      outputType: 'binary', // returns Uint8Array
    });

    return await crypto.subtle.importKey(
      'raw',
      hash as any,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts the vault using AES-256-GCM.
   */
  static async encrypt(plaintext: string, cryptoSecret: string): Promise<SealedPackage> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const aesKey = await this.deriveAESKey(cryptoSecret, salt);
    const data = new TextEncoder().encode(plaintext);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as any } as any,
      aesKey,
      data as any
    );

    return {
      ciphertext: this.toBase64(new Uint8Array(ciphertext)),
      iv: this.toBase64(iv),
      salt: this.toBase64(salt)
    };
  }

  static async decrypt(sealed: SealedPackage, cryptoSecret: string): Promise<string> {
    const salt = this.fromBase64(sealed.salt);
    const aesKey = await this.deriveAESKey(cryptoSecret, salt);
    const iv = this.fromBase64(sealed.iv);
    const ciphertext = this.fromBase64(sealed.ciphertext);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any } as any,
      aesKey,
      ciphertext as any
    );

    return new TextDecoder().decode(decryptedBuffer);
  }

  /**
   * Generates a random 256-bit Data Encryption Key (DEK).
   */
  static generateDEK(): string {
    const key = crypto.getRandomValues(new Uint8Array(32));
    return this.toBase64(key);
  }

  private static async importRawKey(base64Key: string): Promise<CryptoKey> {
    const keyBytes = this.fromBase64(base64Key);
    return await crypto.subtle.importKey(
      'raw',
      keyBytes as any,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts data using the raw DEK (no KDF).
   */
  static async encryptWithDEK(plaintext: string, base64DEK: string): Promise<SealedPackage> {
    const aesKey = await this.importRawKey(base64DEK);
    const data = new TextEncoder().encode(plaintext);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as any } as any,
      aesKey,
      data as any
    );

    return {
      ciphertext: this.toBase64(new Uint8Array(ciphertext)),
      iv: this.toBase64(iv),
      salt: '' // Not needed
    };
  }

  /**
   * Decrypts data using the raw DEK (no KDF).
   */
  static async decryptWithDEK(sealed: SealedPackage, base64DEK: string): Promise<string> {
    const aesKey = await this.importRawKey(base64DEK);
    const iv = this.fromBase64(sealed.iv);
    const ciphertext = this.fromBase64(sealed.ciphertext);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any } as any,
      aesKey,
      ciphertext as any
    );

    return new TextDecoder().decode(decryptedBuffer);
  }

  static toBase64(data: Uint8Array): string {
    return btoa(Array.from(data).map(b => String.fromCharCode(b)).join(''));
  }

  static fromBase64(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
