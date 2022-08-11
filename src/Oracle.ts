import { Field, PrivateKey, PublicKey, Signature } from 'snarkyjs';
import { OCRAggregator } from './OCRAggregator';
import { OracleSignatureAggregator } from './OracleSignatureAggregator';
import { Observation } from './types';

// const ocr = new OCRAggregator();
const osa = new OracleSignatureAggregator();

/**
 * General program outline:
 * 1. Deposit stake into contract
 *  a. Without stake, don't allow to submit observations
 * 2. Periodically run fetch price job
 *  a. query price data
 *  b. store request params along with price response in mina state
 * 3. If price or request params not in consensus, slash stake accordingly
 *
 * consensus = 67% agreement
 */

/**
 * - [x] OracleClient should fetch the price of an asset periodically
 * - [x] It will sign the data it got with a key specific to it and store the signature (on chain).
 * - [x] It will then send the result and signature to the OCR module
 */
export class Oracle {
  price: number = 0;
  heartbeat: number = 10000;
  oraclePublicKey: PublicKey;
  oraclePrivateKey: PrivateKey;
  oracleId: number;
  ocr: OCRAggregator;

  constructor(
    oraclePrivateKey: PrivateKey,
    aggregatorPublicKey: PublicKey,
    oracleId: number
  ) {
    this.oraclePrivateKey = oraclePrivateKey;
    this.oraclePublicKey = oraclePrivateKey.toPublicKey();
    this.oracleId = oracleId;
    this.ocr = new OCRAggregator(aggregatorPublicKey);
  }

  start() {
    setInterval(async () => {
      const price = await this.fetchPrice();
      this.setPrice(price);
      const signature = this.generateObservationSignature(
        this.getOracleId(),
        this.getPrice(),
        this.ocr.getEpoch()
      );

      // add signature to on-chain oracle signature aggragator
      osa.addSignature(signature);

      const observation: Observation = {
        oraclePublicKey: this.getOraclePublicKey(),
        oracleId: this.getOracleId(),
        answer: this.getPrice(),
        timestamp: Date.now(),
        signature,
      };

      // send observation to OCR
      this.ocr.submitObservation(observation);
    }, this.heartbeat);
  }

  getOraclePublicKey() {
    return this.oraclePublicKey;
  }

  getOracleId() {
    return this.oracleId;
  }

  generateObservationSignature(oracleId: number, price: number, epoch: number) {
    let privKey = PrivateKey.random(); // FIXME: Change to oracle client's private key
    let msg = [Field(price), Field(epoch), Field(oracleId)];
    let sig = Signature.create(privKey, msg); // sign a message

    // verify signature like: signature.verify(pubkey, [Field(price), Field(roundId), Field(oracleId)]).assertEquals(true);

    return sig;
  }

  async fetchPrice(): Promise<number> {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
    );
    const data = await res.json();

    return data.bitcoin.usd;
  }

  getPrice() {
    return this.price;
  }

  setPrice(price: number) {
    this.price = price;
  }
}
