import { PublicKey } from 'snarkyjs';
import Aggregator from './Aggregator';
import { Observation, Report, Transmission } from './types';

/**
 * Job of OCR is to take observations from OracleClients,
 * then combine them into a `Report`.
 * At the end of each `epoch`, the `Report` will be sent to the
 * Aggregator module, which computes and writes the trusted price on-chain.
 */
export class OCRAggregator {
  transmissions: Transmission[] = [];
  epoch: number = 0;
  heartbeat = 36000;
  deviationThreshold = 0.005;
  lastUpdate = null;
  observations: Observation[] = [];
  oracles: number[] = []; // FIXME: will be list of registered oracle ids
  aggregator: Aggregator;

  constructor(aggregatorPublicKey: PublicKey) {
    this.aggregator = new Aggregator(aggregatorPublicKey);
  }

  start() {
    // begin heartbeat interval
    setInterval(() => {
      this.sendReport();
      this.nextEpoch();
    }, this.heartbeat);
  }

  /**
   * Sends report to on-chain SmartContract
   */
  sendReport() {
    const report: Report = {
      // timestamp: Date.now(),
      epoch: this.epoch,
      signatures: [], //FIXME include array of signatures from oracles
      observations: this.observations.sort((a, b) => a.answer - b.answer),
    };
    console.log('SENDING:', report);
    this.aggregator.submitReport(report);
  }

  getObservations() {
    return this.observations;
  }

  getEpoch() {
    return this.epoch;
  }

  setEpoch(epoch: number) {
    this.epoch = epoch;
  }

  nextEpoch() {
    this.setEpoch(this.epoch + 1);
  }

  submitObservation(observation: Observation) {
    // in the future only allow registed oracles to submit observations
    this.observations.push({
      oraclePublicKey: observation.oraclePublicKey,
      oracleId: observation.oracleId,
      answer: observation.answer,
      timestamp: observation.timestamp,
      signature: observation.signature,
    });
  }
}
