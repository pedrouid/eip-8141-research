# Pending Concerns

---

This document summarizes open concerns around EIP-8141 frame transactions as they intersect with statelessness, mempool health, and censorship resistance. The primary source is the ethresear.ch thread ["Frame Transactions Through a Statelessness Lens"](https://ethresear.ch/t/frame-transactions-through-a-statelessness-lens/24538) by CPerezz (March–April 2026).

---

## 1. Stateless Validation Is Fundamentally Harder for Frame Transactions

Legacy transactions require a single account trie lookup (~3,000 gas) to validate: check sender nonce and balance. Frame transactions execute arbitrary sender code via the VERIFY opcode, requiring access to the sender's bytecode, storage slots, and potentially helper library code, up to ~100k gas worth of state access.

For 7702-delegated EOAs (the expected common case for AA wallets), validation requires:
- The delegate contract's bytecode
- The sender's storage slots (executed in sender's context)
- Helper library code

This means most nodes in a post-ZKEVM stateless world cannot validate these transactions without carrying significantly more state than the minimum viable baseline.

## 2. VOPS Nodes and the State Growth Problem

The Validity-Only Partial Statelessness (VOPS) baseline, the minimum viable node after ZKEVMs replace re-execution, requires ~10 GB to hold the full account trie for ~400M accounts. Frame transactions blow this budget:

| AA Adoption | Additional State | Total VOPS Size |
|---|---|---|
| 25% | ~15 GB | ~25 GB |
| 100% | ~62 GB | ~72 GB |

At N=4 storage slots cached per account (64 bytes per slot), full adoption results in an 8x increase from today's VOPS floor. Still below the ~280 GB full state, but a significant regression from the statelessness promise.

The AA-VOPS proposal by Thomas Thiery bounds storage reads to N slots per account but **does not address bytecode availability**: how AA-VOPS nodes obtain delegate bytecodes remains unspecified.

## 3. Mempool Health Is Censorship Resistance

CPerezz frames the core issue directly: **"mempool health is censorship resistance."** Nodes that cannot validate certain transaction types cannot:
- Maintain healthy mempools for those transactions
- Propagate them across the network
- Enforce FOCIL inclusion lists covering them

If minimal nodes can't validate frame transactions, those transactions degrade to reliance on specialized infrastructure, exactly the centralization vector AA was meant to eliminate.

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

CPerezz states the requirement plainly: **"we essentially need to make sure that the canonical Paymaster is what wallets want and what gets broad adoption. Otherwise, we will be in trouble."**

This creates a circular dependency: censorship resistance for AA transactions depends on market adoption of a specific design, not on protocol guarantees.

## 5. Encrypted Mempools Are Incompatible

DanielVF proposed a commit-and-execute model where block inclusion requires only balance, nonce, and a code flag - the transaction pays for actual validation later. This would decouple inclusion from state access.

CPerezz identified a fundamental conflict: **encrypted mempools** (like the LUCID protocol for distributed payload propagation) break this approach entirely. If transaction contents are encrypted before inclusion, nodes cannot check even the minimal fields needed for DOS prevention.

The deeper tension: **"it's super hard for me to see how to have private txs, when we have to pay for DOS prevention work."** Reconciling frame transactions with encrypted mempools, account abstraction, and statelessness remains an open research problem.

## 6. Transaction Propagation Fragility

ParthSinghPS raised the propagation fragility concern: if canonical paymaster instances proliferate (multiple deployments, multiple configurations), how are propagation and inclusion guarantees preserved? Transactions that never reach a broad enough subset of the network cannot be picked up by builders or enforced via FOCIL.

CPerezz confirmed that propagation success depends on **"the vast majority of the most minimal nodes"** being able to validate and relay. Any fragmentation in what those nodes can process directly narrows the set of transactions that have censorship resistance guarantees.

## 7. The "Choose 2 of 3" Trilemma

A recurring concern in internal discussions frames the design space as a trilemma between three goals:

1. **Frames / Native AA**
2. **Public Mempool / FOCIL**
3. **Statelessness / VOPS (Partial State)**

