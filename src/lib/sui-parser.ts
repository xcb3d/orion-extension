import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

/**
 * SuiParser focuses on querying and parsing SUI objects.
 */
export class SuiParser {
  private client: SuiJsonRpcClient;
  constructor(client: SuiJsonRpcClient) {
    this.client = client;
  }

  /**
   * Finds the latest EncryptedVaultKey for a given address.
   * Logic moved from SuiSealClient to handle SRP.
   */
  async findLatestVaultKey(suiAddress: string, packageId: string, moduleName: string) {
    const objects = await this.client.getOwnedObjects({
      owner: suiAddress,
      filter: { StructType: `${packageId}::${moduleName}::EncryptedVaultKey` },
      options: { showContent: true }
    });

    if (!objects.data || objects.data.length === 0) {
      return null;
    }

    // Sort by version descending to get the LATEST seal
    const sorted = objects.data
      .map((item: any) => ({
        id: item.data?.objectId,
        fields: item.data?.content?.fields,
        version: item.data?.version
      }))
      .filter((item: any) => item.fields !== undefined)
      .sort((a: any, b: any) => Number(b.version) - Number(a.version));

    if (sorted.length === 0) return null;

    return sorted[0]; // Return newest one
  }
}
