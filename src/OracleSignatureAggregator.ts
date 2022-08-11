import { Signature } from 'snarkyjs';

/**
 * Job is to maintain list of signatures on chain
 * for cross reference from OCR module
 *
 * FIXME: eventually store signatures on-chain
 */

export class OracleSignatureAggregator {
  signatures: Signature[] = [];
  constructor() {}

  addSignature(signature: Signature) {
    this.signatures.push(signature);
  }
}
