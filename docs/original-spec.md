# The Original Spec (January 29, 2026)

---

## Why read this page

The spec that landed on Jan 29 is not the spec that exists today. Reading the original submission is useful for three reasons: it surfaces the core design bets the authors were willing to defend from day one, it makes the Mar-Apr course corrections easier to interpret when you know what they were correcting, and it shows what was *missing* (EOA support, mempool policy, atomic batching) so you can see why community pressure pushed the spec in the direction it did. Pair this page with [Original vs Latest](/original-vs-latest) to see the before-and-after side by side, or [Feedback Evolution](/feedback-evolution) to trace the path between them.

---

## Context & Motivation

EIP-8141 was submitted as PR [#11202](https://github.com/ethereum/EIPs/pull/11202) by Felix Lange (`@fjl`) on January 29, 2026. It was co-authored by Vitalik Buterin, lightclient, Felix Lange, Yoav Weiss, Alex Forshtat, Dror Tirosh, and Shahaf Nacson.

The EIP was born from a long history of account abstraction work on Ethereum. Previous attempts included:

- **EIP-2938** (2020): An earlier native AA proposal that failed due to lack of protocol-level introspection. It was too simple and made it hard to build safe mempool/p2p rules around arbitrary validation logic.
- **ERC-4337** (2021): A user-level AA system that worked without protocol changes but was "kludgy" when trying to integrate into clients like geth, required intermediaries (bundlers), and had adoption friction.
- **EIP-7702** (2024): Allowed EOAs to delegate to smart contracts, but saw limited initial adoption due to wallet fragmentation and the requirement for users to trust smart contract code.

The core motivation was twofold:
1. **Post-quantum readiness**: Provide a native off-ramp from ECDSA to arbitrary cryptographic systems (PQ-secure schemes).
2. **Native account abstraction**: Unlink accounts from a prescribed ECDSA key and support user-defined validation and gas payment, without intermediaries.

### Design Philosophy

A key design choice was visible from day one: **generic primitive over hard-coded use case**. Rather than defining a fixed set of supported signature schemes or transaction shapes, the authors chose to expose powerful primitives (frames, modes, APPROVE) and let users innovate on top. Matt (lightclient) articulated this in the Magicians thread (post #9):

> Frames are required to support introspection *by the protocol*. It's not about supporting multiple calls at the EVM layer. It's about allowing end users to flexibly define the way their transactions should be handled. The protocol can in turn, use the modes we're introducing to reason about the transaction and safely bound the resources needed to validate and propagate abstract transactions over p2p.

This philosophy directly descended from the EIP-2938 failure. That earlier proposal was *too* generic: it allowed arbitrary validation logic but gave the protocol no structured way to introspect it, making safe mempool relay impossible. EIP-8141's frames and modes were the answer: enough structure for the protocol to reason about, enough flexibility for users to define their own validation and payment logic. Matt explicitly linked the two (post #13):

> We have already attempted a simpler proposal than EIP-8141 when we proposed EIP-2938. It was simpler and allowed you very arbitrarily define the smart contract system to determine the validity, PAYGAS, and execute calls. But it failed due to the lack of protocol-level introspection. It was complicated to build a p2p tx pool ruleset around it. The frame transaction is a direct response to this.

## Original Technical Design

The original spec defined:

**Transaction type `0x06`** with payload:
```
[chain_id, nonce, sender, frames, max_priority_fee_per_gas, max_fee_per_gas, max_fee_per_blob_gas, blob_versioned_hashes]
frames = [[mode, target, gas_limit, data], ...]
```

**Constants:**
| Name | Value |
|---|---|
| `FRAME_TX_TYPE` | `0x06` |
| `FRAME_TX_INTRINSIC_COST` | `15000` |
| `ENTRY_POINT` | `address(0xaa)` |
| `MAX_FRAMES` | `10^3` |

**Four new opcodes:**
| Name | Value |
|---|---|
| `APPROVE` | `0xaa` |
| `TXPARAMLOAD` | `0xb0` |
| `TXPARAMSIZE` | `0xb1` |
| `TXPARAMCOPY` | `0xb2` |

**Three frame modes:**
| Mode | Name | Behavior |
|---|---|---|
| 0 | `DEFAULT` | Execute as regular call, caller = `ENTRY_POINT` |
| 1 | `VERIFY` | Validation frame, runs as `STATICCALL`, must call `APPROVE` |
| 2 | `SENDER` | Execute on behalf of sender, caller = `tx.sender` |

**APPROVE mechanism (original):**
- Used status codes 0-4: FAIL(0), SUCCESS(1), APPROVED_EXECUTION(2), APPROVED_PAYMENT(3), APPROVED_BOTH(4)
- The top-level frame return code determined approval status
- Scope was 0x0 (execution), 0x1 (payment), 0x2 (both)
- Had restriction: must be called in the top-level call frame

**What the original spec did NOT have:**
- No EOA support / default code
- No atomic batching
- No mempool policy / validation rules
- No approval bits in mode field
- No `FRAMEDATALOAD` / `FRAMEDATACOPY` opcodes
- No P256 signature support
- VERIFY frame data was NOT elided from signature hash (bug, fixed same day)

## Original Examples

The original spec included four examples:
1. **Simple Transaction**: VERIFY frame (signature check + APPROVE) → SENDER frame (execution)
2. **Simple ETH transfer**: VERIFY → SENDER targeting sender with destination/amount
3. **Account deployment**: DEFAULT (deploy via factory) → VERIFY → SENDER
4. **Sponsored tx (ERC-20 fees)**: VERIFY (sender) → VERIFY (sponsor) → SENDER (token transfer) → SENDER (user call) → DEFAULT (post-op)