The argument: current designs cannot deliver all three simultaneously. Adopting native AA with frame transactions forces tradeoffs against either public mempool health (and thus censorship resistance via FOCIL) or statelessness goals. There is additional worry that undiscovered conflicts exist - that native AA may close doors to future protocol possibilities that haven't yet been fully articulated.

### Counterpoint: The Trilemma Is Solvable

EIP-8141 co-author Derek Chiang argues that all three goals are achievable, provided "native AA" is understood as "native AA with bounded state access during validation" rather than "native AA with arbitrary state access."

The key insight: the mempool already constrains validation to bounded state access (storage reads restricted to `tx.sender`, gas capped at 100k). FOCIL compatibility has been [explicitly addressed](https://ethereum-magicians.org/t/focil-native-account-abstraction/27999), and VOPS compatibility is achievable by extending VOPS to cover the first N storage slots per account, as described in the [AA-VOPS proposal](https://ethresear.ch/t/a-pragmatic-path-towards-validity-only-partial-statelessness-vops/22236#p-54075-vops-and-native-account-abstraction-aavops-9).

Frame transactions give developers a choice: if censorship resistance matters, build accounts that are FOCIL/VOPS-compatible by using only the first N slots during validation. If censorship resistance is not a priority, use private pools and do arbitrarily advanced things in the validation phase, including arbitrary state access. This optionality is what makes frames the most flexible approach, and is aligned with Ethereum's philosophy of giving users and developers choice rather than imposing constraints.

## 8. Witness-Based FOCIL Compatibility - Possible but Complex

One proposed mitigation for the VOPS/FOCIL tension comes from an earlier Vitalik proposal: for every storage slot accessed outside the VOPS (balance, nonce, code, storage slots 0–15), transactions must include a **witness proving the value**, rooted in a recent state root (e.g., last 256 slots). FOCIL-participating nodes would also store state deltas from the last hour to resolve current state from stale witnesses.

The code paths for this already exist in clients (needed for syncing), and RPC methods exist for users to obtain witnesses. The extra data cost is ~4 kB per storage slot outside the VOPS (due to MPT inefficiency; a binary tree would reduce this to ~1 kB).

For **simple cases** — alternative signature algorithms, key rotation — this adds zero extra cost since the accessed state is fully within the VOPS. For **privacy protocol withdrawals**, it adds ~4 kB (significant but tolerable). For **more complex applications**, the overhead grows further.

However, the counterpoint is clear: while workarounds exist, **the complexity compounds significantly**. Adding witness requirements on top of frame transaction validation, VOPS constraints, and FOCIL enforcement represents a substantial engineering surface. The primary challenge becomes keeping state access heavily bounded - not just globally, but even within the context of an account's own self-state.

## 9. Implementation Complexity and Scope

Beyond the theoretical design tensions, there is a practical concern about the sheer complexity and breadth of implementation. Frame transactions touch consensus, mempool policy, p2p propagation, client state management, and wallet infrastructure simultaneously. Similar concerns were raised about the less complex EIP-8037, which was at least well-contained in scope.

Frame transactions are already a contributing factor to Glamsterdam delays. While this alone is not considered a decisive argument against the proposal, it compounds the other concerns - each open question adds implementation surface, and the interactions between VOPS, FOCIL, witness proofs, canonical paymasters, and encrypted mempools create a combinatorial testing and verification burden.

## Summary of Open Questions

| Concern | Status |
|---|---|
| Bytecode availability for AA-VOPS nodes | Unspecified in current proposals |
| State growth bounds at scale AA adoption | Quantified but not mitigated |
| Canonical paymaster adoption guarantee | Depends on market, not protocol |
| Encrypted mempool compatibility | Fundamental conflict, no solution proposed |
| Non-canonical paymaster censorship resistance | None under current design |
| Propagation guarantees under paymaster fragmentation | Open question |
| Frames + Public Mempool + Statelessness trilemma | Disputed: solvable if validation uses bounded state access |
| Witness-based FOCIL compatibility | Theoretically possible, high complexity |
| Implementation complexity and Glamsterdam impact | Contributing to delays, compounds other concerns |

---

*Source: [ethresear.ch - Frame Transactions Through a Statelessness Lens](https://ethresear.ch/t/frame-transactions-through-a-statelessness-lens/24538)*
