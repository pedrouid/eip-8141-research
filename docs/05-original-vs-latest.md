# What Changed From Original to Latest

---

## Structural Comparison

| Aspect | Original (Jan 29) | Latest (Apr 9) |
|---|---|---|
| **Opcodes** | `APPROVE`, `TXPARAMLOAD`, `TXPARAMSIZE`, `TXPARAMCOPY` | `APPROVE`, `TXPARAM`, `FRAMEDATALOAD`, `FRAMEDATACOPY` |
| **APPROVE mechanism** | Return codes 0-4 at top-level frame | Transaction-scoped with scope operand (0x1, 0x2, 0x3), callable at any depth |
| **APPROVE scope** | 0x0 (execution), 0x1 (payment), 0x2 (both) | 0x1 (execution), 0x2 (payment), 0x3 (both) |
| **APPROVE restriction** | Must be top-level frame | `ADDRESS == frame.target` only |
| **Mode field** | Just mode value (0, 1, 2) | Lower 8 bits = mode; bits 9-10 = approval scope constraint; bit 11 = atomic batch flag |
| **Frame modes** | DEFAULT, VERIFY, SENDER | Same three modes, plus mode flags |
| **Atomic batching** | Not supported | Bit 11 flag, consecutive SENDER frames form batch |
| **EOA support** | None | Full default code: ECDSA + P256 verification, RLP-encoded call batching |
| **Signature hash** | VERIFY data NOT elided (bug) | VERIFY data properly elided |
| **Mempool policy** | Not defined (just "Security Considerations" section) | Comprehensive: validation prefixes, canonical paymaster, banned opcodes, MAX_VERIFY_GAS |
| **Requires header** | `2718, 4844` | `1559, 2718, 4844` |
| **Authors** | 7 co-authors | 8 co-authors (derekchiang added) |
| **Receipt** | Not specified in detail | Includes `payer` field and per-frame `[status, gas_used, logs]` |
| **SENDER frame requirements** | Could execute without prior approval | Requires `sender_approved == true` |
| **Value in frames** | Not in frame structure | Handled via default code call encoding, not as frame field |
| **VERIFY frame behavior** | State changes allowed | Behaves as `STATICCALL`, no state changes |

## Key Philosophical Shifts

The overall trajectory: **from expressive abstraction toward deployability, compatibility, and mempool safety**. The early drafts prioritized flexibility; the later drafts constrain that flexibility into something the network can reason about.

### 1. From Smart-Account-Only to EOA-First

The original spec assumed users would have smart accounts. The latest spec makes EOAs first-class citizens with default code, recognizing that most users won't migrate to smart accounts immediately.

This was the single biggest change to the EIP's trajectory, driven by adoption concerns raised by DanielVF and derek's commercial AA experience showing that hardware wallets and most consumer wallets are slow/unwilling to adopt smart contract accounts.

### 2. From Minimal Mempool Guidance to Full Policy

The original spec had a brief "Security Considerations" section with general warnings about DoS vectors. The latest has a comprehensive mempool policy with:
- Specific structural rules (four recognized validation prefixes)
- Banned opcodes list
- Gas caps (MAX_VERIFY_GAS = 100,000)
- A canonical paymaster contract (removing ERC-7562's reputation/staking complexity)
- Non-canonical paymaster handling
- Explicit acceptance and revalidation algorithms

### 3. From Top-Level APPROVE to Transaction-Scoped APPROVE

Originally, approval status was determined by the return code of the top-level frame — similar to how `RETURN` works but with extended codes (2, 3, 4). This had several problems:
- Proxy-based accounts couldn't adopt it (proxy returns 0 or 1)
- APPROVE in nested calls required awkward propagation
- Return codes >1 from `CALL` broke backwards compatibility assumptions

Now APPROVE is a dedicated opcode that updates transaction-scoped variables (`sender_approved`, `payer_approved`) directly, from anywhere in the call stack. It's cleaner and more compatible with existing smart account patterns.

### 4. From Generic TXPARAM Opcodes to Specialized Data Access

The original `TXPARAMLOAD/SIZE/COPY` trio treated all transaction parameters uniformly. The redesign recognized that:
- Most parameters are scalar (32 bytes or less) → `TXPARAM` handles these
- Only frame data is variable-length → `FRAMEDATALOAD`/`FRAMEDATACOPY` handle this

This is more gas-efficient and easier to reason about.

### 5. From No Batching Control to Explicit Atomicity

The original spec had no mechanism for atomic multi-call. The latest provides fine-grained control via bit 11 of the mode field, allowing users to specify exactly which SENDER frames must succeed together. This was a response to the universal expectation from developers that "if I'm batching operations, they should be atomic" — while preserving the non-atomic default needed for paymaster patterns.

### 6. Signature Hash Now Handles Mode Flags

A subtle but important change: the original spec simply checked `mode == VERIFY` to decide whether to elide frame data from the signature hash. Now that `mode` carries upper-bit flags (approval scope, atomic batch), the signature hash function uses `(frame.mode & 0xFF) == VERIFY` — masking out the flags to check only the execution mode. Without this, adding flags to a VERIFY frame would change the signature hash, breaking the entire verification model. This is a small detail with large consequences.

---

## Active Proposals That May Change the Comparison

As of April 9, 2026, several open PRs propose changes that would extend this comparison table:

| Proposal | PR | Impact |
|---|---|---|
| **Signatures list in outer tx** | [#11481](https://github.com/ethereum/EIPs/pull/11481) | Would add a `signatures` field to the transaction format — a new top-level field for PQ aggregation forward-compatibility |
| **Precompile-based VERIFY** | [#11482](https://github.com/ethereum/EIPs/pull/11482) | Would allow VERIFY frames to target signature precompiles directly, changing the verification model |
| **VALUE in SENDER frames** | Under discussion (posts #124-134) | Strong consensus to add a `value` field to frames, no PR yet |
| **VERIFY frame count constraint** | [#11488](https://github.com/ethereum/EIPs/pull/11488) | Would add explicit `<= 2` VERIFY frame limit to static constraints |

