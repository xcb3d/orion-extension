import { CryptoEngine, type SealedPackage } from './crypto';

export interface ProtectedCredentials {
  jwt: string;
  zkState: any;
  zkProof: any;
}

export class CredentialManager {
  /**
   * Encrypts the JWT, zkLogin state, and cached zkProof using the master cryptoSecret.
   * This ensures we never need to call the Enoki API again during the session lifetime.
   */
  static async encryptCredentials(
    jwt: string, 
    zkState: any,
    zkProof: any,
    cryptoSecret: string
  ): Promise<SealedPackage> {
    const data = JSON.stringify({ jwt, zkState, zkProof });
    return await CryptoEngine.encrypt(data, cryptoSecret);
  }

  /**
   * Decrypts the credentials (including cached zkProof) using the master cryptoSecret.
   */
  static async decryptCredentials(
    sealed: SealedPackage, 
    cryptoSecret: string
  ): Promise<ProtectedCredentials> {
    const decryptedJson = await CryptoEngine.decrypt(sealed, cryptoSecret);
    return JSON.parse(decryptedJson);
  }
}
