import Aggregator from './Aggregator';
import {
  isReady,
  shutdown,
  Mina,
  PrivateKey,
  PublicKey,
  Party,
  Field,
  Signature,
} from 'snarkyjs';
import { Report } from './types';

function createLocalBlockchain() {
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  return Local.testAccounts[0].privateKey;
}

async function localDeploy(
  zkAppInstance: Aggregator,
  zkAppPrivkey: PrivateKey,
  deployerAccount: PrivateKey
) {
  const txn = await Mina.transaction(deployerAccount, () => {
    Party.fundNewAccount(deployerAccount);
    zkAppInstance.deploy({ zkappKey: zkAppPrivkey });
    zkAppInstance.init();
  });
  await txn.send().wait();
}

describe('Aggregator', () => {
  let deployerAccount: PrivateKey;
  let zkAppAddress: PublicKey;
  let zkAppPrivateKey: PrivateKey;

  beforeEach(async () => {
    await isReady;
    deployerAccount = createLocalBlockchain();
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  it('initializes the round to 0', async () => {
    const zkAppInstance = new Aggregator(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const roundId = zkAppInstance.getRound();
    expect(roundId).toEqual(Field(0));
  });

  it('sets & gets trusted price', async () => {
    const zkAppInstance = new Aggregator(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const txn = await Mina.transaction(deployerAccount, () => {
      zkAppInstance.setTrustedPrice(Field(1111));
      zkAppInstance.sign(zkAppPrivateKey);
    });
    await txn.send().wait();

    const updatedNum = zkAppInstance.getTrustedPrice();
    expect(updatedNum).toEqual(Field(1111));
  });

  it('computes the median from the list of prices', async () => {
    const zkAppInstance = new Aggregator(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const txn = await Mina.transaction(deployerAccount, () => {
      zkAppInstance.computeTrustedPrice([1, 2, 3, 4, 5]);
      zkAppInstance.sign(zkAppPrivateKey);
    });
    await txn.send().wait();
    const trustedPrice = zkAppInstance.getTrustedPrice();
    expect(trustedPrice).toEqual(Field(3));
  });

  it('sets & gets the latest round', async () => {
    const zkAppInstance = new Aggregator(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const txn = await Mina.transaction(deployerAccount, () => {
      zkAppInstance.setRound(Field(2));
      zkAppInstance.sign(zkAppPrivateKey);
    });
    await txn.send().wait();
    const roundId = zkAppInstance.getRound();
    expect(roundId).toEqual(Field(2));
  });

  it('increments to the next round', async () => {
    const zkAppInstance = new Aggregator(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const txn = await Mina.transaction(deployerAccount, () => {
      zkAppInstance.nextRound();
      zkAppInstance.sign(zkAppPrivateKey);
    });
    await txn.send().wait();
    const roundId = zkAppInstance.getRound();
    expect(roundId).toEqual(Field(1));
  });

  it('submits the report and updates the trustedPrice as the median of the submitted observations', async () => {
    const zkAppInstance = new Aggregator(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    let oracle1PrivKey = PrivateKey.random();
    let oracle2PrivKey = PrivateKey.random();
    let oracle3PrivKey = PrivateKey.random();
    const mockReport: Report = {
      // timestamp: Date.now(),
      epoch: 1,
      // 3 random signature
      signatures: [
        ...Array(3).map(() => Signature.create(PrivateKey.random(), [])),
      ],
      observations: [
        {
          oracleId: 1,
          oraclePublicKey: oracle1PrivKey.toPublicKey(),
          answer: 1111,
          timestamp: Date.now(),
          signature: Signature.create(oracle1PrivKey, [
            Field(1111),
            Field(1),
            Field(1),
          ]),
        },
        {
          oracleId: 2,
          oraclePublicKey: oracle2PrivKey.toPublicKey(),
          answer: 3333,
          timestamp: Date.now(),
          signature: Signature.create(oracle2PrivKey, [
            Field(3333),
            Field(1),
            Field(2),
          ]),
        },
        {
          oracleId: 3,
          oraclePublicKey: oracle3PrivKey.toPublicKey(),
          answer: 9999,
          timestamp: Date.now(),
          signature: Signature.create(oracle3PrivKey, [
            Field(9999),
            Field(1),
            Field(3),
          ]),
        },
      ],
    };
    const txn = await Mina.transaction(deployerAccount, () => {
      zkAppInstance.submitReport(mockReport);
      zkAppInstance.sign(zkAppPrivateKey);
    });
    await txn.send().wait();
    const trustedPrice = zkAppInstance.getTrustedPrice();
    expect(trustedPrice).toEqual(Field(3333));
  });
});
