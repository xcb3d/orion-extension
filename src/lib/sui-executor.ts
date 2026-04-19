import { Transaction } from '@mysten/sui/transactions';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { getZkLoginSignature } from '@mysten/zklogin';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { deriveSuiAddress } from './zklogin';

/**
 * SuiExecutor handles the complex assembly and execution of transactions,
 * specifically focused on zkLogin and Sponsored flows.
 */
export class SuiExecutor {
  private client: SuiJsonRpcClient;
  constructor(client: SuiJsonRpcClient) {
    this.client = client;
  }

  /**
   * Universal execution method for signed transactions.
   * Logic moved from SuiSealClient to handle SRP.
   */
  async executeSignedTransaction(
    tx: Transaction,
    jwt: string,
    zkProof: any,
    ephemeralSecretKey: string,
    maxEpoch: number,
    sponsorUrl?: string
  ): Promise<string> {
    const sender = await deriveSuiAddress(jwt);
    tx.setSender(sender);
    const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(ephemeralSecretKey);

    if (sponsorUrl) {
      // 1. Build TransactionKind (commands only)
      const txBytes = await tx.build({
        client: this.client as any,
        onlyTransactionKind: true,
      });

      // 2. Request Sponsorship
      console.log(`[SuiExecutor] Requesting sponsorship from ${sponsorUrl}...`);
      const sponsorResponse = await fetch(sponsorUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txBytes: btoa(Array.from(txBytes).map(b => String.fromCharCode(b)).join('')),
          sender: sender,
          jwt: jwt,
        }),
      });

      if (!sponsorResponse.ok) {
        throw new Error(`Sponsorship failed: ${await sponsorResponse.text()}`);
      }

      const { sponsoredTxBytes, digest } = await sponsorResponse.json();

      // 3. Dual Signing (Ephemeral + Enoki)
      const finalTxBytes = new Uint8Array(atob(sponsoredTxBytes).split("").map(c => c.charCodeAt(0)));
      const { signature: userAuthSignature } = await ephemeralKeyPair.signTransaction(finalTxBytes);

      // 4. Assemble zkLogin Signature
      const zkLoginSignature = getZkLoginSignature({
        inputs: zkProof,
        maxEpoch: Number(maxEpoch),
        userSignature: userAuthSignature,
      });

      // 5. Finalize & Submit
      console.log("[SuiExecutor] Submitting signed transaction...");
      const executeUrl = sponsorUrl.replace('/sponsor', '/execute');
      const executeResponse = await fetch(executeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest, signature: zkLoginSignature }),
      });

      if (!executeResponse.ok) {
        throw new Error(`Execution failed: ${await executeResponse.text()}`);
      }

      const result = await executeResponse.json();
      console.log("[SuiExecutor] Transaction successful! Digest:", result.digest);
      return result.digest;
    } else {
      // Fallback: Standard User Gas flow
      const transactionBlock = await tx.build({ client: this.client as any });
      const { signature: userSignature } = await ephemeralKeyPair.signTransaction(transactionBlock);

      const zkLoginSignature = getZkLoginSignature({
        inputs: zkProof,
        maxEpoch,
        userSignature,
      });

      console.log("[SuiExecutor] Executing user-paid transaction...");
      const result = await this.client.executeTransactionBlock({
        transactionBlock,
        signature: zkLoginSignature,
      });

      console.log(`[SuiExecutor] Success! Digest: ${result.digest}`);
      return result.digest;
    }
  }
}
