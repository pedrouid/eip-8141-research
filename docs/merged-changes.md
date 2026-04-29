# Changes Merged Over Time and Why

---

## Day 0 Fixes — January 29, 2026

*Why this mattered: two tiny fixes merged on the same day as the original submission, establishing a fast-review cadence that carried through the rest of the spec's evolution.*

### PR #11205: Add missing elision of VERIFY frame data from signature hash

**Author**: fjl | **Merged**: Jan 29

- Bug: the original spec did not elide `frame.data` of VERIFY frames when computing the canonical signature hash
- This was critical because VERIFY frames contain the signature itself; by definition it cannot be part of the signature hash
- Merged same day

### PR #11209: Fix status field number

**Author**: kevaundray | **Merged**: Jan 29

- The TXPARAM table had an incorrect field number for the `status` parameter
- Simple numbering fix, approved by fjl

---

## APPROVE Relaxation — February 10, 2026

*Why this mattered: unblocked proxy-based smart accounts (Safe-style) from adopting the spec. Without this, accounts whose outer proxy predates `APPROVE` would have been locked out entirely.*

### PR #11297: Relax requirement that APPROVE must be called by top level call frame

**Author**: lightclient | **Merged**: Feb 10

- **Why**: Existing smart accounts (especially proxy-based ones like Safe) can change their implementation code but NOT their outer proxy contract. The outer proxy uses `RETURN`, not `APPROVE`. Requiring top-level `APPROVE` made adoption impossible for these accounts.
- **Change**: `APPROVE` became transaction-scoped, meaning it can be called from any depth and updates `sender_approved`/`payer_approved` directly, rather than requiring the top-level frame to exit with a special return code.

From lightclient's PR description:

> This allows existing smart accounts to more easily adopt EIP-8141. Before, the requirement was that accounts must exit the top level frame with APPROVE. Since APPROVE only exists with 8141, not smart accounts today support it. More importantly, smart accounts who are deployed with proxies _can_ change their smart account implementations, but still not the outer proxy which won't understand `APPROVE`.

---

## Bug Fixes & Clarifications — February-March 2026

*Why this mattered: caught a refactor-introduced CALLER/ADDRESS bug in APPROVE and settled ambiguities around frame reverts before downstream PRs built on the older, wrong assumptions.*

### PR #11344: Fix some issues with EIP-8141

**Author**: derekchiang | **Merged**: Mar 2

- **Fixed CALLER vs ADDRESS**: Changed `CALLER == frame.target` to `ADDRESS == frame.target` for APPROVE. In VERIFY frames, CALLER is ENTRY_POINT, not frame.target. This was a bug introduced during refactoring.
- **Removed APPROVE restriction to VERIFY frames**: lightclient wanted APPROVE available in any mode for private pool use cases (stateful approvals).
- **Clarified frame reverts**: Made explicit that a frame revert discards that frame's state changes but doesn't affect other frames.
- Notable discussion: nlordell asked about the TXPARAM numbering jump from 0x09 to 0x10; lightclient confirmed it was intentional to separate tx-level vs frame-level queries.

---

## EOA Support — March 5-10, 2026

*Why this mattered: the pivot. Made EOAs first-class users of frame transactions and reframed the spec from "smart-account-assumed" to "EOA-first." Every downstream design decision traces back to this merge.*

### PR #11379: Add EOA support

**Author**: derekchiang | **Merged**: Mar 10

- **Why**: The biggest driver was adoption: if most users are on EOAs, frame transactions need to work for them natively, without requiring smart contract deployment.
- **What changed**: Added "default code" behavior for EOAs:
  - In VERIFY mode: reads `frame.data` as a signature, supports SECP256K1 (0x0) and P256 (0x1) types, calls `APPROVE(scope)`
  - In SENDER mode: reads `frame.data` as RLP-encoded calls `[[target, value, data], ...]` and executes them
  - In DEFAULT mode: reverts
- Also initially added a `value` field to frames (later removed; the default code handles value via call encoding)

---

## Opcode Redesign — March 12, 2026

*Why this mattered: gave scalar and variable-length transaction data the opcodes they actually need. Scalar values no longer pay the cost of copy semantics meant for byte strings, and frame input data gets dedicated `FRAMEDATA*` opcodes that match its shape.*

