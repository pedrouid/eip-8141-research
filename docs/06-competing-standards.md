# Competing Standards

---

Three competing proposals take fundamentally different approaches to achieving account abstraction and signature agility on Ethereum. Understanding them is essential to evaluating EIP-8141's design tradeoffs and positioning.

---

## EIP-8130: Account Abstraction by Account Configuration

**Author**: Chris Hunter (@chunter-cb, Coinbase/Base)
**Status**: Draft | **Category**: Core (Standards Track)
**Created**: October 14, 2025
**Requires**: EIP-2718, EIP-7702

### Overview

EIP-8130 introduces a new EIP-2718 transaction type and an onchain Account Configuration system. Instead of allowing arbitrary EVM execution during validation (as EIP-8141 does), accounts register owners with onchain **verifier contracts**. Transactions declare which verifier to use, enabling nodes to filter transactions without executing wallet code. No EVM changes (no new opcodes) are required.

### Core Design

**Account Configuration Contract**: A system contract where accounts register owners. Each owner is identified by an `ownerId` (32-byte identifier derived by the verifier from public key material) and associated with a verifier contract and a scope byte (permission bitmask).

**Verifiers**: Contracts that implement `verify(hash, data)` via STATICCALL. The protocol routes by verifier address:
- `ECRECOVER_VERIFIER` (`address(1)`) — native secp256k1, no EVM execution needed
- Any other address — call the verifier contract
- Nodes maintain an **allowlist** of trusted verifiers with known gas bounds

**Implicit EOA Authorization**: Every existing EOA can send AA transactions immediately — no registration needed. If the `owner_config` slot is empty and `ownerId == bytes32(bytes20(account))`, it's implicitly authorized.

**Transaction Format**:
```
AA_TX_TYPE || rlp([
  chain_id, from, nonce_key, nonce_sequence, expiry,
  max_priority_fee_per_gas, max_fee_per_gas, gas_limit,
  account_changes, calls, payer,
  sender_auth, payer_auth
])
```

**Call Phases**: Calls are organized into phases. Within a phase, calls are atomic (all-or-nothing). Completed phases persist even if later phases revert. This enables patterns like `[[sponsor_payment], [user_action_a, user_action_b]]`.

**2D Nonce System**: `nonce_key` selects the channel, `nonce_sequence` is the sequence within it. `NONCE_KEY_MAX` enables nonce-free mode with expiry-only replay protection.

**Account Changes**: A single transaction can create an account (CREATE2), modify owner configuration, and set EIP-7702-style delegation — all before call execution.

**Gas Sponsorship**: `payer` field declares the sponsor, `payer_auth` authenticates them using the same verifier infrastructure. The payer is charged for all gas.

### Mempool Strategy

EIP-8130's key insight: **validation never executes wallet code**. Nodes verify by:
1. Reading `owner_config` (1 SLOAD)
2. Calling the declared verifier via STATICCALL (or using a native implementation)
3. Checking the returned `ownerId` against the stored config

Nodes maintain a verifier allowlist. For allowlisted verifiers with known gas bounds, no tracing infrastructure is needed. Unknown verifiers can be accepted with gas caps and opcode tracing, or rejected entirely.

**Account Lock**: When locked, the owner set is frozen. Nodes can cache owner state and apply higher mempool rate limits since only nonce consumption can invalidate transactions.

### Key Differences from EIP-8141

