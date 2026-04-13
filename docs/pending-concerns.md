# Pending Concerns

---

This document summarizes open concerns around EIP-8141 frame transactions as they intersect with statelessness, mempool health, and censorship resistance. The primary source is the ethresear.ch thread ["Frame Transactions Through a Statelessness Lens"](https://ethresear.ch/t/frame-transactions-through-a-statelessness-lens/24538) (March–April 2026).

**Acronyms used throughout this doc**:

- **VOPS** — Validity-Only Partial Statelessness. The minimum state footprint a node needs after ZKEVMs replace re-execution. Current baseline is the full account trie (~10 GB for ~400M accounts). See the [AA-VOPS thread](https://ethresear.ch/t/a-pragmatic-path-towards-validity-only-partial-statelessness-vops/22236) for origin.
- **FOCIL** — Fork-Choice enforced Inclusion Lists. A censorship-resistance mechanism where a subset of validators publishes inclusion lists that the proposer must honor. Relies on inclusion-list builders being able to validate the transactions they include.
- **ERC-7562** — Validation rules for ERC-4337 bundlers (the closest existing framework for "what mempool nodes can safely simulate").

---

## Summary of Open Questions

| Concern | Status |
|---|---|
| Bytecode availability for AA-VOPS nodes | Addressed by [VOPS+4 extension](/mempool-strategy#the-state-side-vops-4-slots) (covers code + nonce + balance + 4 slots) |
| State growth bounds at scale AA adoption | Bounded under VOPS+4; non-VOPS-friendly txs pay [merkle branch cost](/mempool-strategy#the-merkle-branch-escape-hatch) |
| Canonical paymaster adoption guarantee | Depends on market, not protocol |
| Encrypted mempool compatibility | Routed through [expansive tier and onchain rebroadcasters](/mempool-strategy#expansive-mempool-what-develops-in-parallel), not public mempool |
| Non-canonical paymaster censorship resistance | None under current design (limited to 1 pending tx in restrictive tier) |
| Propagation guarantees under paymaster fragmentation | Open question |
| Frames + Public Mempool + Statelessness trilemma | Resolved under [two-tier mempool + VOPS+4 + witness escape hatch](/mempool-strategy#resolving-the-trilemma) |
| Witness-based FOCIL compatibility | Accepted as the explicit cost of the [escape hatch](/mempool-strategy#the-merkle-branch-escape-hatch) for non-VOPS-friendly txs |
| Implementation complexity and Glamsterdam impact | Contributing to delays, compounds other concerns |

---

## 1. Stateless Validation Is Fundamentally Harder for Frame Transactions

Legacy transactions require a single account trie lookup (~3,000 gas) to validate: check sender nonce and balance. Frame transactions execute arbitrary sender code via the VERIFY opcode, requiring access to the sender's bytecode, storage slots, and potentially helper library code, up to ~100k gas worth of state access.

For 7702-delegated EOAs (the expected common case for AA wallets), validation requires:
- The delegate contract's bytecode
- The sender's storage slots (executed in sender's context)
- Helper library code

This means most nodes in a post-ZKEVM stateless world cannot validate these transactions without carrying significantly more state than the minimum viable baseline.

**Counterpoint**: The proposed [restrictive mempool tier](/mempool-strategy#restrictive-mempool-what-ships-first) bounds validation state access to `tx.sender` storage with a hard 100,000-gas cap, and the proposed [VOPS extension](/mempool-strategy#the-state-side-vops-4-slots) covers the validation reads of well-designed AA wallets within a small constant-factor increase over the current baseline.

## 2. VOPS Nodes and the State Growth Problem

The Validity-Only Partial Statelessness (VOPS) baseline, the minimum viable node after ZKEVMs replace re-execution, requires ~10 GB to hold the full account trie for ~400M accounts. Frame transactions blow this budget:

| AA Adoption | Additional State | Total VOPS Size |
|---|---|---|
| 25% | ~15 GB | ~25 GB |
| 100% | ~62 GB | ~72 GB |

At N=4 storage slots cached per account (64 bytes per slot), full adoption results in an 8x increase from today's VOPS floor. Still below the ~280 GB full state, but a significant regression from the statelessness promise.

The [AA-VOPS proposal](https://ethresear.ch/t/a-pragmatic-path-towards-validity-only-partial-statelessness-vops/22236#p-54075-vops-and-native-account-abstraction-aavops-9) bounds storage reads to N slots per account but **does not address bytecode availability**: how AA-VOPS nodes obtain delegate bytecodes remains unspecified.

**Counterpoint**: The [proposed VOPS extension](/mempool-strategy#the-state-side-vops-4-slots) settles N at 4 slots and includes nonce, balance, and code, which addresses bytecode availability for the AA-friendly path. Use cases that exceed this baseline pay a [per-tx merkle branch cost](/mempool-strategy#the-merkle-branch-escape-hatch).

## 3. Mempool Health Is Censorship Resistance

The core issue: **"mempool health is censorship resistance."** Nodes that cannot validate certain transaction types cannot:
- Maintain healthy mempools for those transactions
- Propagate them across the network
- Enforce FOCIL inclusion lists covering them

If minimal nodes can't validate frame transactions, those transactions degrade to reliance on specialized infrastructure, exactly the centralization vector AA was meant to eliminate.

**Counterpoint**: The [two-tier mempool architecture](/mempool-strategy#two-tiers-in-one-mempool) keeps the public (restrictive) tier validatable by minimal nodes for the common cases (status-quo accounts, PQ/r1 signatures, canonical paymaster sponsorship). FOCIL nodes default to that tier and can opt into expansive ingress channels at their discretion.

## 4. The Canonical Paymaster Adoption Risk

The mempool strategy for gas sponsorship relies on a **canonical paymaster**, a standardized, protocol-blessed paymaster contract that all nodes can efficiently validate. The concern: this is a **mempool policy**, not a consensus rule.

Wallets can (and likely will) build non-canonical paymasters with richer features:
- Flexible withdrawal policies
- Multi-token payment
- Programmable sponsorship logic

If majority wallet adoption routes to non-canonical paymasters, those transactions:
- Cannot propagate through the public mempool
- Cannot be picked up by arbitrary builders
- Cannot be enforced by FOCIL inclusion lists

This creates a circular dependency: censorship resistance for AA transactions depends on market adoption of a specific design, not on protocol guarantees.

The dependency is structural. The canonical paymaster contract must be standardized, recognized by node software via runtime-code match, and voluntarily adopted by wallets. Any of those three steps failing means sponsored transactions land outside public-mempool propagation. Historical precedent: ERC-4337 paymaster diversity is high in production, and no dominant canonical variant has emerged, which is the exact failure mode this concern anticipates for frame transactions.

**Status**: unresolved. The restrictive mempool tier limits non-canonical paymasters to `MAX_PENDING_TXS_USING_NON_CANONICAL_PAYMASTER = 1` pending transaction each, which mitigates the public-mempool DoS surface but does not address censorship resistance for wallets that prefer richer paymaster logic. The [expansive mempool tier](/mempool-strategy#expansive-mempool-what-develops-in-parallel) is the proposed long-term answer, but it is opt-in per node.

## 5. Encrypted Mempools Are Incompatible

One proposed mitigation is a commit-and-execute model where block inclusion requires only balance, nonce, and a code flag. The transaction pays for actual validation later, decoupling inclusion from state access.

However, **encrypted mempools** (like the LUCID protocol for distributed payload propagation) break this approach entirely. If transaction contents are encrypted before inclusion, nodes cannot check even the minimal fields needed for DOS prevention.

The deeper tension: reconciling frame transactions with encrypted mempools, account abstraction, and statelessness remains an open research problem. Private transactions require hiding content, but DOS prevention requires inspecting it.

**Counterpoint**: Encrypted-mempool use cases are explicitly handled by the [expansive mempool tier](/mempool-strategy#expansive-mempool-what-develops-in-parallel) and by [onchain rebroadcaster contracts](/mempool-strategy#why-frame-transactions-dont-need-relayers), not by the public restrictive tier. The two-tier architecture is what makes this separation possible without forcing every transaction through one mempool policy.

## 6. Transaction Propagation Fragility

If canonical paymaster instances proliferate (multiple deployments, multiple configurations), how are propagation and inclusion guarantees preserved? Transactions that never reach a broad enough subset of the network cannot be picked up by builders or enforced via FOCIL.

Propagation success depends on the vast majority of minimal nodes being able to validate and relay. Any fragmentation in what those nodes can process directly narrows the set of transactions that have censorship resistance guarantees.

Concretely, the public mempool propagates a transaction only if enough of the relay graph can validate it. The restrictive tier's guarantee rests on every client implementing the same policy rules (validation prefix shapes, banned opcodes, canonical paymaster recognition). If implementation drift occurs (one client ships early, another is slow, a third adds policy tweaks), the effective propagation surface for AA transactions shrinks to the intersection of what all clients accept. This is a well-known failure mode for non-consensus policy rules and is not protocol-enforceable.

**Status**: open. No protocol mechanism prevents implementation drift or mitigates the shrink-to-intersection problem. Mitigations are all social / coordination-based: reference implementations, conformance tests, and client-developer consensus on the canonical paymaster bytecode. The [restrictive mempool tier](/mempool-strategy#restrictive-mempool-what-ships-first) is specified precisely enough to support conformance testing, but the propagation guarantee ultimately depends on cross-client agreement.

## 7. The "Choose 2 of 3" Trilemma

A recurring concern frames the design space as a trilemma between three goals:

1. **Frames / Native AA**
2. **Public Mempool / FOCIL**
3. **Statelessness / VOPS (Partial State)**

The argument: current designs cannot deliver all three simultaneously. Adopting native AA with frame transactions forces tradeoffs against either public mempool health (and thus censorship resistance via FOCIL) or statelessness goals. There is additional worry that undiscovered conflicts exist - that native AA may close doors to future protocol possibilities that haven't yet been fully articulated.

### Counterpoint: The Trilemma Is Solvable

EIP-8141 co-authors argue that all three goals are achievable under a two-tier mempool architecture and a small extension to the VOPS baseline. See the full framework in [Mempool Strategy](/mempool-strategy).

Summary of the resolution:

- The restrictive (public) mempool already constrains validation to bounded state access (storage reads on `tx.sender`, validation gas capped at `MAX_VERIFY_GAS = 100,000`). FOCIL compatibility has been [explicitly addressed](https://ethereum-magicians.org/t/focil-native-account-abstraction/27999).
- The VOPS baseline is extended to cover **nonce, balance, code, and the first 4 storage slots per account**, a small constant-factor increase that captures the validation reads of well-designed AA wallets ([Mempool Strategy → VOPS + 4 Slots](/mempool-strategy#the-state-side-vops-4-slots)).
- Use cases that read state outside that extension (privacy protocols are the canonical case) include a merkle branch (4-8 kB today, 1-2 kB after binary tree migration) per extra-VOPS state item. The cost falls only on transactions that need it ([Mempool Strategy → Merkle Branch Escape Hatch](/mempool-strategy#the-merkle-branch-escape-hatch)).
- Use cases that need richer mempool policy (multi-account paymasters, ERC-7562-style staking) move to the **expansive mempool tier**, which develops in parallel and is opt-in per node ([Mempool Strategy → Two Tiers in One Mempool](/mempool-strategy#two-tiers-in-one-mempool)).

Frame transactions give developers a choice: most accounts pay nothing extra, edge cases pay an explicit per-tx cost, and complex policies move to the expansive tier. This optionality is what makes the trilemma solvable without forcing every transaction into a single one-size-fits-all policy.

## 8. Witness-Based FOCIL Compatibility - Possible but Complex

One proposed mitigation for the VOPS/FOCIL tension: for every storage slot accessed outside the VOPS (balance, nonce, code, storage slots 0–15), transactions must include a **witness proving the value**, rooted in a recent state root (e.g., last 256 slots). FOCIL-participating nodes would also store state deltas from the last hour to resolve current state from stale witnesses.

The code paths for this already exist in clients (needed for syncing), and RPC methods exist for users to obtain witnesses. The extra data cost is ~4 kB per storage slot outside the VOPS (due to MPT inefficiency; a binary tree would reduce this to ~1 kB).

For **simple cases** — alternative signature algorithms, key rotation — this adds zero extra cost since the accessed state is fully within the VOPS. For **privacy protocol withdrawals**, it adds ~4 kB (significant but tolerable). For **more complex applications**, the overhead grows further.

However, the counterpoint is clear: while workarounds exist, **the complexity compounds significantly**. Adding witness requirements on top of frame transaction validation, VOPS constraints, and FOCIL enforcement represents a substantial engineering surface. The primary challenge becomes keeping state access heavily bounded - not just globally, but even within the context of an account's own self-state.

The proposed framework (see [Mempool Strategy](/mempool-strategy#the-merkle-branch-escape-hatch)) accepts this complexity as the explicit cost of the escape hatch, and limits it to the transactions that need it. The infrastructure already exists in clients (witness machinery is needed for sync, RPC methods for users to obtain witnesses are standardized), and binary tree migration further reduces the per-tx cost.

## 9. Implementation Complexity and Scope

Beyond the theoretical design tensions, there is a practical concern about the sheer complexity and breadth of implementation. Frame transactions touch consensus, mempool policy, p2p propagation, client state management, and wallet infrastructure simultaneously. Similar concerns were raised about the less complex EIP-8037, which was at least well-contained in scope.

Frame transactions are already a contributing factor to Glamsterdam delays. While this alone is not considered a decisive argument against the proposal, it compounds the other concerns - each open question adds implementation surface, and the interactions between VOPS, FOCIL, witness proofs, canonical paymasters, and encrypted mempools create a combinatorial testing and verification burden.

---

*Source: [ethresear.ch - Frame Transactions Through a Statelessness Lens](https://ethresear.ch/t/frame-transactions-through-a-statelessness-lens/24538)*
