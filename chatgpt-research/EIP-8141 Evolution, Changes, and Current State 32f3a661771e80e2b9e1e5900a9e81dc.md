# EIP-8141: Evolution, Changes, and Current State

## Executive Summary

EIP-8141 began on January 29, 2026 as "Frame Transaction," introducing a new typed transaction (`0x06`) designed to make validation and gas payment programmable instead of being tied to a single signature scheme.

Its evolution reflects a shift from expressive abstraction toward deployability, compatibility, and mempool safety.

---

## 1. Original Design (January 2026)

The initial proposal introduced:

- Transaction structure:

```
[chain_id, nonce, sender, frames, max_priority_fee_per_gas, max_fee_per_gas, max_fee_per_blob_gas, blob_versioned_hashes]
frames = [[mode, target, gas_limit, data], ...]
```

- Execution modes:
    - `DEFAULT`
    - `VERIFY`
    - `SENDER`
- Key primitives:
    - `APPROVE`
    - Transaction introspection via `TXPARAMLOAD / TXPARAMSIZE / TXPARAMCOPY`

Design philosophy:

- Native account abstraction
- Removal of ECDSA dependency
- Protocol-level validation introspection

[1][2]

---

## 2. Feedback Evolution

### Conceptual Feedback

- Questions around multicall vs validation
- Need for bounded validation logic
- Clarification: frames enable protocol introspection

[2]

### Compatibility Feedback

- Proxy compatibility issues
- `APPROVE` too restrictive

[3]

### Correctness Feedback

- Fix `CALLER` vs `ADDRESS`
- Clarify revert behavior
- Debate on restricting `APPROVE`

[4]

### UX & Adoption Feedback

- Add EOA support
- Enable gas abstraction for all users

[5]

### Mempool Safety Feedback

- Need for structured validation prefix
- Avoid complexity of ERC-7562

[2][6]

---

## 3. Chronological Changes

### Jan 29, 2026

- Initial proposal merged
- Signature hash fix for `VERIFY`

[1][7]

### Feb 10, 2026

- Relaxed `APPROVE` requirement

[3]

### Feb 21 – Mar 2, 2026

- Fixed `APPROVE` semantics
- Removed restriction to `VERIFY` frames

[4]

### Mar 5 – Mar 10, 2026

- Added EOA default code

[5]

### Mar 11 – Mar 25, 2026

- Introduced atomic batching (via flags)

[8]

### Mar 12 – Mar 13, 2026

- Refactored introspection opcodes
- Added approval bits to `mode`

[9][10]

### Mar 13, 2026

- Proposed simplification of approval bits (not merged)

[11]

### Mar 16 – Mar 25, 2026

- Introduced mempool policy

[6]

### Mar 21, 2026

- Rejected migration to EIP-7932

[12]

### Mar 26, 2026

- Updated default code to align with approval bits

[13]

---

## 4. Key Differences vs Original Spec

### 1. Opcode Model

- From: `TXPARAMLOAD / SIZE / COPY`
- To: `TXPARAM`, `FRAMEDATALOAD`, `FRAMEDATACOPY`

[14]

### 2. Mode Expansion

- Added approval bits
- Added atomic batching flag

[14]

### 3. Approval Semantics

- New scope encoding
- Constrained via mode bits

[14]

### 4. Signature Hash

- Updated to handle mode flags correctly

[14]

### 5. EOA Support

- Default code for signature validation
- Supports secp256k1 and P-256

[14]

### 6. Mempool Policy

- Validation prefix rules
- Canonical paymaster model
- Revalidation rules

[14][6]

---

## 5. What EIP-8141 Does Today

### Core Model

- New transaction type: `0x06`
- Executes list of frames
- Tracks:
    - sender approval
    - payer approval

### Execution Modes

- `VERIFY`: validation logic
- `SENDER`: execution logic

### Capabilities

- Programmable validation
- Gas abstraction
- Sponsored transactions
- ERC-20 gas payments
- Atomic batching
- EOA compatibility

[14]

### Mempool Model

- Only specific validation prefixes allowed
- Canonical paymaster model
- Balance reservation
- Revalidation rules

[14][6]

---

## 6. Synthesis

EIP-8141 evolved along three main axes:

### 1. Expressiveness → Safety

- From flexible abstraction
- To structured validation

### 2. Smart Accounts → Universal

- Added EOA support

### 3. Execution → Network Constraints

- Dual model:
    - execution layer
    - mempool layer

[2][14]

---

## References

[1] [https://github.com/ethereum/EIPs/pull/11202](https://github.com/ethereum/EIPs/pull/11202)

[2] [https://ethereum-magicians.org/t/frame-transaction/27617](https://ethereum-magicians.org/t/frame-transaction/27617)

[3] [https://github.com/ethereum/EIPs/pull/11297](https://github.com/ethereum/EIPs/pull/11297)

[4] [https://github.com/ethereum/EIPs/pull/11344](https://github.com/ethereum/EIPs/pull/11344)

[5] [https://github.com/ethereum/EIPs/pull/11379](https://github.com/ethereum/EIPs/pull/11379)

[6] [https://github.com/ethereum/EIPs/pull/11415](https://github.com/ethereum/EIPs/pull/11415)

[7] [https://github.com/ethereum/EIPs/pull/11205](https://github.com/ethereum/EIPs/pull/11205)

[8] [https://github.com/ethereum/EIPs/pull/11395](https://github.com/ethereum/EIPs/pull/11395)

[9] [https://github.com/ethereum/EIPs/pull/11400](https://github.com/ethereum/EIPs/pull/11400)

[10] [https://github.com/ethereum/EIPs/pull/11401](https://github.com/ethereum/EIPs/pull/11401)

[11] [https://github.com/ethereum/EIPs/pull/11404](https://github.com/ethereum/EIPs/pull/11404)

[12] [https://github.com/ethereum/EIPs/pull/11408](https://github.com/ethereum/EIPs/pull/11408)

[13] [https://github.com/ethereum/EIPs/pull/11448](https://github.com/ethereum/EIPs/pull/11448)

[14] [https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8141.md](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8141.md)