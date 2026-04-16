# What Changed From Original to Latest

---

## Structural Comparison

| Aspect | Original (Jan 29) | Latest (Apr 14) |
|---|---|---|
| **Opcodes** | `APPROVE`, `TXPARAMLOAD`, `TXPARAMSIZE`, `TXPARAMCOPY` (4) | `APPROVE`, `TXPARAM`, `FRAMEDATALOAD`, `FRAMEDATACOPY`, `FRAMEPARAM` (5) |
| **APPROVE mechanism** | Return codes 0-4 at top-level frame | Transaction-scoped with scope operand (0x1, 0x2, 0x3), callable at any depth, double-approval prevention |
| **APPROVE scope** | 0x0 (execution), 0x1 (payment), 0x2 (both) | 0x1 (execution), 0x2 (payment), 0x3 (both) |
| **APPROVE restriction** | Must be top-level frame | `ADDRESS == frame.target` only |
| **Frame structure** | `[mode, target, gas_limit, data]` | `[mode, flags, target, gas_limit, data]` (mode/flags split) |
| **Mode field** | Just mode value (0, 1, 2) | Pure mode (0, 1, 2) with separate `flags` field |
| **Flags field** | N/A | Bits 0-1 = approval scope constraint; bit 2 = atomic batch flag |
| **Frame modes** | DEFAULT, VERIFY, SENDER | Same three modes |
| **Atomic batching** | Not supported | Bit 2 of flags, consecutive SENDER frames form batch |
| **MAX_FRAMES** | `10^3` (1,000) | `64` |
| **Per-frame cost** | None | `FRAME_TX_PER_FRAME_COST = 475` gas |
| **EOA support** | None | Full default code: ECDSA (low-`s` enforced) + P256 (domain-separated) verification, RLP-encoded call batching |
| **Signature hash** | VERIFY data NOT elided (bug) | VERIFY data properly elided; direct mode comparison (no masking needed after mode/flags split) |
| **Mempool policy** | Not defined (just "Security Considerations" section) | Comprehensive: validation prefixes, canonical paymaster, banned opcodes, MAX_VERIFY_GAS |
| **Requires header** | `2718, 4844` | `1559, 2718, 4844, 7997` |
| **Authors** | 7 co-authors | 8 co-authors (derekchiang added) |
| **Receipt** | Not specified in detail | Includes `payer` field and per-frame `[status, gas_used, logs]` |
| **SENDER frame requirements** | Could execute without prior approval | Requires `sender_approved == true` |
| **Value in frames** | Not in frame structure | Handled via default code call encoding, not as frame field |
| **VERIFY frame behavior** | State changes allowed | Behaves as `STATICCALL`, no state changes |
| **Target resolution** | Direct use of `frame.target` | Explicit `resolved_target` (null target resolves to `tx.sender`) |
| **Deterministic deployer** | Not specified | Locked to EIP-7997 |

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

Originally, approval status was determined by the return code of the top-level frame, similar to how `RETURN` works but with extended codes (2, 3, 4). This had several problems:
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

The original spec had no mechanism for atomic multi-call. The latest provides fine-grained control via the atomic batch flag in the `flags` field (originally bit 11 of the packed `mode`, now bit 2 of the separate `flags` after the mode/flags split), allowing users to specify exactly which SENDER frames must succeed together. This was a response to the universal expectation from developers that "if I'm batching operations, they should be atomic," while preserving the non-atomic default needed for paymaster patterns.

### 6. Mode/Flags Split and Signature Hash Simplification

The original spec simply checked `mode == VERIFY` to elide frame data from the signature hash. An intermediate version packed flags into the upper bits of mode, requiring `(frame.mode & 0xFF) == VERIFY` to mask them out. The latest spec (after PR #11521) splits mode and flags into separate fields, so the signature hash check is a direct `frame.mode == VERIFY` comparison again. The split also makes the frame structure more explicit: approval scope and atomic batch are clearly separate from the execution mode, reducing the risk of accidental interactions.

---

## Active Proposals That May Change the Comparison

As of April 16, 2026, several open PRs propose changes that would extend this comparison table:

| Proposal | PR | Impact |
|---|---|---|
| **Signatures list in outer tx** | [#11481](https://github.com/ethereum/EIPs/pull/11481) | Would add a `signatures` field to the transaction format, a new top-level field for PQ aggregation forward-compatibility |
| **Precompile-based VERIFY** | [#11482](https://github.com/ethereum/EIPs/pull/11482) | Would allow VERIFY frames to target signature precompiles directly, changing the verification model (all reviewers approved) |
| **VALUE in SENDER frames** | Under discussion (posts #124-134) | Strong consensus to add a `value` field to frames, no PR yet |
| **VERIFY frame count constraint** | [#11488](https://github.com/ethereum/EIPs/pull/11488) | Would add explicit `<= 2` VERIFY frame limit to static constraints (some overlap with merged #11521) |
| **Frame returndata opcodes** | Under discussion (post #137) | Proposed `FRAMERETURNDATASIZE`/`FRAMERETURNDATACOPY` to enable multi-step flows, no PR yet |

