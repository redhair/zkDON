import { PublicKey, Signature } from 'snarkyjs';

export type Transmission = {
  oracleId: number;
  answer: number;
  timestamp: number;
};

export type Observation = {
  oracleId: number;
  oraclePublicKey: PublicKey;
  answer: number;
  timestamp: number;
  signature: Signature;
};

export type Report = {
  // timestamp: number;
  epoch: number;
  signatures: Signature[];
  observations: Observation[];
};
