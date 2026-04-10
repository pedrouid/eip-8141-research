# Competing Standards

---

Two competing proposals take fundamentally different approaches to achieving account abstraction and signature agility on Ethereum. Understanding them is essential to evaluating EIP-8141's design tradeoffs and positioning.

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

## Comparative Analysis

### The Fundamental Tradeoff: Generality vs. Deployability

The three proposals sit on a spectrum:

```
More General                                              More Deployable
    |                                                           |
 EIP-8141            EIP-8130                            EIP-8202
 (arbitrary EVM      (declared verifiers,                (flat extensions,
  validation,         no wallet code exec)                scheme-agile auth,
  frame execution)                                        single execution)
```

**EIP-8141** gives maximum flexibility — any account code can define any validation logic, multiple execution frames per transaction, atomic batching. The cost is mempool complexity (banned opcodes, gas caps, validation prefixes) and async execution incompatibility.

**EIP-8130** trades some flexibility for predictable validation — verifiers are pure functions, nodes know the computational cost upfront. The cost is that complex validation logic can't be expressed at the protocol level.

**EIP-8202** takes a different angle entirely — it doesn't try to be an AA system. Instead, it solves signature agility and feature composition at the transaction envelope level. One execution payload, flat typed extensions, no new opcodes. The cost is no batching, no programmable validation, and no gas sponsorship (yet).

### PQ Readiness

| Proposal | PQ Strategy |
|---|---|
| **EIP-8141** | Native: write account code with any sig scheme. Signature aggregation designed in (VERIFY frame elision, signatures list proposal PR #11481). Most complete PQ path. |
| **EIP-8130** | Deploy PQ verifier contract, nodes add to allowlist. Good path but requires node coordination for adoption. |
| **EIP-8202** | Ephemeral secp256k1: one-time ECDSA keys with Merkle-committed rotation. Immediately deployable, no new crypto primitives — relies on Keccak-256 preimage resistance. Future PQ schemes added as new `scheme_id` values. Lightest-weight migration but users get a new address. |

### Mempool & Performance

| Proposal | Validation Cost | Mempool Complexity | Async Compatible |
|---|---|---|---|
| **EIP-8141** | EVM execution (capped at 100k gas) | High: validation prefix, banned opcodes, canonical paymaster | No |
| **EIP-8130** | STATICCALL to verifier (or native impl) | Medium: verifier allowlist, account lock optimization | Yes |
| **EIP-8202** | ecrecover + Merkle proof (deterministic) | Low: purely cryptographic, no EVM | Yes |

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

