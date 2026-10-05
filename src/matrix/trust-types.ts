export type IdentityTrust = {
  userId: string;
  present: boolean;
  verified: boolean;
  violation: boolean;
};

export type TrustStatus = {
  deviceId: string;
  deviceState: 'unknown' | 'unverified' | 'verified';
  ownIdentity: IdentityTrust;
  peerIdentity: IdentityTrust | null;
  hasOwnDeviceToVerify: boolean;
};

export type SasData = { userId: string } & (
  | { kind: 'emojis'; values: { symbol: string; description: string }[] }
  | { kind: 'decimals'; values: number[] }
);

export type TrustReport = {
  outcome: 'verified' | 'pending';
  target: 'own' | 'peer';
  userId: string;
  sasCompared: boolean;
  status: TrustStatus;
  elapsedMs: number;
};