| Aspect | EIP-8130 | EIP-8141 |
|---|---|---|
| **Validation model** | Declarative: verifier address in tx → STATICCALL verifier | Programmable: arbitrary EVM in VERIFY frames |
| **New opcodes** | None | 4 (`APPROVE`, `TXPARAM`, `FRAMEDATALOAD`, `FRAMEDATACOPY`) |
| **Mempool safety** | Structural: verifier allowlist, no wallet code execution | Behavioral: banned opcodes, gas caps, validation prefix rules |
| **Signature schemes** | Deploy verifier contract, add to node allowlist | Write account code that calls `APPROVE` |
| **Extensibility** | Permissionless verifier deployment, but nodes must adopt | Fully arbitrary within frame architecture |
| **Gas sponsorship** | `payer` + `payer_auth` fields | VERIFY frame for sponsor |
| **Atomic batching** | Call phases (array of arrays) | Mode flag bit 11 on consecutive SENDER frames |
| **Account creation** | CREATE2 via `account_changes` | DEFAULT frame to deployer contract |
| **EOA support** | Implicit authorization, auto-delegation to default wallet | Default code (ECDSA + P256 verification) |
| **Owner management** | Onchain `owner_config` storage, portable config changes | Account code defines its own owner model |
| **Cross-chain** | Config changes with `chain_id = 0` replay across chains | Not addressed |
| **EIP-7702** | Delegation via `account_changes` entries | No authorization list (PQ incompatible) |
| **Async execution** | Compatible (no EVM in validation) | Incompatible with async models (requires EVM for inclusion) |

### Activity

- **14 PRs** (12 merged, 1 open, 1 closed) — active iteration from January through April 2026
- **9 EthMagicians posts** at [ethereum-magicians.org/t/eip-8130-account-abstraction-by-account-configurations/25952](https://ethereum-magicians.org/t/eip-8130-account-abstraction-by-account-configurations/25952)
- Key participants: chunter (author), rmeissner (Safe), Helkomine

### Strengths

- **Performance**: No EVM execution during validation. Nodes can implement verifier logic natively for maximum throughput.
- **Async execution compatible**: Validation doesn't require EVM execution, making it compatible with Monad and potential Ethereum async models (EIP-7886).
- **Portable configuration**: Owner config changes with `chain_id = 0` can replay across chains deterministically.
- **Incremental adoption**: Nodes adopt new signature schemes by updating their verifier allowlist, not by protocol upgrade.
- **No EVM changes**: No new opcodes means simpler client implementation and easier L2 adoption.

### Weaknesses

- **Limited validation expressiveness**: Verifiers are pure functions (`verify(hash, data) → ownerId`). Complex validation logic (e.g., time-based policies, state-dependent authorization) can't be expressed.
- **Node coordination**: Nodes must independently decide which verifiers to accept. A fragmented allowlist ecosystem could limit transaction propagation.
- **No value in calls**: Calls carry no ETH value — ETH transfers require going through wallet bytecode.
- **System contract dependency**: The Account Configuration Contract and Nonce Manager are new system-level infrastructure.

---

## EIP-8202: Scheme-Agile Transactions (Schemed Transactions)

**Authors**: Giulio Rebuffo (@Giulio2002), Ben Adams (@benaadams)
**Status**: Draft | **Category**: Core (Standards Track)
**Created**: March 22, 2026
**Requires**: EIP-1559, EIP-2718, EIP-2780, EIP-4844, EIP-7702, EIP-7976

### Overview

EIP-8202 introduces a new EIP-2718 transaction type (`0x05`) called `SchemedTransaction`. Instead of adding new top-level transaction types for every feature combination, it defines a single canonical envelope with one EIP-1559 fee header, one execution payload, and two typed attachment lists: **authorizations** (scheme-agile sender proofs) and **extensions** (flat typed protocol features like blobs and set-code).

The core thesis is the opposite of EIP-8141's frame model: **flat composition, not recursive composition**. One execution payload, many orthogonal capabilities, no new opcodes, no frame modes, no nested execution.

### Core Design

**Single Execution Payload**: Every transaction has exactly one `(to, value, data)` call/create. There are no frames, no multiple execution contexts, no mode flags.

**Authorization System**: The `authorizations` list contains typed `[role_id, scheme_id, witness]` tuples. Currently only `ROLE_SENDER` is defined. Each scheme registers a witness format, verification logic, address derivation, and gas surcharge. New signature schemes are added by registering a new `scheme_id` — no envelope changes needed.

**Two Initial Schemes**:

- `SCHEME_SECP256K1` (`0x00`): Standard ECDSA. Same address derivation as legacy Ethereum — existing EOAs can use the new tx format without address change.
- `SCHEME_EPHEMERAL_K1` (`0x01`): Quantum-safe one-time ECDSA keys. The user pre-generates 2^20 key pairs from a BIP-39 seed, commits to them via a Merkle tree, and embeds the root in the sender address. Each transaction uses key `i` at nonce `i` with a Merkle proof. After use, a quantum attacker recovering `sk_i` can't forge the next transaction because that requires inverting `keccak256(pk_{i+1})` — a Keccak-256 preimage attack (128-bit security against Grover's).

