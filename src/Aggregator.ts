import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
} from 'snarkyjs';
import { Report } from './types';

/**
 * Verifies the OracleClient Signatures, checks that the list
 * of observations is sorted, records which oracles
 * contributed, and stores the median of the observations
 * as the reported value on the blockchain.
 */
export default class Aggregator extends SmartContract {
  // current trusted price based on the last round
  @state(Field) trustedPrice = State<Field>();
  @state(Field) lastRoundId = State<Field>(); // different from OCR round

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method init() {
    this.lastRoundId.set(Field(0));
  }

  @method getTrustedPrice() {
    return this.trustedPrice.get();
  }

  @method setTrustedPrice(trustedPrice: Field) {
    return this.trustedPrice.set(trustedPrice);
  }

  /**
   * Computes the trusted price reported
   * from OracleClients using median
   */
  computeTrustedPrice(arr: number[]) {
    const mid = Math.floor(arr.length / 2);
    if (!mid) return false;
    const trustedPrice = arr[mid];
    this.setTrustedPrice(Field(trustedPrice));
  }

  @method getRound() {
    return this.lastRoundId.get();
  }

  @method setRound(roundId: Field) {
    this.lastRoundId.set(roundId);
  }

  @method nextRound() {
    const curr = this.lastRoundId.get();
    const nextRound = curr.add(1);
    nextRound.assertEquals(curr.add(1));
    this.setRound(nextRound);
  }

  submitReport(report: Report) {
    // [x] verify the signatures
    for (let i = 0; i < report.observations.length; i++) {
      let signature = report.observations[i].signature;
      let price = report.observations[i].answer;
      let oracleId = report.observations[i].oracleId;
      let epoch = report.epoch;
      let pubkey = report.observations[i].oraclePublicKey;

      signature
        .verify(pubkey, [Field(price), Field(epoch), Field(oracleId)])
        .assertEquals(true);
    }
    // [] checks that the list of observations is sorted
    const isSorted = (arr: number[]) =>
      arr.every((v, i, a) => !i || a[i - 1] <= v);

    // if not sorted, something was corrupted
    if (!isSorted(report.observations.map((o) => o.answer))) {
      return false;
    }

    // [x] records which oracles contributed
    const contributors = report.observations.map((o) => o.oraclePublicKey);
    console.log({ contributors });
    // [x] stores the median of the observations as the reported value on the blockchain
    this.computeTrustedPrice(report.observations.map((o) => o.answer));

    // [] The contributing oracles receive a payout.
    // this.payout(contributors);
  }

  payout() {
    // for (let i = 0; i < addresses.length; i++) {
    //   let address = addresses[i];
    //   // send money from some wallet
    //   // FIXME: implement payout
    // }
    return null;
  }
}
