/**
 * Orion Walrus Integration
 * Handles decentralized storage for encrypted vault backups.
 */

import { config } from '../config';

const WALRUS_PUBLISHER = config.walrus.publisher;
const WALRUS_AGGREGATOR = config.walrus.aggregator;

export interface WalrusUploadResponse {
  newlyCreated?: {
    blobObject: {
      id: string;
      blobId: string;
      storage: {
        id: string;
        startEpoch: number;
        endEpoch: number;
      };
    };
    encodedSize: number;
    cost: number;
  };
  alreadyCertified?: {
    blobId: string;
    event: {
      txDigest: string;
      eventSeq: string;
    };
  };
}

/**
 * Stores an encrypted blob on Walrus.
 * @param data The encrypted vault data (Uint8Array or Blob)
 * @param epochs Number of epochs to store the blob for (default 1 for devnet)
 */
export async function storeBlob(data: Uint8Array | Blob, epochs: number = 1): Promise<string> {
  // Cập nhật endpoint mới nhất của Walrus
  const url = `${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    body: data as any,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Walrus store failed: ${errorText}`);
  }

  const result: any = await response.json();
  
  // Xử lý linh hoạt các format response khác nhau của Walrus
  if (result.newlyCreated) {
    return result.newlyCreated.blobObject.blobId;
  } else if (result.alreadyCertified) {
    return result.alreadyCertified.blobId;
  } else if (result.blobId) {
    return result.blobId;
  }
  
  throw new Error('Unexpected Walrus response format');
}

/**
 * Reads a blob from Walrus.
 * @param blobId The ID of the blob to fetch
 */
export async function readBlob(blobId: string): Promise<Uint8Array> {
  const url = `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Walrus read failed for blob ${blobId}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Utility to convert string to Uint8Array (for testing/mocking)
 */
export function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Utility to convert Uint8Array back to string
 */
export function uint8ArrayToString(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}
