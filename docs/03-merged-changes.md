# Changes Merged Over Time and Why

[< Back to Index](../README.md)

---

## Day 0 Fixes — January 29, 2026

### PR #11205: Add missing elision of VERIFY frame data from signature hash

**Author**: fjl | **Merged**: Jan 29

- Bug: the original spec did not elide `frame.data` of VERIFY frames when computing the canonical signature hash
- This was critical because VERIFY frames contain the signature itself — by definition it cannot be part of the signature hash
- Merged same day

### PR #11209: Fix status field number

**Author**: kevaundray | **Merged**: Jan 29

- The TXPARAM table had an incorrect field number for the `status` parameter
- Simple numbering fix, approved by fjl

---

## APPROVE Relaxation — February 10, 2026

### PR #11297: Relax requirement that APPROVE must be called by top level call frame

**Author**: lightclient | **Merged**: Feb 10

- **Why**: Existing smart accounts (especially proxy-based ones like Safe) can change their implementation code but NOT their outer proxy contract. The outer proxy uses `RETURN`, not `APPROVE`. Requiring top-level `APPROVE` made adoption impossible for these accounts.
- **Change**: `APPROVE` became transaction-scoped — it can be called from any depth and updates `sender_approved`/`payer_approved` directly, rather than requiring the top-level frame to exit with a special return code.

From lightclient's PR description:

> This allows existing smart accounts to more easily adopt EIP-8141. Before, the requirement was that accounts must exit the top level frame with APPROVE. Since APPROVE only exists with 8141, not smart accounts today support it. More importantly, smart accounts who are deployed with proxies _can_ change their smart account implementations, but still not the outer proxy which won't understand `APPROVE`.

---

## Bug Fixes & Clarifications — February-March 2026

### PR #11344: Fix some issues with EIP-8141

**Author**: derekchiang | **Merged**: Mar 2

- **Fixed CALLER vs ADDRESS**: Changed `CALLER == frame.target` to `ADDRESS == frame.target` for APPROVE. In VERIFY frames, CALLER is ENTRY_POINT, not frame.target — this was a bug introduced during refactoring.
- **Removed APPROVE restriction to VERIFY frames**: lightclient wanted APPROVE available in any mode for private pool use cases (stateful approvals).
- **Clarified frame reverts**: Made explicit that a frame revert discards that frame's state changes but doesn't affect other frames.
- Notable discussion: nlordell asked about the TXPARAM numbering jump from 0x09 to 0x10 — lightclient confirmed it was intentional to separate tx-level vs frame-level queries.

---

## EOA Support — March 5-10, 2026

### PR #11379: Add EOA support

**Author**: derekchiang | **Merged**: Mar 10

- **Why**: The biggest driver was adoption — if most users are on EOAs, frame transactions need to work for them natively, without requiring smart contract deployment.
- **What changed**: Added "default code" behavior for EOAs:
  - In VERIFY mode: reads `frame.data` as a signature, supports SECP256K1 (0x0) and P256 (0x1) types, calls `APPROVE(scope)`
  - In SENDER mode: reads `frame.data` as RLP-encoded calls `[[target, value, data], ...]` and executes them
  - In DEFAULT mode: reverts
- Also initially added a `value` field to frames (later removed — the default code handles value via call encoding)

---

## Opcode Redesign — March 12, 2026

### PR #11400: Clean up frame access opcodes

**Author**: fjl | **Merged**: Mar 12

- **Why**: Most TXPARAM values are 32 bytes or less, so `TXPARAMSIZE`/`TXPARAMCOPY` (designed for variable-length data) were unnecessary for most fields. The only variable-size data is frame input data.
- **Change**: Replaced `TXPARAMSIZE (0xb1)` and `TXPARAMCOPY (0xb2)` with dedicated `FRAMEDATALOAD (0xb1)` and `FRAMEDATACOPY (0xb2)`. Renamed `TXPARAMLOAD` to just `TXPARAM (0xb0)`.

From fjl's PR description:

> Most values returned by the TXPARAM opcode family is 32-bytes or less, so it makes no sense to be able to copy the data into memory. The only variable-size components of the transaction are the frame list and the input data of each frame. So I am defining specialized opcodes for reading the input data of the frame.

---

## Approval Bits — March 12-13, 2026

### PR #11401: Add approval bits to frame mode

**Author**: fjl | **Merged**: Mar 12

- **Why**: Users needed a way to specify their intended approval scope **in the signed transaction data** so that smart accounts don't have to extract scope from `frame.data` (which is elided from the signature hash). Without this, accounts would need to compute `keccak(sighash | scope)` — repetitive logic every account must implement.
- **Change**: Added bits 9-10 of `frame.mode` as approval scope constraints. These constrain which `APPROVE` scopes are valid for that frame.
- Also shifted APPROVE scope values from 0-indexed (0x0, 0x1, 0x2) to 1-indexed (0x1, 0x2, 0x3) so that the mode bits can directly encode the constraint.

From fjl's PR description:

> The primary motivation for adding these bits is allowing the user to specify to their own account what should be approved, while retaining the ability to sign directly over the sighash of the transaction. However, the concept of mode bits is going to be useful for other things we may have to put in later, and it also gives some security benefits.

### PR #11402: Fix bit indices

**Author**: fjl | **Merged**: Mar 13

- Changed from 0-indexed to 1-indexed bit numbering (bits 9 and 10 instead of 8 and 9), since bits are "typically one-indexed."

---

## Atomic Batching — March 11-25, 2026

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

### PR #11448: Update default code to match latest spec

**Author**: derekchiang | **Merged**: Mar 26

- **Why**: The approval bits addition meant the default code could be simplified — the scope is now read from the mode bits instead of being encoded separately.
- Updated the default code Python reference implementation to match all recent spec changes.

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

---

[< Previous: Feedback Evolution](./02-feedback-evolution.md) | [Next: Original vs Latest >](./04-original-vs-latest.md)
