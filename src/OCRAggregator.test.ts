import { Field, isReady, PrivateKey, Signature } from 'snarkyjs';
import { OCRAggregator } from './OCRAggregator';
import { Observation } from './types';
import { jest } from '@jest/globals';

jest.mock('./Aggregator');

describe('OCRAggregator', () => {
  let oraclePrivKey: PrivateKey;

  beforeEach(async () => {
    await isReady;
    oraclePrivKey = PrivateKey.random();
  });

  it('recieves observations', async () => {
    const ocr = new OCRAggregator(PrivateKey.random().toPublicKey());

    const beforeObservations = ocr.getObservations();
    expect(beforeObservations).toHaveLength(0);

    const o: Observation = {
      oracleId: 1,
      oraclePublicKey: oraclePrivKey.toPublicKey(),
      answer: 1000,
      timestamp: Date.now(),
      signature: Signature.create(oraclePrivKey, [
        Field(1000), // price
        Field(ocr.getEpoch()), // epoch
        Field(1), // oracleId
      ]),
    };
    ocr.submitObservation(o);

    const afterObservations = ocr.getObservations();
    expect(afterObservations).toHaveLength(1);
  });

  it('sends reports', async () => {
    const ocr = new OCRAggregator(PrivateKey.random().toPublicKey());
    const spy = jest.spyOn(ocr.aggregator, 'submitReport');

    const beforeObservations = ocr.getObservations();
    expect(beforeObservations).toHaveLength(0);

    const o: Observation = {
      oracleId: 1,
      oraclePublicKey: oraclePrivKey.toPublicKey(),
      answer: 1000,
      timestamp: Date.now(),
      signature: Signature.create(oraclePrivKey, [
        Field(1000), // price
        Field(ocr.getEpoch()), // epoch
        Field(1), // oracleId
      ]),
    };
    ocr.submitObservation(o);

    const afterObservations = ocr.getObservations();
    expect(afterObservations).toHaveLength(1);

    ocr.sendReport();
    // expect(mockedFunction).toHaveBeenCalledWith('param1', 'param2');

    expect(spy).toHaveBeenCalledWith({
      //   timestamp: Date.now(),
      epoch: ocr.getEpoch(),
      signatures: [],
      observations: afterObservations,
    });

    spy.mockRestore();
  });

  it('should send a report every 36000 ms', async () => {
    const ocr = new OCRAggregator(PrivateKey.random().toPublicKey());
    const spy = jest.spyOn(ocr.aggregator, 'submitReport');

    jest.useFakeTimers();
    ocr.start();

    jest.advanceTimersByTime(120000);
    const epoch = ocr.getEpoch();
    expect(epoch).toEqual(3);
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
