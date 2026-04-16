# What EIP-8141 Can Do Today and How It Works

---

## Core Concept

EIP-8141 introduces **Frame Transactions**, a new transaction type (`0x06`) where a transaction consists of multiple **frames**, each with a purpose (verify identity, execute calls, deploy contracts). The protocol uses frame modes to reason about what each frame does, enabling safe mempool relay and flexible user-defined validation.

A key insight for understanding the current spec: **EIP-8141 is two specs in one**.

- The **execution model** says "validation and payment are programmable": any account code can verify any signature scheme and approve any payer, with arbitrary logic.
- The **mempool model** says "that programmability is only publicly relayable when it fits a small set of validation-prefix shapes and state-dependency rules."

The execution model defines what is *possible*; the mempool model defines what is *propagatable*. A frame transaction that doesn't match the mempool rules is still valid on-chain; it just can't be gossiped through the public p2p network and must reach a block builder through private channels.

## Transaction Structure

```
[chain_id, nonce, sender, frames, max_priority_fee_per_gas, max_fee_per_gas, max_fee_per_blob_gas, blob_versioned_hashes]

frames = [[mode, flags, target, gas_limit, data], ...]
```

- `sender`: the 20-byte address of the account originating the transaction
- Each frame has a `mode` (lower 8 bits only), a `flags` field (approval scope + atomic batch), a `target` address (or null for sender), a gas limit, and arbitrary data
- Up to 64 frames per transaction

## Frame Modes

| Mode | Name | Behavior |
|---|---|---|
| 0 | `DEFAULT` | Called from `ENTRY_POINT`. Used for deployment or post-op tasks. |
| 1 | `VERIFY` | Read-only (STATICCALL semantics). Must call `APPROVE`. Used for authentication & payment authorization. |
| 2 | `SENDER` | Called from `tx.sender`. Requires prior `sender_approved`. Executes user's intended operations. |

