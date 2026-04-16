# VOPS Compatibility

---

## TL;DR

Frame transactions require more validation state than legacy transactions. Legacy validation is a single account-trie lookup (~3,000 gas); frame validation executes arbitrary sender code via VERIFY frames (up to ~100,000 gas), pulling in bytecode, storage slots, and helper libraries. This page covers how EIP-8141 interacts with [VOPS](https://ethresear.ch/t/a-pragmatic-path-towards-validity-only-partial-statelessness-vops/22236) (Validity-Only Partial Statelessness), what state nodes need to carry, and where the boundaries are.

**Acronyms**: **VOPS** (~10 GB baseline for ~400M accounts), **FOCIL** (Fork-Choice enforced Inclusion Lists, [EIP-7805](https://eips.ethereum.org/EIPS/eip-7805)).

---

## Status

| Topic | Status |
|---|---|
| Validation state requirements | Bounded: [restrictive tier](/mempool-strategy#restrictive-mempool-what-ships-first) caps at 100k gas, sender-only storage reads |
| Bytecode availability | Proposed: [VOPS+4 extension](/mempool-strategy#the-state-side-vops-4-slots) includes code |
| State growth at AA scale | Proposed: ~72 GB under VOPS+4; extra-VOPS reads pay [merkle branch cost](/mempool-strategy#the-merkle-branch-escape-hatch) |
| Frames + FOCIL + VOPS trilemma | Proposed: [two-tier mempool + VOPS+4 + witness escape hatch](/mempool-strategy#resolving-the-trilemma) |
| Witness-based FOCIL | Proposed: 4-8 kB today, 1-2 kB after binary tree migration |
| Implementation complexity | Open: compounds with other protocol changes |

---

## Validation State Requirements

Legacy transactions require a single account trie lookup. Frame transactions execute arbitrary sender code via VERIFY, requiring bytecode, storage slots, and helper library code up to the 100,000-gas validation cap. Most nodes in a post-ZKEVM stateless world cannot validate these without carrying more state than the VOPS baseline provides.

The [restrictive mempool tier](/mempool-strategy#restrictive-mempool-what-ships-first) bounds this: validation is limited to `tx.sender` storage, capped at 100,000 gas, with banned opcodes preventing reads outside the sender's state. The [VOPS+4 extension](/mempool-strategy#the-state-side-vops-4-slots) (nonce, balance, code, first 4 storage slots per account) covers well-designed AA wallets within a small constant-factor increase over the VOPS baseline.

## State Growth at Scale

At N=4 storage slots per account, full AA adoption results in ~72 GB total VOPS size, an 8x increase from the ~10 GB floor. This is still well below the ~280 GB full state, but it is a significant regression from the VOPS baseline. The original AA-VOPS proposal did not address bytecode availability.

derekchiang proposed (ethresear.ch [post #12](https://ethresear.ch/t/frame-transactions-through-a-statelessness-lens/24538/12), Apr 15) adding all contract bytecodes to VOPS directly (~10.55 GB), roughly doubling the baseline but staying well below full state. Extra-VOPS use cases pay a [merkle branch cost](/mempool-strategy#the-merkle-branch-escape-hatch) per item: 4-8 kB today, 1-2 kB after binary tree migration.

## The Frames + FOCIL + VOPS Trilemma

A recurring observation from the [ethresear.ch thread](https://ethresear.ch/t/frame-transactions-through-a-statelessness-lens/24538): current designs cannot simultaneously deliver Frames/Native AA, Public Mempool/FOCIL, and Statelessness/VOPS. You can have at most two.

The EIP-8141 co-authors argue all three are achievable per-transaction-class. The restrictive mempool constrains validation to bounded state access. VOPS extends to nonce, balance, code, and 4 slots. Extra-VOPS use cases include merkle branches. Complex policies move to the [expansive tier](/mempool-strategy#expansive-mempool-what-develops-in-parallel). The full resolution framework is in [Mempool Strategy](/mempool-strategy#resolving-the-trilemma).

## Witness Costs for Extra-VOPS Reads

For storage slots outside the VOPS+4 extension, transactions include a witness proving the state items they read. Simple cases (alternative sig algorithms, key rotation) add zero extra cost since their validation reads fit within VOPS+4. Privacy protocol withdrawals, which must verify nullifiers in external contract storage, add ~4 kB per proven item.

The infrastructure already exists in clients (witness machinery is needed for sync), and binary tree migration further reduces the per-item cost. The framework accepts this as the explicit per-transaction cost of the escape hatch, limited to transactions that need it.

## Implementation Complexity

Frame transactions touch consensus, mempool policy, p2p propagation, client state management, and wallet infrastructure simultaneously. This has been cited as adding scope to the Glamsterdam timeline. The interactions between VOPS, FOCIL, witness proofs, and the two-tier mempool architecture create a combinatorial testing surface that compounds with each open question.

---

## Summary

The VOPS+4 extension plus merkle witnesses covers the majority of frame transaction validation within a bounded state footprint. Status-quo accounts and well-designed AA wallets fit entirely within VOPS+4 at zero extra cost. Privacy protocols and complex validation pay per-transaction witness costs. The [two-tier mempool architecture](/mempool-strategy) keeps FOCIL-enforcing nodes on the restrictive tier by default while enabling an opt-in expansive tier for use cases that exceed the bounded state model.

**What to watch**: whether the VOPS+4 extension gets formal adoption, and whether the witness cost after binary tree migration is low enough to make the escape hatch practical at scale.

---

*Source: [ethresear.ch - Frame Transactions Through a Statelessness Lens](https://ethresear.ch/t/frame-transactions-through-a-statelessness-lens/24538)*
