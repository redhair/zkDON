# zkDON

Author: Thomas Bonanni

This is a Proof of Concept for a Zero-Knowledge Decentralized Oracle Network.

OCR Implementation based on [Chainlink Off-chain Reporting Protocol](https://research.chain.link/ocr.pdf?_ga=2.57196899.818463399.1660055777-521613243.1660055777)

## Premise

Modern Oracles suffer from a plethora of security flaws. Some driven by Oracle architechture itself, but others driven by underlying blockchain implementation. The goal of our zkDON is to achieve the following properties:

1. MEV Resistant - Oracles that publish updates on Ethereum are subject to back-running attacks, where an adverasary will position a liquidation transaction in the mempool immediately after the oracle update transaction, thus instantly liquidating a vault without contest. We want our Oracle Network to be resistant to these types of attacks.

2. Decentralized & Open Source - Oracles that are not decentralized become a central point of failure in the system and will be targeted by attackers. Closed source Oracles are also subject to trust-issues from their consumers on top of not being able to be publicly audited. The Oracle Client implementation must be open source for maximal resilience.

## How to build

```sh
npm run build
```

## How to run tests

```sh
npm run test
npm run testw # watch mode
```

## How to run coverage

```sh
npm run coverage
```

## License

[Apache-2.0](LICENSE)
