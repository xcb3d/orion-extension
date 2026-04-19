import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateNonce, generateRandomness } from '@mysten/zklogin';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

import { config } from '../config';

const GOOGLE_CLIENT_ID = config.zkLogin.googleClientId;
const ENOKI_API_KEY = config.zkLogin.enokiApiKey;
const ENOKI_ENDPOINT = config.zkLogin.enokiEndpoint;

export interface ZkLoginState {
  ephemeralKeyPair: Ed25519Keypair;
  randomness: string;
  nonce: string;
  maxEpoch: number;
}

/**
 * Khởi tạo trạng thái zkLogin mới
 */
export async function prepareZkLogin(currentEpoch?: number): Promise<ZkLoginState> {
  const epoch = currentEpoch || await getCurrentEpoch();
  const ephemeralKeyPair = new Ed25519Keypair();
  const randomness = generateRandomness();
  const maxEpoch = epoch + 30; // Giữ login hợp lệ trong khoảng 30 ngày (1 epoch ~ 24h)

  const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), maxEpoch, randomness);

  return {
    ephemeralKeyPair,
    randomness,
    nonce,
    maxEpoch
  };
}

/**
 * Lấy epoch hiện tại từ Sui Testnet
 */
export async function getCurrentEpoch(): Promise<number> {
  const client = new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl(config.network),
    network: config.network
  });
  const state = await client.getLatestSuiSystemState();
  return Number(state.epoch);
}

/**
 * Xây dựng URL đăng nhập Google
 */
export function getGoogleAuthUrl(nonce: string) {
  const redirectUri = typeof chrome !== 'undefined' && chrome.identity
    ? chrome.identity.getRedirectURL()
    : 'https://orion-placeholder.com/callback';

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email',
    nonce: nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Lấy Salt cho người dùng
 * Đã cải tiến: Nếu service lỗi, dùng một mã muối cố định dựa trên danh tính người dùng
 * để đảm bảo địa chỉ ví luôn cố định (Consistent).
 */
export async function getSalt(_jwt: string): Promise<string> {
  // Enoki handles salt internally, so we don't need a local salt service anymore.
  // We return a dummy value since Enoki Prover doesn't require us to pass the salt.
  return 'enoki_managed';
}

/**
 * Tính toán Sui Address thực tế từ JWT và Salt
 */
export async function deriveSuiAddress(jwt: string): Promise<string> {
  console.log(`[Enoki] Getting address from Enoki...`);
  const response = await fetch(`${ENOKI_ENDPOINT}/zklogin`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ENOKI_API_KEY}`,
      'zklogin-jwt': jwt
    }
  });

  if (!response.ok) {
    throw new Error(`Enoki Address failed: ${await response.text()}`);
  }

  const result = await response.json();
  return result.data.address;
}

/**
 * Gọi Proving Service để lấy ZK Proof
 */
export async function getZkProof(jwt: string, state: { maxEpoch: number, randomness: string, ephemeralPublicKey: string }) {
  console.log(`[Enoki] Sending ZKP request to Enoki...`);
  const response = await fetch(`${ENOKI_ENDPOINT}/zklogin/zkp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ENOKI_API_KEY}`,
      'zklogin-jwt': jwt
    },
    body: JSON.stringify({
      ephemeralPublicKey: state.ephemeralPublicKey,
      maxEpoch: state.maxEpoch,
      randomness: state.randomness,
      network: config.network
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`[Enoki] Prover failed: ${errorData}`);
    throw new Error(`Enoki Prover failed: ${errorData}`);
  }

  const result = await response.json();
  return result.data;
}
