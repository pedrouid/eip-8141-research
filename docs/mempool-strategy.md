# Mempool Strategy

---

## TL;DR

EIP-8141 separates **what is consensus-valid** (programmable, broad) from **what the public mempool propagates** (constrained, opinionated). The proposed strategy uses two tiers in parallel:

- **Restrictive mempool** ships in clients first. Covers status-quo accounts plus PQ signatures, P256, and gas sponsorship via canonical paymasters. This is the [public mempool policy already specified](/current-spec#mempool-policy) in the current spec.
- **Expansive mempool** develops in parallel, opt-in per node. Built on the [ERC-7562](https://eips.ethereum.org/EIPS/eip-7562) lineage. Handles privacy protocols and complex validation. FOCIL nodes default to the restrictive set and may add expansive channels at their discretion.

For state, the proposal extends the [VOPS](/vops-compatibility#state-growth-at-scale) baseline to include **nonce, balance, code, and the first 4 storage slots per account**. Use cases outside this extension pay an explicit cost: a **merkle branch** (4-8 kB today, 1-2 kB after binary tree migration) per extra-VOPS state item. See the [AA-VOPS thread](https://ethresear.ch/t/a-pragmatic-path-towards-validity-only-partial-statelessness-vops/22236) for origin.

The framing is borrowed from Bitcoin: **let consensus rules do a lot, but restrict at the mempool layer**. Bitcoin Core's policy rules are upgradable without hardforks, which is why Bitcoin has evolved for 15+ years while keeping the consensus footprint narrow. EIP-8141 applies the same pattern.

A consequence: **the proposal claims frame transactions remove the need for off-chain relayers**. Privacy rebroadcasters and ERC-20 gas fronting are designed to be expressible as pure onchain smart contracts, with no live third-party actors required in the transaction supply chain.

---

## Two Tiers in One Mempool

> **Note**: The restrictive tier is in the current EIP-8141 spec. The expansive tier is a proposed framework, not a shipped feature.

A frame transaction that does not match the mempool rules is still **consensus-valid on-chain**. It just cannot be gossiped through the public p2p network. This separation makes the two-tier strategy possible.

| Tier | What it carries | Validation cost | Status |
|---|---|---|---|
| **Restrictive** | Status-quo accounts, PQ sigs, P256, canonical paymaster, non-canonical (1 pending tx) | Bounded: 4 prefix shapes, 100k gas, banned opcodes, sender-only reads | **Specified in EIP-8141** |
| **Expansive** | Privacy protocols, multi-paymaster, arbitrary VERIFY policies | Higher: ERC-7562 staking/reputation, full simulation | **Proposed**, opt-in per node |

---

## Restrictive Mempool: What Ships First

The restrictive tier covers a small surface:

- **Self relay**: account validates itself and pays its own gas
- **Canonical paymaster sponsorship**: paymaster matching canonical runtime code sponsors gas
- **Account deployment**: deterministic deployment as the first frame
- **Non-canonical paymaster**: bounded to 1 pending tx per paymaster

Validation constraints: one of four prefix shapes, gas 100k, banned opcodes (ORIGIN, TIMESTAMP, BLOCKHASH, CREATE, BALANCE, SSTORE, etc.), storage reads only on `tx.sender`, no calls to non-existent contracts.

What this enables: secp256k1, P256/passkeys, PQ signatures fitting the validation budget, ERC-20 gas payment via canonical paymaster, smart account validation reading only its own storage.

---

## Expansive Mempool: What Develops in Parallel

For use cases exceeding restrictive policy. The principal example: privacy protocols that must read state outside `tx.sender` to verify nullifiers.

The expansive tier accepts ERC-7562-style validation with staking/reputation, paymaster-extended policies, and arbitrary VERIFY logic subject to the node's resource budget. It is not a precondition for shipping EIP-8141. Clients ship restrictive first; the privacy/complex-validation community develops expansive independently. No hardfork dependency between the two.

---

## The State Side: VOPS + 4 Slots

The proposed extension for frame transactions:

| State item | Per account | Notes |
|---|---|---|
| Nonce | Already in VOPS | Standard EOA validation |
| Balance | Already in VOPS | Standard EOA validation |
| Code | Already in VOPS | Needed to detect smart accounts |
| **First 4 storage slots** | New | Covers most common AA validation reads |

A small constant-factor increase over the VOPS baseline, covering the validation reads of well-designed AA wallets (signer set, sequencer key, replay-protection counter).

---

## The Merkle Branch Escape Hatch

For use cases reading state outside VOPS+4, the transaction includes a merkle branch proving the state items it reads.

| Property | Today (MPT) | After binary tree |
|---|---|---|
| Branch size per item | 4-8 kB | 1-2 kB |
| Items typically proved | 1-2 | 1-2 |

Status-quo and AA-VOPS-friendly transactions pay zero extra. Privacy protocol transactions pay one or two branches. The infrastructure already exists in clients (witness machinery for sync, standardized RPC methods for users to obtain witnesses).

---

## Resolving the Trilemma

The ["choose 2 of 3" trilemma](/vops-compatibility#the-frames-focil-vops-trilemma) (Frames + FOCIL + VOPS) resolves under this strategy:

| Transaction class | Restrictive? | FOCIL? | VOPS+4? | Extra cost |
|---|---|---|---|---|
| Status-quo accounts | Yes | Yes | Yes | None |
| AA wallets reading 4 own slots | Yes | Yes | Yes | None |
| AA wallets reading > 4 own slots | Yes | Yes | Yes (witness) | 1-2 branches |
| Canonical paymaster | Yes | Yes | Yes | None |
| Non-canonical, low volume | Yes (1 pending) | Yes | Yes | None |
| Non-canonical, high volume | No (expansive) | Opt-in | N/A | Expansive tier |
| Privacy protocol | No (expansive) | Opt-in | Yes (witness) | Branches + expansive |

Frames + FOCIL + VOPS coexist for the majority of traffic. Edge cases pay per-tx cost or move to the expansive tier.

---

## Why Frame Transactions Don't Need Relayers

Anything a relayer does for EIP-4337 can be expressed as a pure onchain smart contract under EIP-8141.

**Privacy rebroadcasters** become onchain contracts observing the canonical mempool and repackaging transactions with witness branches. **ERC-20 gas fronting** becomes a canonical paymaster accepting token payment in a SENDER frame and paying ETH gas.

This is the structural argument against EIP-4337 + EIP-7702: in those designs, the relayer is required because validation does not run in-protocol. EIP-8141 brings validation in-protocol, which the proposal claims removes the structural need for out-of-protocol actors. Whether on-chain substitutes match bundlers' operational properties in practice is an open question.

The practical implication is central to the [Developer Tooling bull case](/developer-tooling#bull-case-native-aa-with-powerful-defaults): the wallet adoption cost reduces to "implement a new transaction type."

---

## Open Questions

### Mempool Health and Censorship Resistance

Nodes that cannot validate frame transactions cannot maintain healthy mempools, propagate them, or enforce FOCIL inclusion lists covering them. This degrades to reliance on specialized infrastructure. The two-tier architecture mitigates this: the restrictive tier is validatable by minimal nodes, and FOCIL nodes default to that tier. Whether this is sufficient depends on FOCIL adoption breadth.

### Canonical Paymaster Adoption

The restrictive tier relies on a canonical paymaster recognized by runtime code match. If wallets prefer non-canonical paymasters (richer features, multi-token payment), those transactions are limited to 1 pending tx each and cannot be enforced by FOCIL. Historical precedent: ERC-4337 paymaster diversity is high, with no dominant canonical variant. The expansive tier is the proposed long-term answer, but it is opt-in. This remains market-driven, not protocol-enforceable.

### Encrypted Mempool Compatibility

Encrypted mempools (like [LUCID/EIP-8184](https://eips.ethereum.org/EIPS/eip-8184)) encrypt transaction contents before inclusion. Nodes cannot check even minimal fields for DOS prevention. The proposed answer routes encrypted transactions through the expansive tier and [onchain rebroadcasters](#why-frame-transactions-dont-need-relayers), not the restrictive tier. See also [PQ Roadmap → Stage 4](/pq-roadmap#4-encrypted-mempools).

### Transaction Propagation Fragility

The restrictive tier's propagation guarantee rests on every client implementing the same policy rules. If implementation drift occurs (one client ships early, another is slow, a third adds tweaks), the effective propagation surface shrinks to the intersection. This is a well-known failure mode for non-consensus policy rules. Mitigations are social: reference implementations, conformance tests, client-developer consensus on canonical paymaster bytecode.

### Privacy Pools and the Three Gates {#privacy-pools-three-gates}

Nero_eth's [Three Gates to Privacy](https://ethresear.ch/t/frame-transactions-and-the-three-gates-to-privacy/24666) (Apr 16 2026) argues that shielded-pool withdrawals must pass three independent validation gates to reach a block under current rules, and all three reject them by default:

| Gate | What it checks | Why privacy withdrawals fail |
|---|---|---|
| **Public mempool** | VERIFY ≤ 100k gas, reads bounded to `tx.sender` storage, banned opcodes | Groth16 pairing check ~250k gas exceeds cap; nullifier slots live in the pool contract, not `tx.sender` |
| **FOCIL enforcement** | Per-tx 100k cap and per-IL 250k budget | Cumulative budget fits ~2 frame transactions; append-loop builder compliance imposes quadratic overhead |
| **VOPS / AA-VOPS node validation** | Nodes carry only balance/nonce (VOPS) or a few slots per account (AA-VOPS) | Nullifier lookups are hash-keyed slots in an external contract; no fixed N suffices, AA-VOPS cannot help |

What frame transactions already give privacy flows: invalid-proof and replayed-proof cases both cause `VERIFY` to revert before gas is charged, so a sponsor can be paid from the withdrawn amount itself with zero trust assumption and no out-of-protocol relayer. The gates, not the flow itself, are what block inclusion today.

The post proposes five protocol changes to create a viable inclusion path:

1. Extend the canonical-contract code-hash exemption to recognized privacy pools.
2. Raise the per-transaction `VERIFY` gas cap to ~400k for canonical frames.
3. Adopt validation-index FOCIL enforcement: builders publish `(tx_hash, claimed_index)` pairs and attesters validate once at the claimed state, breaking the append-loop quadratic.
4. Raise `MAX_VERIFY_GAS_PER_INCLUSION_LIST` to 2^20 (1M gas).
5. Relax the bounded state-access rule for canonical privacy pools so nullifier reads are propagatable.

Tradeoff acknowledged in the post: under the validation-index model, attesters absorb up to ~28% of block gas in the worst case within the 4-second attestation deadline. Whether that remains feasible under stressed network conditions is open. The proposal also assumes PS (partially stateful) nodes voluntarily track privacy pools, an infrastructure coordination problem that protocol changes alone do not solve.

See [VOPS Compatibility → Status](/vops-compatibility#status) for the state-side row on privacy-pool reads.

---

## Summary

- **Two-tier mempool** (proposed): Restrictive (in spec, common case) and Expansive (parallel, opt-in, privacy and complex validation).
- **VOPS extension** (proposed): nonce, balance, code, first 4 slots per account.
- **Merkle branch escape hatch** (proposed): 4-8 kB today, 1-2 kB after binary tree. Cost falls on transactions that need it.
- **Trilemma**: Frames + FOCIL + VOPS coexist for majority of traffic. Edge cases pay per-tx cost or use the expansive tier.
- **Bitcoin pattern** (analogy): permissive consensus + restrictive mempool gives upgradability without hardforks.
- **No relayers** (proposed claim): privacy rebroadcasters and ERC-20 gas fronting are expressible as onchain contracts. Whether they match bundler operational properties is open.
- **Open questions**: canonical paymaster adoption (market-driven), propagation fragility (cross-client alignment), encrypted mempool routing (expansive tier), mempool health (FOCIL adoption), privacy pools and the [three gates](#privacy-pools-three-gates) (canonical-pool exemption + validation-index FOCIL + raised VERIFY caps proposed).

---

## Read Next

- [VOPS Compatibility](/vops-compatibility) — the state-side view of the same trilemma, with plain-English definitions of VOPS, FOCIL, and validation state.
- [Current Spec → Mempool Policy](/current-spec#mempool-policy) — the restrictive tier as it appears in the spec itself.
- [PQ Roadmap](/pq-roadmap) — how the mempool strategy interacts with encrypted mempools and the longer PQ arc.
