import { storeBlob, readBlob } from './walrus';
import { WrappedVaultPayload } from './crypto';

/**
 * WalrusAdapter provides high-level helpers for Walrus storage operations.
 */
export class WalrusAdapter {
  /**
   * Stores an encrypted package and returns the Blob ID.
   */
  async storeWrappedPayload(payload: WrappedVaultPayload): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    return await storeBlob(bytes);
  }

  /**
   * Reads an encrypted package from Walrus and parses it.
   */
  async readWrappedPayload(blobId: string): Promise<WrappedVaultPayload> {
    const encryptedData = await readBlob(blobId);
    const decoded = new TextDecoder().decode(encryptedData);
    return JSON.parse(decoded) as WrappedVaultPayload;
  }

  /**
   * Safely converts Sui RPC blob_id (vector<u8>) to string.
   */
  parseBlobId(rawBlobId: any): string {
    if (Array.isArray(rawBlobId)) {
      return new TextDecoder().decode(new Uint8Array(rawBlobId));
    }
    if (typeof rawBlobId === 'string') {
      return rawBlobId;
    }
    throw new Error(`Invalid walrus_blob_id type: ${typeof rawBlobId}`);
  }
}
