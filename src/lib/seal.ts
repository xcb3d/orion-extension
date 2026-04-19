import { Transaction } from '@mysten/sui/transactions';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { CryptoEngine } from './crypto';
import { type Network, config } from '../config';
import { LocalStorageKey, SessionStorageKey } from '../extension/constants';

// New specialized modules
import { SuiExecutor } from './sui-executor';
import { SuiParser } from './sui-parser';
import { WalrusAdapter } from './walrus-adapter';

const PACKAGE_ID = config.sui.packageId;
const MODULE_NAME = config.sui.moduleName;

export interface SealPointer {
  objectId: string;
  walrusBlobId: string;
}

/**
 * SuiSealClient is now a thin Orchestrator that delegates heavy lifting
 * to SuiExecutor, SuiParser, and WalrusAdapter.
 */
export class SuiSealClient {
  private client: SuiJsonRpcClient;
  private executor: SuiExecutor;
  private parser: SuiParser;
  private storage: WalrusAdapter;

  constructor(network: Network = config.network) {
    this.client = new SuiJsonRpcClient({
      url: getJsonRpcFullnodeUrl(network),
      network: network
    });
    this.executor = new SuiExecutor(this.client);
    this.parser = new SuiParser(this.client);
    this.storage = new WalrusAdapter();
  }

  async checkSealExists(suiAddress: string): Promise<boolean> {
    const key = await this.parser.findLatestVaultKey(suiAddress, PACKAGE_ID, MODULE_NAME);
    return !!key;
  }

  async getLatestSeal(suiAddress: string): Promise<SealPointer | null> {
    const key = await this.parser.findLatestVaultKey(suiAddress, PACKAGE_ID, MODULE_NAME);
    if (!key) return null;
    return {
      objectId: key.id,
      walrusBlobId: this.storage.parseBlobId(key.fields.walrus_blob_id)
    };
  }

  async createNewSeal(cryptoSecret: string, recoveryCryptoSecret: string): Promise<SealPointer> {
    // 1. Generate new DEK
    const dek = CryptoEngine.generateDEK();

    // 2. Encrypt DEK with Master Password (KEK)
    const encryptedDEK = await CryptoEngine.encrypt(dek, cryptoSecret);

    // 3. Encrypt DEK with Recovery Code (Recovery KEK)
    const recoveryDEK = await CryptoEngine.encrypt(dek, recoveryCryptoSecret);

    // 4. Encrypt empty vault with DEK
    const vaultPackage = await CryptoEngine.encryptWithDEK(JSON.stringify([]), dek);

    // 5. Wrap and store
    const payload = { encryptedDEK, recoveryDEK, vaultPackage };
    const blobId = await this.storage.storeWrappedPayload(payload);

    // 6. Store DEK in session for immediate use
    await chrome.storage.session.set({ [SessionStorageKey.DEK]: dek });

    return { objectId: '0x_PENDING_TX', walrusBlobId: blobId };
  }

  createStoreKeyTx(blobId: string): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::store_key`,
      arguments: [
        tx.pure.vector('u8', Array.from(new TextEncoder().encode(blobId))),
      ],
    });
    return tx;
  }

  async executeStoreKeyOnChain(blobId: string, jwt: string, zkProof: any, ephSecret: string, maxEpoch: number, _randomness: string, sponsorUrl?: string): Promise<string> {
    const tx = this.createStoreKeyTx(blobId);
    return this.executor.executeSignedTransaction(tx, jwt, zkProof, ephSecret, maxEpoch, sponsorUrl);
  }

  createUpdateKeyTx(objectId: string, blobId: string): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::update_key`,
      arguments: [tx.object(objectId), tx.pure.vector('u8', Array.from(new TextEncoder().encode(blobId)))],
    });
    return tx;
  }

  async executeUpdateKeyOnChain(objectId: string, blobId: string, jwt: string, zkProof: any, ephSecret: string, maxEpoch: number, _randomness: string, sponsorUrl?: string): Promise<string> {
    const tx = this.createUpdateKeyTx(objectId, blobId);
    return this.executor.executeSignedTransaction(tx, jwt, zkProof, ephSecret, maxEpoch, sponsorUrl);
  }

  async recoverVault(suiAddress: string, cryptoSecret: string) {
    // 1. Discover Object
    const key = await this.parser.findLatestVaultKey(suiAddress, PACKAGE_ID, MODULE_NAME);
    if (!key) throw new Error('No Sui Seal found. Please initialize your vault first.');

    await chrome.storage.local.set({ 
      [LocalStorageKey.ORION_SEAL_OBJECT_ID]: key.id, 
      [LocalStorageKey.ORION_HAS_VAULT]: true 
    });

    // 2. Fetch from Walrus
    const blobId = this.storage.parseBlobId(key.fields.walrus_blob_id);
    const wrapped = await this.storage.readWrappedPayload(blobId);
    
    // 3. Decrypt DEK using KEK (Master Password)
    const dek = await CryptoEngine.decrypt(wrapped.encryptedDEK, cryptoSecret);

    // 4. Decrypt Vault using DEK
    const decryptedVaultStr = await CryptoEngine.decryptWithDEK(wrapped.vaultPackage, dek);
    const vault = JSON.parse(decryptedVaultStr);
    
    // 5. Save to session & local storage
    await chrome.storage.session.set({ 
      [SessionStorageKey.VAULT]: vault,
      [SessionStorageKey.DEK]: dek 
    });
    await chrome.storage.local.set({
      [LocalStorageKey.ENCRYPTED_VAULT]: wrapped
    });
    return { success: true };
  }
}