### PR #11400: Clean up frame access opcodes

**Author**: fjl | **Merged**: Mar 12

- **Why**: Most TXPARAM values are 32 bytes or less, so `TXPARAMSIZE`/`TXPARAMCOPY` (designed for variable-length data) were unnecessary for most fields. The only variable-size data is frame input data.
- **Change**: Replaced `TXPARAMSIZE (0xb1)` and `TXPARAMCOPY (0xb2)` with dedicated `FRAMEDATALOAD (0xb1)` and `FRAMEDATACOPY (0xb2)`. Renamed `TXPARAMLOAD` to just `TXPARAM (0xb0)`.

From fjl's PR description:

> Most values returned by the TXPARAM opcode family is 32-bytes or less, so it makes no sense to be able to copy the data into memory. The only variable-size components of the transaction are the frame list and the input data of each frame. So I am defining specialized opcodes for reading the input data of the frame.

---

## Approval Bits — March 12-13, 2026

*Why this mattered: let users sign over their intended approval scope as part of the signed transaction payload, so smart accounts don't each have to implement bespoke scope-extraction logic. Simplified the default code and moved trust about scope from frame data to mode bits.*

### PR #11401: Add approval bits to frame mode

**Author**: fjl | **Merged**: Mar 12

- **Why**: Users needed a way to specify their intended approval scope **in the signed transaction data** so that smart accounts don't have to extract scope from `frame.data` (which is elided from the signature hash). Without this, accounts would need to compute `keccak(sighash | scope)`, which is repetitive logic every account must implement.
- **Change**: Added bits 9-10 of `frame.mode` as approval scope constraints. These constrain which `APPROVE` scopes are valid for that frame.
- Also shifted APPROVE scope values from 0-indexed (0x0, 0x1, 0x2) to 1-indexed (0x1, 0x2, 0x3) so that the mode bits can directly encode the constraint.

From fjl's PR description:

> The primary motivation for adding these bits is allowing the user to specify to their own account what should be approved, while retaining the ability to sign directly over the sighash of the transaction. However, the concept of mode bits is going to be useful for other things we may have to put in later, and it also gives some security benefits.

### PR #11402: Fix bit indices

**Author**: fjl | **Merged**: Mar 13

- Changed from 0-indexed to 1-indexed bit numbering (bits 9 and 10 instead of 8 and 9), since bits are "typically one-indexed."

---

## Atomic Batching — March 11-25, 2026

*Why this mattered: settled a month-long debate (atomic-by-default vs opt-in vs group-id) with a flag-based design that gave users atomic "approve + swap" semantics without breaking paymaster flows that need non-atomic defaults.*

### PR #11395: Add support for atomic batching

**Author**: derekchiang | **Merged**: Mar 25

- **Why**: Users need "all-or-nothing" semantics for related operations (e.g., ERC-20 approve + swap). Without this, a revert in one frame leaves prior frames' state changes applied, creating dangerous intermediate states.
- **Evolution**: Originally proposed a `SENDER_ATOMIC` mode. After extensive discussion:
  - pedrouid argued for atomic-by-default
  - derekchiang & frangio explained non-atomic is needed for paymasters
  - 0xrcinus proposed explicit group IDs
  - sm-stack suggested bit flags
- **Final design**: Bit 11 of `frame.mode` as the "atomic batch" flag. Consecutive SENDER frames with the flag set form a batch. If any frame in the batch reverts, all preceding frames are reverted and remaining frames are skipped.
- **Additional change**: Required `sender_approved` to be true before any SENDER frame can execute. This forbids APPROVE from being called in SENDER mode, preventing complexity where an atomic batch could revert a payment approval.

From derekchiang's PR description:

> This PR also adds the explicit requirement that `SENDER` frames can only be executed when `sender_approved` and `payer_approved` have been set to `true`, which essentially forbids `approve` from being called in `SENDER` modes. This is important because otherwise a `SENDER_ATOMIC` frame can `approve` gas payment, and then the payment frame may be reverted by other `SENDER_ATOMIC` frames, creating complexity for transaction validation.

---

## Mempool Policy — March 16-25, 2026

