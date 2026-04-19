/**
 * Centralized constants for the Orion extension.
 * Uses erasable const object pattern for compatibility with erasableSyntaxOnly: true.
 */

export const LocalStorageKey = {
  ORION_SUI_ADDRESS: 'orion_sui_address',
  ORION_USER_EMAIL: 'orion_user_email',
  ORION_HAS_VAULT: 'orion_has_vault',
  ORION_SEAL_OBJECT_ID: 'orion_seal_object_id',
  SYNC_STATUS: 'sync_status',
  ORION_LAST_BLOB_ID: 'orion_last_blob_id',
  ENCRYPTED_VAULT: 'encrypted_vault',
  ENCRYPTED_ZK_CREDENTIALS: 'encrypted_zk_credentials',
  VAULT_TIMEOUT: 'vault_timeout',
} as const;

export type LocalStorageKey = typeof LocalStorageKey[keyof typeof LocalStorageKey];

export const SessionStorageKey = {
  PIN: 'pin',
  CRYPTO_SECRET: 'cryptoSecret',
  DEK: 'dek',
  EXPIRES_AT: 'expiresAt',
  VAULT_LAST_ACTIVITY: 'vault_last_activity',
  VAULT: 'vault',
  JWT: 'jwt',
  ZKLOGIN_STATE: 'zklogin_state',
  ZK_PROOF: 'zk_proof',
} as const;

export type SessionStorageKey = typeof SessionStorageKey[keyof typeof SessionStorageKey];
