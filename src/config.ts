// src/config.ts - Centralized Orion Configuration

export const Network = {
  MAINNET: 'mainnet',
  TESTNET: 'testnet',
  DEVNET: 'devnet',
} as const;

export type Network = typeof Network[keyof typeof Network];

export interface OrionConfig {
  network: Network;
  sui: {
    packageId: string;
    moduleName: string;
  };
  zkLogin: {
    googleClientId: string;
    enokiApiKey: string;
    enokiEndpoint: string;
  };
  walrus: {
    publisher: string;
    aggregator: string;
  };
  gas: {
    sponsorUrl: string;
  };
  security: {
    defaultTimeoutMinutes: number;
    timeoutOptions: Array<{ label: string; value: number; desc: string }>;
  };
  app: {
    version: string;
    name: string;
  };
}

const TESTNET_CONFIG: OrionConfig = {
  network: Network.TESTNET,
  sui: {
    packageId: '0xfd5ea9c62a35a86eaa0d4afb74d7b4d0e9547084335a19a660d592c0992a292b',
    moduleName: 'sui_seal',
  },
  zkLogin: {
    googleClientId: '690944638050-iclvqrqrpsb09ndv66plap59okhb591a.apps.googleusercontent.com',
    enokiApiKey: 'enoki_public_30ad63eed583ece4f2ecc4b4cb851426',
    enokiEndpoint: 'https://api.enoki.mystenlabs.com/v1',
  },
  walrus: {
    publisher: 'https://publisher.walrus-testnet.walrus.space',
    aggregator: 'https://aggregator.walrus-testnet.walrus.space',
  },
  gas: {
    sponsorUrl: 'http://localhost:3001/sponsor',
  },
  security: {
    defaultTimeoutMinutes: 15,
    timeoutOptions: [
      { label: '1 minute', value: 1, desc: 'Highest security' },
      { label: '15 minutes', value: 15, desc: 'Balanced' },
      { label: '1 hour', value: 60, desc: 'Standard' },
      { label: 'Never', value: 0, desc: 'Always unlocked' }
    ]
  },
  app: {
    version: '0.1.0',
    name: 'Orion',
  }
};

// Currently we only support testnet, but architecture is ready for others.
export const config = TESTNET_CONFIG;