**Extension System**: The `extensions` list contains typed `[extension_id, extension_payload]` entries, unique by ID. Two initial extensions:

- `EXT_BLOB` (`0x01`): Carries EIP-4844 blob fields (`max_fee_per_blob_gas`, `blob_versioned_hashes`)
- `EXT_SET_CODE` (`0x02`): Carries EIP-7702 set-code authorizations, but with `(scheme_id, witness)` replacing `(y_parity, r, s)` — making delegation itself scheme-agile

**Transaction Envelope**:
```
0x05 || rlp([
    chain_id, nonce,
    max_priority_fee_per_gas, max_fee_per_gas, gas_limit,
    to, value, data,
    authorizations, extensions
])
```

**No Access List**: Deliberately omitted — transaction-level access lists are being deprecated (EIP-7928 block-level, EIP-7981 cost increase).

**Composability Without New Types**:
- Plain secp256k1 tx = base + sender auth(k1)
- Quantum-safe tx = base + sender auth(ephemeral k1)
- Blob tx = base + sender auth(...) + blob extension
- Set-code tx = base + sender auth(...) + set-code extension
- All three combined = base + sender auth(ephemeral k1) + blob ext + set-code ext

### Mempool Strategy

EIP-8202's mempool model is close to today's transaction processing:

- **secp256k1**: Identical to current — ecrecover the sender, check nonce and balance. No EVM execution.
- **Ephemeral secp256k1**: ecrecover + Merkle proof verification (20 Keccak-256 hashes). No EVM execution, no contract calls. Deterministic cost.

Because there are no frames and no arbitrary EVM validation, the mempool doesn't need banned opcode lists, validation gas caps, or prefix simulation. Validation is purely cryptographic.

The spec explicitly notes: "This EIP allows multiple orthogonal capabilities, but only one execution payload. It intentionally forbids recursive transaction composition. That avoids drifting into frame-transaction validation complexity."

### Key Differences from EIP-8141

| Aspect | EIP-8202 | EIP-8141 |
|---|---|---|
| **Composition model** | Flat: one execution payload + typed extensions | Recursive: multiple frames with modes |
| **New opcodes** | None | 4 (`APPROVE`, `TXPARAM`, `FRAMEDATALOAD`, `FRAMEDATACOPY`) |
| **Tx type** | `0x05` | `0x06` |
| **Signature agility** | `scheme_id` in authorization — scheme as a capability | Account code calls `APPROVE` — scheme as EVM logic |
| **PQ strategy** | Ephemeral secp256k1 (Merkle-committed one-time keys) | Arbitrary sig schemes in VERIFY frames |
| **Validation model** | Cryptographic only — no EVM during validation | Programmable EVM in VERIFY frames |
| **Mempool complexity** | Minimal: ecrecover + Merkle proof, deterministic cost | High: validation prefix, banned opcodes, gas caps |
| **Atomic batching** | Not supported (single execution payload) | Mode flag bit 11 on consecutive SENDER frames |
| **Gas sponsorship** | `ROLE_PAYER` reserved but not yet defined | VERIFY frame for sponsor, canonical paymaster |
| **EIP-7702 integration** | `EXT_SET_CODE` extension (scheme-agile delegations) | No authorization list (PQ incompatible) |
| **EIP-4844 integration** | `EXT_BLOB` extension | Not addressed |
| **Extensibility** | New `scheme_id` or `extension_id` per EIP | Arbitrary within frame architecture |
| **Async execution** | Compatible (no EVM in validation) | Incompatible with async models |
| **Account creation** | Not addressed | DEFAULT frame to deployer contract |
| **Future frame support** | Explicitly noted as possible extension | Native |

### Activity