*Why this mattered: turned EIP-8141 from a consensus-layer spec into something clients could actually ship. Bounded validation cost, standardized the paymaster shape, and replaced ERC-7562's reputation/staking complexity with a canonical-paymaster code match.*

### PR #11415: Add mempool policy

**Author**: lightclient | **Merged**: Mar 25

- **Why**: Without clear mempool rules, node operators would each implement their own policies, creating inconsistency and potentially enabling DoS attacks. The policy section was inspired by ERC-7562 but simplified.
- **Key innovations**:
  - **Validation prefix**: Only the frames up to `payer_approved = true` are subject to mempool rules. Post-payment frames are arbitrary.
  - **Canonical paymaster**: A standardized paymaster contract verified by runtime code match. Removes the entire reputation/staking system from ERC-7562.
  - **Non-canonical paymaster limit**: At most 1 pending tx per non-canonical paymaster
  - **Banned opcodes**: ORIGIN, GASPRICE, BLOCKHASH, COINBASE, TIMESTAMP, NUMBER, PREVRANDAO, GASLIMIT, BASEFEE, BLOBHASH, BLOBBASEFEE, GAS (with exceptions), CREATE, CREATE2 (with exceptions), INVALID, SELFDESTRUCT, BALANCE, SELFBALANCE, SSTORE, TLOAD, TSTORE
  - **MAX_VERIFY_GAS**: 100,000 gas cap for validation prefix
  - **Four recognized validation prefixes**: self-relay (basic & deploy), canonical paymaster (basic & deploy)
- **Notable review feedback**: jochem-brouwer provided detailed review of the canonical paymaster Solidity contract, catching PUSH0 optimization, stack order documentation, withdrawal overwrite handling, and chain ID checks.

From lightclient's PR description:

> One important change vs. 7562 is relying on a canonical paymaster contract. This point is open for discussion generally, but by having a canonical contract, we can remove the complex reputation system around the staking. It's also possible to add more functionality here over time.

---

## Default Code Update — March 26, 2026

*Why this mattered: kept the reference implementation in sync after approval bits changed how scope is encoded. Without this, every implementer would have had to reconcile an outdated default code against the latest approval-bit semantics on their own.*

### PR #11448: Update default code to match latest spec

**Author**: derekchiang | **Merged**: Mar 26

- **Why**: The approval bits addition meant the default code could be simplified: the scope is now read from the mode bits instead of being encoded separately.
- Updated the default code Python reference implementation to match all recent spec changes.

---

## Header Metadata Fix — April 8, 2026

*Why this mattered: a simple dependency-header fix that had been open for two months. The merge is notable mostly for how uncontroversial it was, and how long such a trivial change can sit waiting for author attention.*

### PR #11251: Add EIP-1559 to requires header

**Author**: BonyHanter83 | **Merged**: Apr 8 (opened Feb 4)

- **Why**: The spec uses EIP-1559's `max_priority_fee_per_gas` and `max_fee_per_gas` fields and explicitly states that `effective_gas_price` is calculated per EIP-1559, but the header didn't list it as a dependency.
- **Change**: Added `1559` to the `requires` header field alongside `2718` and `4844`.
- Approved by lightclient.
- This PR was open for over two months before being merged. It was a simple metadata fix that had no controversy.

---

## Broad Spec Tightening — April 14, 2026

*Why this mattered: the broadest single-PR restructuring since approval bits. Introduced a fifth opcode (`FRAMEPARAM`), hardened both default-code signature paths, reduced `MAX_FRAMES`, and locked deterministic deployment to EIP-7997. Consolidated several open threads into one coherent update.*

### PR #11521: Tighten spec

**Author**: benaadams (Ben Adams) | **Merged**: Apr 14

A 295-line spec-hardening PR consolidating several open threads. Changes:

