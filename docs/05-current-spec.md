# What EIP-8141 Can Do Today and How It Works

[< Back to Index](../README.md)

---

## Core Concept

EIP-8141 introduces **Frame Transactions** — a new transaction type (`0x06`) where a transaction consists of multiple **frames**, each with a purpose (verify identity, execute calls, deploy contracts). The protocol uses frame modes to reason about what each frame does, enabling safe mempool relay and flexible user-defined validation.

A key insight for understanding the current spec: **EIP-8141 is two specs in one**.

- The **execution model** says "validation and payment are programmable" — any account code can verify any signature scheme and approve any payer, with arbitrary logic.
- The **mempool model** says "that programmability is only publicly relayable when it fits a small set of validation-prefix shapes and state-dependency rules."

The execution model defines what is *possible*; the mempool model defines what is *propagatable*. A frame transaction that doesn't match the mempool rules is still valid on-chain — it just can't be gossiped through the public p2p network and must reach a block builder through private channels.

## Transaction Structure

```
[chain_id, nonce, sender, frames, max_priority_fee_per_gas, max_fee_per_gas, max_fee_per_blob_gas, blob_versioned_hashes]

frames = [[mode, target, gas_limit, data], ...]
```

- `sender`: the 20-byte address of the account originating the transaction
- Each frame has a `mode` (with flags), a `target` address (or null for sender), a gas limit, and arbitrary data
- Up to 1,000 frames per transaction

## Frame Modes

| Mode (lower 8 bits) | Name | Behavior |
|---|---|---|
| 0 | `DEFAULT` | Called from `ENTRY_POINT`. Used for deployment or post-op tasks. |
| 1 | `VERIFY` | Read-only (STATICCALL semantics). Must call `APPROVE`. Used for authentication & payment authorization. |
| 2 | `SENDER` | Called from `tx.sender`. Requires prior `sender_approved`. Executes user's intended operations. |

**Mode flags (upper bits):**
- Bits 9-10: Approval scope constraint (limits which `APPROVE` scope can be used)
- Bit 11: Atomic batch flag (groups consecutive SENDER frames into an all-or-nothing batch)

## The APPROVE Mechanism

`APPROVE` is the central innovation. It's an opcode that:
1. Terminates the current frame successfully (like `RETURN`)
2. Updates transaction-scoped approval variables

**Stack**: `[offset, length, scope]`

**Scopes**:
- `0x1`: Approve execution — sets `sender_approved = true` (only valid when `frame.target == tx.sender`)
- `0x2`: Approve payment — increments nonce, collects gas fees from the account, sets `payer_approved = true`
- `0x3`: Approve both execution and payment

**Security**: Only `frame.target` can call `APPROVE` (`ADDRESS == frame.target` check). `sender_approved` must be true before `payer_approved` can be set.

## Execution Flow

For each frame transaction:

1. Check `tx.nonce == state[tx.sender].nonce`
2. Initialize `sender_approved = false`, `payer_approved = false`
3. Execute each frame sequentially:
   - **DEFAULT mode**: caller = `ENTRY_POINT`, execute as regular call
   - **VERIFY mode**: caller = `ENTRY_POINT`, execute as STATICCALL, must call `APPROVE` or entire tx is invalid
   - **SENDER mode**: requires `sender_approved == true`, caller = `tx.sender`
4. After all frames: verify `payer_approved == true`, refund unused gas to payer

## EOA Default Code

When `frame.target` has no code, the protocol applies built-in "default code" behavior:

**VERIFY mode:**
1. If `frame.target != tx.sender`, revert
2. Read the approval scope from the mode bits: `scope = (frame.mode >> 8) & 3`. If `scope == 0`, revert
3. Read first byte of `frame.data` as `signature_type`
4. If `0x0` (SECP256K1): verify ECDSA signature `(v, r, s)` against `compute_sig_hash(tx)`
5. If `0x1` (P256): verify P256 signature `(r, s, qx, qy)`, check address = `keccak(qx|qy)[12:]`
6. Call `APPROVE(scope)`

**SENDER mode:**
1. Check `frame.target == tx.sender`
2. Decode `frame.data` as RLP `[[target, value, data], ...]`
3. Execute each call with `msg.sender = tx.sender`

**DEFAULT mode:** Reverts.

This means **any EOA can use frame transactions today** — no smart contract deployment needed.

## Atomic Batching

Consecutive SENDER frames with bit 11 set form an atomic batch:

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
tx_gas_limit = 15000 (intrinsic) + calldata_cost(rlp(tx.frames)) + sum(frame.gas_limit)
```

Each frame has its own gas allocation. Unused gas is **not** carried to subsequent frames. After all frames execute, the total unused gas is refunded to the payer.

The total fee is:
```
tx_fee = tx_gas_limit * effective_gas_price + blob_fees
```

## Canonical Signature Hash

```python
def compute_sig_hash(tx):
    for frame in tx.frames:
        if (frame.mode & 0xFF) == VERIFY:
            frame.data = Bytes()  # elide VERIFY data
    return keccak(rlp(tx))
```

Note the `& 0xFF` mask: since `mode` now carries upper-bit flags (approval scope in bits 9-10, atomic batch in bit 11), the check must isolate the lower 8 bits to identify VERIFY frames regardless of their flag configuration.

VERIFY frame data is elided because:
1. It contains the signature (can't be part of what's signed)
2. Enables future signature aggregation — because VERIFY frames cannot change execution outcomes, a block builder could theoretically strip all VERIFY frames and append a succinct validity proof instead
3. Allows sponsor data to be added after sender signs (the sponsor's VERIFY frame target is still covered by the hash)

## Mempool Policy

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
- **No value field in frames**: Account code handles value transfers — keeps frame structure minimal.
- **ORIGIN returns frame caller**: Changed from traditional tx.origin behavior (precedent set by EIP-7702).
- **Transient storage cleared between frames**: TSTORE/TLOAD state doesn't persist across frames.
- **Warm/cold state shared across frames**: Gas accounting for storage access is shared.

## Relationship to Other Proposals

| Proposal | Relationship |
|---|---|
| ERC-4337 | 8141 is the native protocol successor — removes bundler intermediary |
| EIP-7702 | Complementary — 7702 accounts can also use frame transactions |
| ERC-7562 | 8141's mempool rules are inspired by but simpler than 7562 (no staking/reputation) |
| EIP-8175 | Competing simpler alternative — no new opcodes, no per-frame gas |
| EIP-8130 | Base's alternative — structured phases with verifiers, designed for performance |
| EIP-7997 | Deterministic deployer — used for account deployment frames |

---

[< Previous: Original vs Latest](./04-original-vs-latest.md) | [Next: Appendix >](./06-appendix.md)
