# Mempool Strategy

---

## TL;DR

EIP-8141 separates **what is consensus-valid** (programmable, broad) from **what the public mempool propagates** (constrained, opinionated). The proposed strategy uses two tiers in parallel:

- **Restrictive mempool** ships in clients first. Covers status-quo accounts plus a small set of high-value, low-complexity cases: post-quantum signatures, P256 (r1) signatures, and gas sponsorship via canonical paymasters. This is the [public mempool policy already specified](/current-spec#mempool-policy).
- **Expansive mempool** develops in parallel, opt-in per node. Built on the ERC-7562 / paymaster-extended lineage. Handles the long tail (privacy protocols, complex validation policies). FOCIL nodes default to the restrictive set and may add expansive ingress channels at their discretion.

For state, the proposal extends the [VOPS](/pending-concerns#2-vops-nodes-and-the-state-growth-problem) baseline to include **nonce, balance, code, and the first 4 storage slots per account**. Use cases that fall outside this VOPS extension (privacy protocols are the canonical example) pay an explicit cost: they include a **merkle branch** (4-8 kB today, 1-2 kB after a binary tree migration) proving the specific extra-VOPS state items they read. This per-tx cost falls only on the transactions that need it.

The framing is borrowed from Bitcoin: **let consensus rules do a lot, but restrict at the mempool layer**. Mempool policy is upgradable without hardforks, which is why Bitcoin has been able to evolve for 15+ years while keeping the consensus footprint narrow. EIP-8141 applies the same pattern to native AA.

A consequence of this design: **frame transactions do not need relayers**. Privacy rebroadcasters and "front ETH so users can pay gas in ERC-20" are both expressible as pure onchain smart contracts, with no live third-party actors required in the transaction supply chain.

---

## Two Tiers in One Mempool

The fundamental asymmetry: a frame transaction that does not match the mempool rules is still **consensus-valid on-chain**. It just cannot be gossiped through the public p2p network and must reach a block builder through private channels. This separation is what makes the two-tier strategy possible.

| Tier | What it carries | Validation cost | Status |
|---|---|---|---|
| **Restrictive mempool** | Status-quo accounts, PQ signatures, P256 (r1), canonical paymaster sponsorship, non-canonical paymaster (≤ 1 pending tx) | Bounded: validation prefix matches one of four shapes, ≤ 100,000 gas, banned opcodes, sender-only storage reads | Specified, ships with frame transactions |
| **Expansive mempool** | Privacy protocols, multi-paymaster sponsorship, arbitrary VERIFY-frame validation policies | Higher: ERC-7562-style staking/reputation, full simulation, multi-paymaster accounting | Develops in parallel, opt-in per node, no hardfork required |

A FOCIL node defaults to restrictive. It may opt into expansive ingress (ERC-7562, direct connections to wallet servers, block builders, TEE mempools) and any other channel it chooses. The more channels a FOCIL node accepts, the more transactions it can include. That decision is local to each node.

---

## Restrictive Mempool: What Ships First

The restrictive mempool is the [public mempool policy currently specified in EIP-8141](/current-spec#mempool-policy). It deliberately covers a small surface:

- **Self relay**: an account validates itself and pays its own gas
- **Canonical paymaster sponsorship**: a paymaster matching the canonical runtime code sponsors gas, with reserved-balance accounting
- **Account deployment**: deterministic deployment as the first frame, before validation
- **Non-canonical paymaster sponsorship**: bounded to a single pending transaction per paymaster, to cap mempool revalidation cost

Validation is constrained by:

- A validation prefix must match one of four shapes (`self_verify`, `deploy → self_verify`, `only_verify → pay`, `deploy → only_verify → pay`)
- Sum of validation-prefix gas ≤ `MAX_VERIFY_GAS` (100,000)
- A list of banned opcodes (`ORIGIN`, `TIMESTAMP`, `BLOCKHASH`, `CREATE`, `BALANCE`, `SELFBALANCE`, `SSTORE`, `TLOAD`, `TSTORE`, etc.)
- Storage reads only on `tx.sender`
- No calls to non-existent contracts or EIP-7702 delegations (with the explicit `tx.sender` default-code carve-out)

These constraints were chosen so that one transaction's validity depends on a small, predictable set of state items. That property is what makes mempool revalidation tractable when blocks land. It is also what makes the restrictive tier compatible with FOCIL inclusion lists out of the box.

**What the restrictive tier intentionally enables, even with these constraints:**

- secp256k1 signatures (status quo)
- P256 / passkey signatures
- Post-quantum signatures (any account-defined scheme that fits the validation budget)
- ERC-20 gas payment via canonical paymaster
- Smart account validation that reads only its own storage

This is "AA for the 80% case" at the protocol layer.

---

## Expansive Mempool: What Develops in Parallel

The expansive tier is for use cases that legitimately need more than the restrictive policy allows. The principal example is **privacy protocols**: a privacy-preserving withdrawal must read state outside `tx.sender` to verify a nullifier or membership proof. That violates the restrictive rule "no storage reads outside `tx.sender`."

The expansive tier handles this by accepting:

- ERC-7562-style validation with staking and reputation
- Paymaster-extended policies (sponsoring more accounts than the restrictive `MAX_PENDING_TXS_USING_NON_CANONICAL_PAYMASTER` limit)
- Arbitrary VERIFY-frame validation logic, subject to the node's own resource budget

Critically, the expansive tier is **not** a precondition for shipping EIP-8141. Clients ship the restrictive tier, and the privacy/complex-validation community develops the expansive tier independently. There is no hardfork dependency between the two.

This is the Bitcoin pattern: the mempool is a permissioned filter over the consensus rules, and that filter can evolve without coordinated network upgrades.

---

## The State Side: VOPS + 4 Slots

The [Validity-Only Partial Statelessness (VOPS) baseline](/pending-concerns#2-vops-nodes-and-the-state-growth-problem) is the minimum state footprint a node needs after ZKEVMs replace re-execution. The current VOPS proposal carries the full account trie (~10 GB for ~400M accounts).

The proposed extension for frame transactions:

| State item | Per account | Notes |
|---|---|---|
| Nonce | Already in VOPS | Standard EOA validation |
| Balance | Already in VOPS | Standard EOA validation |
| Code | Already in VOPS | Needed to detect smart accounts |
| **First 4 storage slots** | New | Covers the most common AA validation reads (signing key commitments, owner addresses, etc.) |

This is a small constant-factor increase over the current VOPS baseline, not a regression to full state. It covers the validation reads of well-designed AA wallets, whose validation logic is typically a tight loop over a few canonical slots (signer set, sequencer key, replay-protection counter).

---

## The Merkle Branch Escape Hatch

For use cases that read state outside the VOPS+4 baseline (privacy protocols are the canonical case, but any AA pattern using more than the first 4 slots qualifies), the proposal is straightforward: **the transaction includes a merkle branch proving the specific state items it reads**.

| Property | Today (MPT) | After binary tree migration |
|---|---|---|
| Branch size per state item | 4-8 kB | 1-2 kB |
| Items typically proved | 1-2 | 1-2 |

This is the explicit cost-of-doing-business for non-VOPS-friendly transactions:

- Pure status-quo and AA-VOPS-friendly transactions pay zero extra
- Privacy protocol transactions pay one or two branches per tx
- The cost falls on the transactions that need it, not on every transaction

The infrastructure already exists. Clients implement the witness machinery for sync today, and RPC methods for users to obtain witnesses are already standardized. Binary tree migration further compresses the cost.

---

## Resolving the Trilemma

The ["choose 2 of 3" trilemma](/pending-concerns#7-the-choose-2-of-3-trilemma) (Frames + FOCIL + VOPS) resolves under this strategy as follows:

| Transaction class | Restrictive mempool? | FOCIL? | VOPS+4? | Extra cost |
|---|---|---|---|---|
| Status-quo accounts (secp256k1) | Yes | Yes | Yes | None |
| AA wallets reading ≤ 4 own slots | Yes | Yes | Yes | None |
| AA wallets reading > 4 own slots | Yes | Yes | Yes (with witness) | 1-2 merkle branches |
| Canonical paymaster sponsorship | Yes | Yes | Yes | None |
| Non-canonical paymaster, low volume | Yes (≤ 1 pending) | Yes | Yes | None |
| Non-canonical paymaster, high volume | No (expansive only) | Opt-in | N/A | Expansive tier |
| Privacy protocol | No (expansive only) | Opt-in | Yes (with witness) | 1-2 merkle branches + expansive tier |

**The trilemma is resolved by paying real costs in the cases that need them**, not by forcing every transaction into a single one-size-fits-all policy. Frames + FOCIL + VOPS coexist for the majority of traffic. Edge cases pay their cost or move to the expansive tier.

---

## The Bitcoin Pattern: Permissive Consensus, Restrictive Mempool

The architectural pattern underlying this strategy is borrowed from Bitcoin:

- **Consensus rules are permissive**: anything that can be validated by the protocol is valid on-chain
- **Mempool rules are restrictive**: nodes filter the propagation network down to a safer subset
- **The mempool can evolve without hardforks**: tightening or loosening the filter is a node-policy change, not a consensus change

Bitcoin has used this pattern for over 15 years. Standardness rules, replace-by-fee policy, package relay, and many other improvements landed without consensus-level changes.

For EIP-8141, this means:

- Ship frame transactions with the restrictive mempool today
- Loosen the mempool over time as the expansive tier matures, without requiring a hardfork
- Tighten policy if a new DoS vector emerges, also without a hardfork

The cost is conceptual: developers must understand that "consensus-valid" and "publicly-relayable" are different categories. The benefit is enormous flexibility in how the network evolves.

(Bitcoin already has a form of "AA": its scripting language is exposed at the verification layer and mempool nodes execute it. The two-tier mempool pattern is what makes that workable in production.)

---

## Why Frame Transactions Don't Need Relayers

A common assumption inherited from EIP-4337 / EIP-7702 deployments is that AA requires off-chain relayer infrastructure: bundlers, paymaster operators, privacy rebroadcasters. The proposed strategy makes the explicit claim that **frame transactions do not need any of this**.

The mechanism: anything a relayer does for an EIP-4337 deployment can be expressed as a pure onchain smart contract under EIP-8141.

**Privacy rebroadcasters** become onchain contracts that observe the canonical mempool, repackage transactions with the necessary witness branches, and submit them. No live operator is required.

**"Front ETH so users can pay gas in ERC-20"** becomes a canonical paymaster (or non-canonical paymaster within the limit) that:
- Accepts an ERC-20 payment in a SENDER frame
- Pays the transaction's ETH gas cost
- Settles the rate at execution time

No live actor is required. The contract is the actor.

This is the structural advantage over EIP-4337 + EIP-7702: in those designs, the relayer/bundler is required because validation does not run in-protocol. EIP-8141 brings validation into the protocol, which removes the need for an out-of-protocol actor to validate, package, and submit.

The practical implication is one of the strongest claims in the [Developer Tooling bull case](/developer-tooling#bull-case-native-aa-with-powerful-defaults): the wallet adoption cost reduces to "implement a new transaction type," because there is no per-chain relayer infrastructure to operate.

---

## Summary

- **Two-tier mempool**: Restrictive (ships first, covers ~80% of cases) and Expansive (parallel, opt-in, handles privacy and complex validation).
- **VOPS extension**: Add the first 4 storage slots per account to the VOPS baseline. Small constant factor, covers most AA validation patterns.
- **Merkle branch escape hatch**: Use cases outside VOPS+4 include witness data (4-8 kB today, 1-2 kB binary tree). Cost falls on the transactions that need it.
- **Trilemma resolution**: Frames + FOCIL + VOPS coexist for the majority of traffic. Edge cases pay an explicit per-tx cost or move to the expansive tier.
- **Bitcoin pattern**: Permissive consensus + restrictive mempool = upgradability without hardforks.
- **No relayers**: Privacy rebroadcasters and ERC-20 gas fronting express as pure onchain smart contracts. The wallet integration cost collapses to "implement a new transaction type."