- **Frame model**: Split the packed `mode` field into separate `mode` + `flags` fields. Added `FRAMEPARAM (0xb3)` opcode for frame introspection (renamed from `FRAMEINFO` at derekchiang's suggestion for consistency with `TXPARAM`). Introduced explicit `resolved_target` used consistently throughout execution.
- **APPROVE/VERIFY semantics**: Defined approval scopes as a bitmask with double-approval prevention. Aligned public-mempool prefixes. Made the VERIFY/STATICCALL carve-out explicit. Clarified that payment scopes collect `TXPARAM(0x06)`. Allowed third-party EOA paymasters in the default-code path.
- **Default code hardening**: Low-`s` enforcement for secp256k1. Reject failed `ecrecover`. Added P256 address-domain separation (`0x04` prefix before `qx|qy`). Require `P256VERIFY` to reject invalid public keys.
- **Limits and accounting**: Reduced `MAX_FRAMES` from `10^3` to `64`. Added `FRAME_TX_PER_FRAME_COST` (475 gas). Bounded frame gas totals. Clarified gas semantics for `FRAMEDATACOPY` and `TXPARAM`/blob access.
- **Deployment**: Locked deterministic deployment to EIP-7997. Made EIP-7702 interaction explicit. Added EIP-7997 to the `requires` header.
- **Security notes**: Stronger warnings around VERIFY-data malleability, `DELEGATECALL` + `APPROVE`, deploy-frame front-running, explicit-sender state-read amplification, and validation-time cross-frame data visibility.
- **Canonical paymaster**: Updated to use `TXPARAM(0x08)`. Documented that the current canonical implementation is single-signer secp256k1 only.

Key review discussion: fjl questioned lowering MAX_FRAMES from 1000 to 64, noting the high limit was intentional for native batching/bundling. benaadams responded that journaling carries across frames, creating up to 2000 effective call depth, and that it's easier to increase later after empirical measurement than to decrease. lightclient and derekchiang both approved.

This is the broadest restructuring since PR #11401 (approval bits) and the first PR to add a fifth opcode to the spec.

---

## Per-Frame Value — April 16, 2026

*Why this mattered: resolved the longest-running ergonomic ask. Wallets can now build a simple ETH transfer as one SENDER frame with `target = destination, value = amount`, instead of encoding an RLP call list inside default code. Ended the "frames are dumb message pipes" criticism from wallet developers.*

### PR #11534: Add value field to frame

**Author**: lightclient | **Merged**: Apr 16

Resolves the long-running community request for native ETH value transfer in frame transactions. Changes:

- **Frame model**: Extended the frame tuple from `[mode, flags, target, gas_limit, data]` to `[mode, flags, target, gas_limit, value, data]`. The `value` field is interpreted as the top-level call value in wei.
- **Validity rules**: Added `frame.value < 2**256` and `frame.mode == SENDER or frame.value == 0`. Non-zero `value` is only valid in `SENDER` frames; `DEFAULT` and `VERIFY` frames must set `value = 0`.
- **Execution semantics**: In the top-level frame call, `CALLVALUE = frame.value`. If the caller lacks sufficient balance to transfer `frame.value`, the frame reverts (ordinary CALL value-transfer semantics). `ENTRY_POINT` is now documented as observing `CALLVALUE = 0` for DEFAULT/VERIFY frames.
- **FRAMEPARAM extension**: Added `FRAMEPARAM(0x08, frameIndex)` returning the frame's `value`.
- **TXPARAM clarification**: `TXPARAM(0x06)` (max gas and blob fees) explicitly does not include any `frame.value` transfers.
- **Default code change**: In `SENDER` mode when `resolved_target != tx.sender`, the default code now returns successfully with empty data instead of reverting, because the top-level `frame.value` transfer has already been applied by the frame call. This matches the behavior of calling an empty-code account.
- **Signature hash coverage**: Documented that non-`VERIFY` frame metadata, including a `SENDER` frame's `value`, remains covered by the canonical signature hash.
- **Gas accounting**: Any `frame.value` transferred by a `SENDER` frame is separate from `tx_fee` and follows ordinary CALL value-transfer gas semantics.
- **Rationale**: Renamed the "No value in frame" rationale section to "Per-frame value" and explained that restricting non-zero `value` to `SENDER` frames keeps `VERIFY` and `DEFAULT` side-effect-free with respect to ETH transfers, preserves the `STATICCALL`-like behavior of `VERIFY`, and avoids requiring `ENTRY_POINT` to fund top-level ETH transfers.
- **Examples**: All transaction examples updated with a `Value` column. Example 1a (Simple ETH transfer) was restructured: instead of instructing the sender account to send ETH via payload decoding, the `SENDER` frame now sets `target = destination` and `value = amount` directly.

Key review discussion: lightclient's PR description notes the original resistance to a `value` field (preferring user-operation execution to be handled by the account) and the reversal now that frames are targeted at a good out-of-the-box experience without requiring wallet-side batching. Auto-merged after all reviewers approved; no debate on the merged PR.

Context: this resolves the "VALUE in SENDER frames" pending proposal that had accumulated support from rmeissner (Safe), DanielVF, frangio, 0xrcinus, derek, and matt across posts #124-134.

---

## Sighash Type Prefix — April 22, 2026

*Why this mattered: aligned EIP-8141's canonical sighash with the EIP-2718 typed-transaction convention, closing a cross-type signature replay vector.*

### PR #11544: Mix in transaction type to the sighash

**Author**: derekchiang | **Merged**: Apr 22

One-line change in `compute_sig_hash`:

- Replaced `keccak(rlp(tx_copy))` with `keccak(bytes([FRAME_TX_TYPE]) + rlp(tx_copy))`.
- Prefixes the type byte (`FRAME_TX_TYPE = 0x06`) before RLP-encoding, matching the EIP-2718 convention used by every other typed transaction type since EIP-1559.
- Without the prefix, a signature over a frame-transaction sighash could in theory be reused against another transaction type sharing the same RLP body.

All reviewers approved by Apr 18; auto-merged on Apr 22 with no further debate.

---

## Default Code Cleanup and Payer-Ordering Misadventure — April 28-29, 2026

*Why this mattered: with native frame batching and per-frame `value` both in the spec, lightclient pruned the now-redundant RLP call-batch decoding from the default account. In the same window, an alternative to derekchiang's guarantors PR (allow payer to approve before sender) was auto-merged in error and reverted within hours, then reopened as a draft. Net spec impact: only the RLP-batch removal landed.*

### PR #11577: Remove RLP call batch from default account

**Author**: lightclient | **Merged**: Apr 29

- **Why**: PR #11395 (Mar 25) introduced atomic batching at the frame-list level, and PR #11534 (Apr 16) added a per-frame `value` field. Together they cover the multi-call and ETH-transfer use cases that the default-code SENDER path was originally added to handle.
- **Change**: Default code's `SENDER` mode now simply reverts. The previous logic (which decoded `frame.data` as RLP `[[target, value, data], ...]` when `resolved_target == tx.sender`, and returned successfully with empty data when `resolved_target != tx.sender`) is removed. Net diff: +2/-15.
- Auto-merged after all reviewers approved; no review debate.

### PRs #11575 / #11579: Allow payer to approve before sender (merged in error, reverted same window)

**Author**: lightclient | **Merged-then-reverted**: Apr 28-29

- PR #11575 was an alternative to derekchiang's guarantors PR (#11555), proposed as a simpler relaxation: drop the rule that the sender must approve before the payer, so a payer can commit to gas without depending on sender-validation outcome. From lightclient's PR description: *"I think it is simpler to just allow the payer to approve before the sender instead of adding the full guarantor role."*
- The auto-merge bot fired on Apr 28 once reviewers approved. lightclient had intended the PR to remain a draft for further iteration, and opened PR #11579 the next day reverting the change with the note *"Meant to only create this as a draft."*
- The same content is now open as draft PR #11580. Net spec impact of #11575/#11579: zero. Listed here for traceability of the spec history; the live proposal sits in [Active/Open PRs](#active-open-prs) below.

---

## Active/Open PRs

*As of April 29, 2026.* These PRs represent active design proposals that may change the spec in the near future.

### PR #11272: Disable EIP-3607 check for frame transactions (open since Feb 6)

**Author**: Thegaram

- **Why**: EIP-3607 rejects transactions from senders with deployed code, which would block frame transactions for smart accounts.
- Still open. lightclient's earlier review was dismissed on Apr 8, and the PR remains unresolved.

### PR #11481: Add signatures list to outer tx (open since Apr 2)

**Author**: lightclient

- **Why**: Forward-compatibility with PQ signature aggregation. PQ signatures are large, and aggregating them will be critical.
- **Proposed change**: Add a new `signatures` field to the outer transaction object, containing signature objects with algorithm metadata, message, and signer. Signatures are verified before frame execution.
- **Significance**: This is the most structurally significant open proposal; it would change the transaction format itself. In the future, block-level aggregated witnesses could elide individual signatures.
- **All reviewers approved**, but derekchiang raised a practical concern (Apr 9): smart contracts leveraging outer signatures don't know which index their signature is at. The contract can't hardcode an index because the transaction may have any number of signatures in arbitrary order, so the default code has to loop through the entire list to find the relevant entry. This is an ergonomic and gas-efficiency weakness that needs addressing.

From lightclient's PR description:

> Any important goal of 8141 is to be forward compatible with signature aggregation techniques, especially with respect to PQ signatures. As those signatures are quite large, aggregating them may become very important as many users begin migrating.

### PR #11482: Allow using precompiles for VERIFY frames (open since Apr 2)

**Author**: derekchiang

- **Why**: Allow both EOAs and contract accounts to use precompiles for verification, enabling key rotation and shared verification logic.
- **Proposed change**: Designate "signature precompiles" that VERIFY frames can target natively. The precompile reads the public key commitment from storage.
- **All reviewers approved** (as of April 14), awaiting merge. May need rebasing after PR #11521 (Apr 14) and PR #11534 (Apr 16).

From derekchiang's PR description:

> This will allow a contract account to use precompiles for verification, while still having code that serves other purpose (e.g. for execution). As a side benefit, this also enables key rotation, since the precompile reads the public key commitment from storage.

### PR #11488: Fix spec inconsistencies (open since Apr 6)

**Author**: chiranjeev13

- **Proposed changes**:
  - Add static VERIFY frame count check (`<= 2`) to constraints, since `sender_approved` and `payer_approved` are one-shot flags
  - Fix stale APPROVE scope values in structural rules: `self_verify` → `APPROVE(0x3)`, `only_verify` → `APPROVE(0x2)`, `pay` → `APPROVE(0x1)`
  - Remove `frame.target != tx.sender` check from default VERIFY code to allow any EOA as paymaster
- Inspired by node.cm's observations on the EthMagicians thread (posts #135-136)
- Some of these fixes overlap with changes already merged in PR #11521
- No reviews yet from core authors

### PR #11537: Add EIP-8141 to CFI in EIP-8081 Hegotá meta EIP (open since Apr 17)

**Author**: dionysuzx

- **Why**: Adds EIP-8141 to the `Considered for Inclusion` list in the Hegotá fork meta EIP (EIP-8081), formalizing the CFI status that had been assumed based on strawmap and ACDE discussions.
- **Proposed change**: 3 lines in `EIPS/eip-8081.md` adding EIP-8141 under CFI, plus EIP-7716 and EIP-8205 under PFI.
- **Rationale links**: decisions captured at ACDE #233 timestamp 5871s ([forkcast](https://forkcast.org/calls/acde/233#t=5871)) and ACDC #177 timestamps 3532s and 3853s.
- Still needs one more reviewer from @ralexstokes or @timbeiko. This is a fork-inclusion governance milestone, not a spec change.

### PR #11555: Add support for guarantors (open since Apr 22)

**Author**: derekchiang

- **Why**: Provides a public-mempool path for transactions whose sender VERIFY logic reads shared state (ERC-20 balances, environmental opcodes), which otherwise violates the restrictive tier's `storage reads only on tx.sender` rule.
- **Proposed change**: Introduce a "guarantor" payer that pays for the transaction *even if sender validation fails*. When a guarantor is present, mempool nodes may skip sender-validation simulation entirely and propagate the transaction on the strength of the guarantor's signature alone.
- **Consequence**: a transaction with a guarantor can use any sender validation logic (including shared-state reads and environmental opcodes) and still propagate through the public mempool. This opens a third path for ERC-20 gas repayment alongside [live (offchain) and permissionless (onchain) paymasters](/mempool-strategy#erc20-paymaster-patterns).
- **Status**: Early proposal; Derek's description notes the authors are still iterating on the idea.

From derekchiang's PR description:

> The idea is to introduce the concept of a "guarantor," which is a payer that pays for the transaction *even if sender validation fails*. As long as a transaction has a guarantor, mempool nodes do not need to check if the sender validation succeeds, and can skip simulation for sender validation altogether. As a result, transactions with a guarantor can use any sender validation logic, including access to shared state, environmental opcodes, etc., and still safely pass through the public mempool.

### PR #11580: Allow payer to approve before sender (open as draft since Apr 29)

**Author**: lightclient

- **Why**: An alternative to derekchiang's guarantors PR (#11555). Instead of introducing a new "guarantor" role with its own approval semantics, lightclient proposes simply relaxing the ordering rule so a payer can call `APPROVE_PAYMENT` before the sender approves execution. A payer that commits to paying gas before sender validation runs absorbs the same economic risk a guarantor would, without a new role in the spec.
- **History**: same content was briefly auto-merged as #11575 on Apr 28 and reverted by #11579 on Apr 29 (lightclient intended it as a draft). Reopened as draft #11580 the same day.
- **Status**: draft; the choice between this and #11555 (guarantors) is the open question for the next sync.

From lightclient's PR description (carried over from #11575):

> Alternative to #11555. I think it is simpler to just allow the payer to approve before the sender instead of adding the full guarantor role.

### PR #11567: Relax mempool rules to not require a specific factory (open since Apr 24)

**Author**: derekchiang

- **Why**: The current spec hard-codes the [EIP-7997](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7997.md) deterministic factory predeploy as the only valid target for a `deploy` frame under mempool rules. This couples EIP-8141 to a specific factory contract and blocks senders who want cross-chain-stable addresses through alternative factories, custom CREATE2 deployers, or direct EIP-7702 delegation installation.
- **Proposed change**: Drop EIP-7997 from `requires`. Rewrite the mempool deploy-frame rule so that any contract may be `frame.target`, provided the frame's execution satisfies the validation trace rules. The write policy expands from "deterministic deployment through a known deployer" to "(a) `CREATE`, `CREATE2`, or `SETDELEGATE` operations that install code at `tx.sender`, or (b) `SSTORE`s to `tx.sender`'s storage." `CREATE` (0xF0) and `SETDELEGATE` (0xF6) join `CREATE2` (0xF5) in the list of opcodes allowed inside the first `deploy` frame. Resulting code may be either conventional contract code or an EIP-7702 delegation indicator.
- **Consequence**: EIP-7997 becomes the canonical but non-mandatory path. A factory is admissible as long as it is stateless in the validation-trace sense (no reads of mutable state outside `tx.sender`, no per-deploy factory storage such as counters or reentrancy flags). This unifies smart-account deployment and EIP-7702 delegation installation under the same deploy-frame primitive.
- **Status**: Draft as of Apr 24. No reviews yet.

---

## Rejected/Closed PRs

### PR #11404: Simplify approval bits (closed Mar 26)

**Author**: derekchiang

- Proposed an alternative approach to approval bit handling
- Superseded by the mode flags approach (PR #11401)
- Sparked useful discussion: 0xrcinus questioned whether bits were needed at all, Meyanis95 reviewed edge cases

### PR #11408: Migrate EOA default code to EIP-7932 registry (closed Mar 21)

**Author**: SirSpudlington

- Proposed using EIP-7932's signature registry for default code, citing P256 malleability fixes
- lightclient rejected: "We want to reserve the ability to define custom behavior in 8141 default contract and we don't want to rely on another EIP/precompile like this."

### PR #11455: Small tweaks to default code for EIP-7392 compatibility (closed Apr 23)

**Author**: SirSpudlington

- Spiritual successor to the closed PR #11408. No dependency introduced; just aligned default-code values with EIP-7392 for interoperability.
- Never gathered the required reviewer approvals from core authors. Closed without merge after ~4 weeks open.

### PRs #11310, #11314, #11321: Fix broken links (all closed)

**Author**: marukai67

- Three separate PRs attempting to fix allegedly broken links in the spec (to ERC-7562, EIP-2718, and other references)
- All rejected by lightclient with variants of "It's not broken" / "Not broken, thanks though"
- The links use relative paths that work in the EIPs rendering system but may look broken locally