**Flags (separate field, introduced by PR #11521):**
- Bits 0-1: Approval scope constraint (limits which `APPROVE` scope can be used)
- Bit 2: Atomic batch flag (groups consecutive SENDER frames into an all-or-nothing batch, SENDER only)

## The APPROVE Mechanism

`APPROVE` is the central innovation. It's an opcode that:
1. Terminates the current frame successfully (like `RETURN`)
2. Updates transaction-scoped approval variables

**Stack**: `[offset, length, scope]` (with double-approval prevention: once a scope bit is set, it cannot be set again)

**Scopes**:
- `0x1`: Approve payment — increments nonce, collects gas fees from the account, sets `payer_approved = true`
- `0x2`: Approve execution — sets `sender_approved = true` (only valid when `frame.target == tx.sender`)
- `0x3`: Approve both execution and payment

**Security**: Only `frame.target` can call `APPROVE` (`ADDRESS == frame.target` check). `sender_approved` must be true before `payer_approved` can be set.

## Execution Flow

For each frame transaction:

1. Check `tx.nonce == state[tx.sender].nonce`
2. Initialize `sender_approved = false`, `payer_approved = false`
3. For each frame, compute `resolved_target`: if `frame.target` is null, use `tx.sender`; otherwise use `frame.target`
4. Execute each frame sequentially:
   - **DEFAULT mode**: caller = `ENTRY_POINT`, execute as regular call to `resolved_target`
   - **VERIFY mode**: caller = `ENTRY_POINT`, execute as STATICCALL to `resolved_target`, must call `APPROVE` or entire tx is invalid
   - **SENDER mode**: requires `sender_approved == true`, caller = `tx.sender`, target = `resolved_target`
5. After all frames: verify `payer_approved == true`, refund unused gas to payer

## EOA Default Code

When `frame.target` has no code, the protocol applies built-in "default code" behavior:

**VERIFY mode:**
1. If `frame.target != tx.sender`, revert
2. Read the approval scope from the flags: `scope = frame.flags & 3`. If `scope == 0`, revert
3. Read first byte of `frame.data` as `signature_type`
4. If `0x0` (SECP256K1): verify ECDSA signature `(v, r, s)` against `compute_sig_hash(tx)`, enforce low-`s`, reject failed `ecrecover`
5. If `0x1` (P256): verify P256 signature `(r, s, qx, qy)`, check address = `keccak(0x04 | qx | qy)[12:]` (domain-separated), reject invalid public keys
6. Call `APPROVE(scope)`

**SENDER mode:**
1. Check `frame.target == tx.sender`
2. Decode `frame.data` as RLP `[[target, value, data], ...]`
3. Execute each call with `msg.sender = tx.sender`

**DEFAULT mode:** Reverts.

This means **any EOA can use frame transactions today**, no smart contract deployment needed.

## Atomic Batching

Consecutive SENDER frames with bit 2 of `flags` set form an atomic batch:

```
Frame 0: SENDER (atomic flag set)   ─┐
Frame 1: SENDER (flag not set)      ─┘ Batch 1
Frame 2: SENDER (atomic flag set)   ─┐
Frame 3: SENDER (atomic flag set)   ─│ Batch 2
Frame 4: SENDER (flag not set)      ─┘
```

If any frame in a batch reverts, the state is restored to before the batch started, and remaining frames in the batch are skipped. This enables safe patterns like "approve + swap" where both must succeed.

## Gas Accounting

```
tx_gas_limit = 15000 (intrinsic) + 475 * len(tx.frames) + calldata_cost(rlp(tx.frames)) + sum(frame.gas_limit)
```

Each frame incurs a per-frame cost of `FRAME_TX_PER_FRAME_COST` (475 gas) on top of the intrinsic cost. Each frame has its own gas allocation. Unused gas is **not** carried to subsequent frames. After all frames execute, the total unused gas is refunded to the payer.

The total fee is:
```
tx_fee = tx_gas_limit * effective_gas_price + blob_fees
```

## Canonical Signature Hash

```python
def compute_sig_hash(tx):
    for frame in tx.frames:
        if frame.mode == VERIFY:
            frame.data = Bytes()  # elide VERIFY data
    return keccak(rlp(tx))
```

Since `mode` and `flags` are now separate fields (PR #11521), the mode check is a direct comparison without masking.

VERIFY frame data is elided because:
1. It contains the signature (can't be part of what's signed)
2. Enables future signature aggregation: because VERIFY frames cannot change execution outcomes, a block builder could theoretically strip all VERIFY frames and append a succinct validity proof instead
3. Allows sponsor data to be added after sender signs (the sponsor's VERIFY frame target is still covered by the hash)

## Mempool Policy

The policy below is the **restrictive tier** of a [two-tier mempool architecture](/mempool-strategy). It is what clients ship first and what FOCIL nodes default to. An expansive tier (ERC-7562 / paymaster-extended) is intended to develop in parallel for use cases that exceed the restrictive policy (privacy protocols, multi-account paymasters).

The public mempool recognizes four validation prefixes:

**Self Relay:**
```
[self_verify]                    # basic
[deploy] → [self_verify]        # with account deployment
```

**Canonical Paymaster:**
```
[only_verify] → [pay]                    # basic
[deploy] → [only_verify] → [pay]        # with account deployment
```

Rules enforced during validation prefix:
- Must match one of the four prefixes above
- Sum of validation prefix gas <= 100,000
- Banned opcodes (ORIGIN, TIMESTAMP, BLOCKHASH, CREATE, etc.)
- No state writes (except deterministic deployment)
- No storage reads outside `tx.sender`
- No calls to non-existent contracts or EIP-7702 delegations

**Canonical paymaster**: verified by runtime code match, uses reserved balance accounting:
```python
available = balance(paymaster) - reserved_pending_cost - pending_withdrawal_amount
```

**Non-canonical paymaster**: limited to 1 pending tx per paymaster in the mempool.

## Practical Use Cases

### 1. Simple EOA Transaction (gas self-paid)

| Frame | Mode | Target | Data |
|---|---|---|---|
| 0 | VERIFY | sender | ECDSA signature |
| 1 | SENDER | target | call data |

Frame 0 verifies the signature and calls `APPROVE(0x3)`. Frame 1 executes.

### 2. Gas Sponsorship (ERC-20 fees)

| Frame | Mode | Target | Data |
|---|---|---|---|
| 0 | VERIFY | sender | Signature (approve execution) |
| 1 | VERIFY | sponsor | Sponsor data (approve payment) |
| 2 | SENDER | ERC-20 | transfer(sponsor, fees) |
| 3 | SENDER | target | User's call |
| 4 | DEFAULT | sponsor | Post-op (refund overcharge) |

### 3. Atomic Approve + Swap

| Frame | Mode | Atomic | Target | Data |
|---|---|---|---|---|
| 0 | VERIFY | - | sender | Signature |
| 1 | SENDER | set | ERC-20 | approve(DEX, amount) |
| 2 | SENDER | not set | DEX | swap(...) |

If the swap reverts, the ERC-20 approval is also reverted.

### 4. Account Deployment + First Transaction

| Frame | Mode | Target | Data |
|---|---|---|---|
| 0 | DEFAULT | deployer | initcode + salt |
| 1 | VERIFY | sender | Signature |
| 2 | SENDER | target | User's call |

### 5. EOA Paying Gas in ERC-20s

| Frame | Mode | Target | Data |
|---|---|---|---|
| 0 | VERIFY | sender | (0, v, r, s) — approve execution |
| 1 | VERIFY | sponsor | Sponsor signature — approve payment |
| 2 | SENDER | ERC-20 | transfer(sponsor, fees) |
| 3 | SENDER | target | User's call |

## Key Design Properties

- **No authorization list**: Unlike EIP-7702, doesn't rely on ECDSA for delegation. Compatible with PQ crypto.
- **No access list**: Future optimizations covered by block-level access lists (EIP-7928).
- **No value field in frames**: Account code handles value transfers, keeping frame structure minimal. (Note: strong community consensus to add `value` to SENDER frames; see Pending Proposals below.)
- **ORIGIN returns frame caller**: Changed from traditional tx.origin behavior (precedent set by EIP-7702).
- **Transient storage cleared between frames**: TSTORE/TLOAD state doesn't persist across frames.
- **Warm/cold state shared across frames**: Gas accounting for storage access is shared.
- **Requires**: EIP-1559, EIP-2718, EIP-4844, EIP-7997 (deterministic deployer).

## Relationship to Other Proposals

| Proposal | Relationship |
|---|---|
| ERC-4337 | 8141 is the native protocol successor, removing the bundler intermediary |
| EIP-7702 | Complementary; 7702 accounts can also use frame transactions. Note: 7702-delegated accounts cannot currently use default code signature verification (gap identified by DanielVF) |
| ERC-7562 | 8141's mempool rules are inspired by but simpler than 7562 (no staking/reputation) |
| EIP-8175 | Competing alternative: flat capabilities + programmable fee_auth, 4 new opcodes |
| EIP-8130 | Coinbase/Base's alternative: declared verifiers (no wallet code exec), 14 PRs, active development. See [Competing Standards](./competing-standards) |
| EIP-7997 | Deterministic deployer, used for account deployment frames |
| EIP-7392 | Signature registry; PR #11455 proposes making default code interoperable |

## Pending Proposals (as of April 16, 2026) {#pending-proposals}

Five significant proposals are under active discussion that would change the spec:

### 1. Signatures List in Outer Transaction (PR #11481)

lightclient proposes adding a `signatures` field to the outer transaction for PQ signature aggregation forward-compatibility. Signatures would be verified before frame execution, enabling future block-level aggregation that elides individual signatures. This would change the transaction format. All reviewers approved, but derekchiang raised an open concern (Apr 9): smart contracts can't know which index their signature is at in the list, forcing default code to loop through all entries, a gas and ergonomic weakness.

### 2. Precompile-Based VERIFY Frames (PR #11482)

derekchiang proposes allowing VERIFY frames to target designated "signature precompiles" directly. This enables contract accounts to use precompiles for verification (previously only available via EOA default code) and enables key rotation via storage-based public key commitments. All reviewers approved as of April 14, awaiting merge. Now that PR #11521 has been merged, this PR may need rebasing.

### 3. VALUE in SENDER Frames (Discussion, no PR yet)

Strong consensus from rmeissner (Safe), DanielVF, frangio, 0xrcinus, derek, and matt that SENDER frames should support native ETH value transfers. matt confirmed the authors support this now that atomic batching exists. The preferred approach is adding a `value` field to frames rather than using DELEGATECALL to a precompile.

### 4. Spec Consistency Fixes (PR #11488)

chiranjeev13 proposes: explicit VERIFY frame count check (`<= 2`), fixing stale APPROVE scope values in structural rules, and allowing any EOA as paymaster by removing the `frame.target != tx.sender` check from default VERIFY code. Some of these fixes overlap with changes already merged in PR #11521.

### 5. Frame Return Data Opcodes (Discussion, no PR yet)

jacopo-eth (post #137, Apr 10) proposed native access to frame returndata via `FRAMERETURNDATASIZE` and `FRAMERETURNDATACOPY` opcodes, motivated by ERC-8211-style multi-step flows where one frame consumes the output of another without wrapper contracts. No author response yet.