- **1 PR** ([ethereum/EIPs#11438](https://github.com/ethereum/EIPs/pull/11438)) — opened by Giulio2002, currently open
- **6 EthMagicians posts** at [ethereum-magicians.org/t/eip-8202-schemed-transaction/28044](https://ethereum-magicians.org/t/eip-8202-schemed-transaction/28044)
- Key participants: Giulio2002 (author), SirSpudlington (raised duplication concerns with EIP-7932/8197), bbjubjub (noted EIP-7702 interop gap for new EOAs), shemnon (EIP-8197 author, argued EIP-8202 lacks flexible tx bodies and signature substitution protection)

### Strengths

- **Stops type proliferation**: One envelope that composes features instead of minting new tx types for every combination. Blobs + set-code + new sig scheme = same type `0x05`.
- **Immediately deployable PQ path**: Ephemeral secp256k1 uses only existing ECDSA infrastructure and Keccak-256. No new crypto primitives, no contract deployment, no on-chain registration.
- **Minimal mempool disruption**: Validation is purely cryptographic — deterministic cost, no EVM execution, no banned opcode lists. Compatible with async execution models.
- **Clean EIP-7702 upgrade**: Set-code authorizations become scheme-agile, so delegations can use non-ECDSA schemes.
- **No EVM changes**: No new opcodes, no changes to the execution environment.
- **Backward-compatible secp256k1**: Existing EOAs keep their address when switching to the new tx format.

### Weaknesses

- **No atomic batching**: Single execution payload means no multi-call atomicity at the protocol level. Users needing batch operations must go through smart contract wrappers (multicall).
- **No programmable validation**: Validation is a fixed cryptographic check, not arbitrary EVM logic. Complex policies (time-based, state-dependent, social recovery) can't be expressed at the tx level.
- **No gas sponsorship yet**: `ROLE_PAYER` is reserved but undefined. No paymaster mechanism in the current spec.
- **Ephemeral key UX**: Users get a new address when migrating from secp256k1 to ephemeral secp256k1 (Merkle root changes the derivation). Assets must be explicitly transferred.
- **Ephemeral key exhaustion**: 2^20 (~1M) transactions per account. After exhaustion, must migrate to a new address.
- **Overlap concerns**: Community feedback notes significant functional overlap with EIP-7932 (crypto agility registry) and EIP-8197 (CATX). Risk of fragmentation across multiple scheme-agility proposals.
- **Early stage**: 6 discussion posts, no merged PRs, no community consensus yet.

---

## EIP-XXXX: Tempo-like Transactions

**Author**: Georgios Konstantopoulos (@gakonst, Paradigm/Reth)
**Status**: Pre-draft (gist) | **Category**: Core (Standards Track)
**Requires**: EIP-1559, EIP-2718, EIP-2930, EIP-7702, EIP-2, EIP-2929

### Overview

This proposal introduces a new EIP-2718 transaction type (`0x76`) that bundles a **constrained set of wallet UX primitives** into a single transaction format: atomic batching, validity windows, gas sponsorship, parallelizable nonces, passkey signatures (P-256 and WebAuthn), and protocol-enforced access keys.

The philosophy is explicit: **constrained scope over general framework**. The spec deliberately does not attempt to replace ERC-4337, provide arbitrary validation logic, or introduce new opcodes. Instead, it standardizes the specific features that most wallets need today — batching, sponsorship, passkeys, scheduled execution — at the protocol level where they can be statically reasoned about.

### Core Design

**Atomic Call Batching**: The `calls` field is a list of `[to, value, input]` tuples executed sequentially. If any call reverts, the entire transaction reverts. Unlike EIP-8141's frame architecture, there's no concept of modes or frame-level gas isolation — it's a flat list of calls, all-or-nothing.

**Validity Windows**: `valid_after` and `valid_before` fields provide time-bounded execution. A transaction is valid only when `block.timestamp` falls within the window. This enables scheduled transactions and automatic expiry without off-chain infrastructure.

**Gas Sponsorship**: An optional `fee_payer_signature` field. If present, the recovered fee payer address pays all gas. The fee payer signs a domain-separated hash (`0x78` prefix) covering the full transaction including the sender's address. Fee payer signatures must be secp256k1. The spec explicitly does not define ERC-20 fee payment — sponsors wanting token reimbursement must only co-sign transactions that include explicit compensating calls.

**2D Nonces**: `nonce_key` selects a nonce stream, `nonce` is the sequence within it. `nonce_key == 0` uses the standard protocol nonce. `nonce_key > 0` uses independent parallel streams. This enables concurrent pending transactions without blocking.

**Multiple Signature Schemes**: The `sender_signature` field supports four encodings, detected by length/prefix:

| Scheme | Detection | Notes |
|---|---|---|
| secp256k1 | 65 bytes exactly | Standard ECDSA, 0 extra gas |
| P-256 | First byte `0x01`, 130 bytes | Optional SHA-256 pre-hash, +5,000 gas |
| WebAuthn | First byte `0x02`, variable (max 2,049 bytes) | Full passkey flow with authenticatorData + clientDataJSON, +5,000 gas |
| Keychain wrapper | First byte `0x03` | Wraps inner signature with `user_address` for access key delegation |

**Address Derivation**: For P-256/WebAuthn, the signer address is `keccak256(pub_key_x || pub_key_y)[12:]` — new addresses, not existing EOAs.

**EIP-7702 Interop**: An optional `authorization_list` field processed with standard EIP-7702 semantics. Authorizations are not reverted if call execution reverts (matching 7702 behavior).

**Access Keys**: Deferred to a companion EIP. The Keychain wrapper signature scheme provides the hook — an access key signs on behalf of a root account, validated against protocol-enforced rules (expiry, spending limits).

**Transaction Envelope**:
```
0x76 || rlp([
    chain_id,
    max_priority_fee_per_gas, max_fee_per_gas, gas_limit,
    calls, access_list,
    nonce_key, nonce,
    valid_before, valid_after,
    fee_payer_signature,
    authorization_list,
    sender_signature
])
```

**Per-Call Receipts**: Each call gets its own receipt entry with `success`, `gas_used`, and `logs`, enabling applications to identify which call in a batch failed.

### Mempool Strategy

Validation is purely cryptographic — no EVM execution during signature verification. The mempool requirements are well-specified:

- Reject malformed signatures, expired transactions, and insufficient balances
- Defer future-valid transactions (`valid_after` in the future)
- Maintain per-root readiness across nonce streams independently
- RBF rules apply per `(root, nonce_key, nonce)` tuple
- Re-check fee payer balance on new head
- Apply anti-DoS policy for transactions with `authorization_list` (cross-account invalidation risk)

The bounded signature sizes (`MAX_WEBAUTHN_SIG_SIZE = 2,049 bytes`) and deterministic verification costs mean nodes can reason about validation cost statically.

### Key Differences from EIP-8141

| Aspect | EIP-XXXX (Tempo-like) | EIP-8141 |
|---|---|---|
| **Philosophy** | Constrained primitives for common UX needs | General-purpose programmable framework |
| **New opcodes** | None | 4 (`APPROVE`, `TXPARAM`, `FRAMEDATALOAD`, `FRAMEDATACOPY`) |
| **Tx type** | `0x76` | `0x06` |
| **Composition model** | Flat call list, all-or-nothing | Recursive frames with modes and per-frame gas |
| **Signature schemes** | Fixed set: secp256k1, P-256, WebAuthn | Arbitrary via account code + `APPROVE` |
| **Validation model** | Cryptographic only — fixed scheme detection | Programmable EVM in VERIFY frames |
| **Atomic batching** | Native: `calls` list, entire tx reverts on failure | Mode flag bit 11 on consecutive SENDER frames |
| **Gas sponsorship** | `fee_payer_signature` field (secp256k1 only) | VERIFY frame for sponsor, canonical paymaster |
| **Validity windows** | Native: `valid_after` / `valid_before` | Not addressed |
| **2D nonces** | Native: `nonce_key` + `nonce` | Not addressed (single nonce) |
| **Passkeys/WebAuthn** | Native at transaction layer | Account code must implement |
| **Access keys** | Keychain wrapper + companion EIP | Not addressed |
| **EIP-7702 interop** | `authorization_list` field | No authorization list (PQ incompatible) |
| **Per-call receipts** | Native: each call gets `success`, `gas_used`, `logs` | Single receipt for entire tx |
| **Mempool complexity** | Low: deterministic crypto verification, bounded sizes | High: validation prefix, banned opcodes, gas caps |
| **PQ readiness** | Not addressed — P-256/WebAuthn are not PQ-safe | Native: arbitrary sig schemes in VERIFY frames |
| **Programmable validation** | No — fixed scheme set | Yes — arbitrary EVM logic |
| **Async execution** | Compatible (no EVM in validation) | Incompatible with async models |
| **Account creation** | Not addressed | DEFAULT frame to deployer contract |
| **EOA default behavior** | Requires 7702 for non-secp256k1 EOAs | Protocol-native default code for codeless accounts |

### Activity

- **Pre-draft gist** by gakonst (Georgios Konstantopoulos, Paradigm/Reth)
- No EIP number assigned, no PR to ethereum/EIPs, no EthMagicians thread yet
- Very early stage — published as a design exploration

### Strengths

- **Immediate UX wins**: Batching, sponsorship, passkeys, validity windows, and 2D nonces — the features wallets actually need today — in a single tx type. No smart contract wrappers or off-chain infrastructure.
- **Passkeys at L1**: P-256 and WebAuthn signatures are first-class at the transaction layer. Users can sign with biometrics directly, without bundlers or relayers.
- **Simple mempool**: No EVM during validation, bounded signature sizes, deterministic verification costs. Compatible with async execution models.
- **Per-call receipts**: Applications can pinpoint which call in a batch failed — better debugging and UX than all-or-nothing with no granularity.
- **No EVM changes**: No new opcodes, no changes to the execution environment. Simpler client implementation.
- **EIP-7702 compatibility**: Existing 7702 delegation works within the new tx format.
- **Validity windows**: Scheduled and expiring transactions natively — useful for limit orders, time-locked operations, and stale transaction cleanup.

### Weaknesses

- **No programmable validation**: The signature scheme set is fixed at the protocol level. Adding a new scheme requires a hard fork. Complex validation policies (multisig, social recovery, state-dependent rules) can't be expressed.
- **No PQ strategy**: P-256 and WebAuthn are both vulnerable to quantum computers. No ephemeral key scheme or arbitrary-scheme extensibility. The spec would need future hard forks to add PQ-safe schemes.
- **Fee payer limited to secp256k1**: Sponsors must use ECDSA — can't sponsor with passkeys or other schemes.
- **No per-call gas isolation**: All calls share a single gas limit. One expensive call can starve subsequent calls. No per-frame gas budgeting like EIP-8141.
- **P-256/WebAuthn create new addresses**: Address derivation from P-256 keys produces new addresses, not existing EOA addresses. Users need to migrate assets or use 7702 delegation.
- **Access keys deferred**: The Keychain wrapper is defined but the actual access key rules (expiry, spending limits, revocation) are punted to a companion EIP.
- **Pre-draft stage**: Published as a gist only. No EIP number, no community review, no iteration yet.

---

## Comparative Analysis

### The Fundamental Tradeoff: Generality vs. Deployability

The four proposals sit on a spectrum:

```
More General                                                            More Constrained
    |                                                                         |
 EIP-8141          EIP-8130          EIP-8202                          EIP-XXXX
 (arbitrary EVM    (declared         (flat extensions,                  (fixed UX
  validation,       verifiers,        scheme-agile auth,                primitives,
  frame execution)  no wallet code)   single execution)                 passkeys)
```

**EIP-8141** gives maximum flexibility — any account code can define any validation logic, multiple execution frames per transaction, atomic batching. The cost is mempool complexity (banned opcodes, gas caps, validation prefixes) and async execution incompatibility.

**EIP-8130** trades some flexibility for predictable validation — verifiers are pure functions, nodes know the computational cost upfront. The cost is that complex validation logic can't be expressed at the protocol level.

**EIP-8202** takes a different angle entirely — it doesn't try to be an AA system. Instead, it solves signature agility and feature composition at the transaction envelope level. One execution payload, flat typed extensions, no new opcodes. The cost is no batching, no programmable validation, and no gas sponsorship (yet).

**EIP-XXXX (Tempo-like)** takes the most constrained approach of the four — it bundles the specific UX features wallets need today (batching, sponsorship, passkeys, validity windows, 2D nonces) into a single tx type with no new opcodes and no programmable validation. The cost is a fixed feature set that requires hard forks to extend, and no PQ strategy.

### PQ Readiness

| Proposal | PQ Strategy |
|---|---|
| **EIP-8141** | Native: write account code with any sig scheme. Signature aggregation designed in (VERIFY frame elision, signatures list proposal PR #11481). Most complete PQ path. |
| **EIP-8130** | Deploy PQ verifier contract, nodes add to allowlist. Good path but requires node coordination for adoption. |
| **EIP-8202** | Ephemeral secp256k1: one-time ECDSA keys with Merkle-committed rotation. Immediately deployable, no new crypto primitives — relies on Keccak-256 preimage resistance. Future PQ schemes added as new `scheme_id` values. Lightest-weight migration but users get a new address. |
| **EIP-XXXX** | Not addressed. Supports secp256k1, P-256, and WebAuthn — all quantum-vulnerable. Adding PQ schemes requires a hard fork to define a new signature encoding. |

### Mempool & Performance

| Proposal | Validation Cost | Mempool Complexity | Async Compatible |
|---|---|---|---|
| **EIP-8141** | EVM execution (capped at 100k gas) | High: validation prefix, banned opcodes, canonical paymaster | No |
| **EIP-8130** | STATICCALL to verifier (or native impl) | Medium: verifier allowlist, account lock optimization | Yes |
| **EIP-8202** | ecrecover + Merkle proof (deterministic) | Low: purely cryptographic, no EVM | Yes |
| **EIP-XXXX** | ecrecover / P-256 / WebAuthn (bounded) | Low: deterministic crypto, bounded sig sizes | Yes |

### What EIP-8130's Author Says About EIP-8141

From the Biconomy blog analysis:
> "Base's position: 'We can heavily optimize this and build out performant mempool/block builder implementations' — something they can't do with EIP-8141's arbitrary validation frames."

The core disagreement: EIP-8130 advocates say EIP-8141's arbitrary EVM validation creates DoS vulnerabilities. EIP-8141 supporters counter that EIP-8130 can be built atop EIP-8141 (verifiers are a subset of what VERIFY frames can do) but not vice versa.

### What EIP-8202's Authors Say About EIP-8141

From the spec's motivation:
> "This EIP is intentionally not a frame transaction system. It does not introduce recursive transactions, multiple execution payloads, new execution modes, or new opcodes."

And from the security considerations:
> "This EIP [...] intentionally forbids recursive transaction composition. That avoids drifting into frame-transaction validation complexity, where mempool validation may require richer execution-aware processing before inclusion."

However, EIP-8202 explicitly acknowledges EIP-8141 as a potential extension:
> "An EIP-8141-style frame extension could attach nested execution frames to the same transaction envelope without requiring a new top-level transaction type."

The positioning is complementary-but-skeptical: EIP-8202 solves the envelope and signature agility problem first, and frames could be layered on top later as an extension — but the authors are clearly concerned about the mempool complexity that frame execution introduces.

### Adoption Positioning

| Proposal | Who Benefits Most | Adoption Path |
|---|---|---|
| **EIP-8141** | Protocol developers, L1 infrastructure, advanced smart accounts | Hard fork required. Comprehensive but long timeline. |
| **EIP-8130** | L2s (especially Base/Coinbase), wallets wanting simple AA | Hard fork required, but simpler client changes. No EVM modifications. |
| **EIP-8202** | EOAs wanting PQ safety, protocol designers tired of tx type proliferation | Hard fork required. Minimal client changes (no EVM mods), but competes with EIP-7932/8197 for the same design space. |
| **EIP-XXXX** | Wallets wanting batching + passkeys + sponsorship without smart contract complexity | Hard fork required. No EVM changes. Targets immediate UX improvement, not long-term extensibility. |

