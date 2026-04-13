# Competing Standards

---

Four competing proposals take fundamentally different approaches to achieving account abstraction and signature agility on Ethereum, plus two complementary proposals (EIP-8223 and EIP-8224) from the same author lineage that cover narrower static-validation cases (sponsored transactions and shielded gas funding via ZK proofs). Understanding them is essential to evaluating EIP-8141's design tradeoffs and positioning.

---

## Comparative Analysis

### The Fundamental Tradeoff: Generality vs. Deployability

The five proposals sit on a spectrum:

```
More General                                                                More Constrained
    |                                                                             |
 EIP-8141       EIP-8175       EIP-8130       EIP-8202                      EIP-XXXX
 (arbitrary     (flat caps,    (declared      (flat extensions,              (fixed UX
  EVM in         programmable   verifiers,     scheme-agile auth,            primitives,
  VERIFY         fee_auth)      no wallet      single execution)             passkeys)
  frames)                       code)
```

EIP-8223 and EIP-8224 are not placed on this spectrum because their scope is narrower than the others. EIP-8223 addresses only gas sponsorship with static validation; EIP-8224 addresses only shielded gas funding via ZK proofs. Both are explicitly positioned as complementary to any general-purpose AA design, not as replacements.

**EIP-8141** gives maximum flexibility: any account code can define any validation logic, multiple execution frames per transaction, atomic batching. The cost is mempool complexity (banned opcodes, gas caps, validation prefixes) and async execution incompatibility.

**EIP-8175** provides flat capability composition with programmable gas sponsorship via fee_auth, but limits sender validation to fixed signature schemes. It started as "simpler than 8141" but evolved to include 4 new opcodes and EVM execution in the fee_auth prelude.

**EIP-8130** trades some flexibility for predictable validation; verifiers are pure functions, nodes know the computational cost upfront. The cost is that complex validation logic can't be expressed at the protocol level.

**EIP-8202** takes a different angle entirely; it doesn't try to be an AA system. Instead, it solves signature agility and feature composition at the transaction envelope level. One execution payload, flat typed extensions, no new opcodes. The cost is no batching, no programmable validation, and no gas sponsorship (yet).

**EIP-XXXX (Tempo-like)** takes the most constrained approach, bundling the specific UX features wallets need today (batching, sponsorship, passkeys, validity windows, 2D nonces) into a single tx type with no new opcodes and no programmable validation. The cost is a fixed feature set that requires hard forks to extend, and no PQ strategy.

### PQ Readiness

| Proposal | PQ Strategy |
|---|---|
| **EIP-8141** | Native: write account code with any sig scheme. Signature aggregation designed in (VERIFY frame elision, signatures list proposal PR #11481). Most complete PQ path. Hybrid classical+PQ trivial via two VERIFY frames. |
| **EIP-8175** | Ed25519 native, Falcon-512 proposed (PR #11431). New schemes require hard fork. Cannot do hybrid classical+PQ (NIST-recommended transition). |
| **EIP-8130** | Deploy PQ verifier contract, nodes add to allowlist. Good path but requires node coordination for adoption. |
| **EIP-8202** | Ephemeral secp256k1: one-time ECDSA keys with Merkle-committed rotation. Immediately deployable, no new crypto primitives, relying on Keccak-256 preimage resistance. Future PQ schemes added as new `scheme_id` values. Lightest-weight migration but users get a new address. |
| **EIP-XXXX** | Not addressed. Supports secp256k1, P-256, and WebAuthn, all quantum-vulnerable. Adding PQ schemes requires a hard fork to define a new signature encoding. |
| **EIP-8223** | Not a PQ proposal. Sender is secp256k1 only. Orthogonal to signature agility. |
| **EIP-8224** | Not a PQ proposal. ZK proof verification (fflonk over BN254) is itself quantum-vulnerable. Orthogonal to signature agility. |

### Mempool & Performance

| Proposal | Validation Cost | Mempool Complexity | Async Compatible |
|---|---|---|---|
| **EIP-8141** | EVM execution (capped at 100k gas) | High: validation prefix, banned opcodes, canonical paymaster | No |
| **EIP-8175** | Crypto sig verification + fee_auth EVM prelude | Medium: stateless sigs, but fee_auth simulation needed | Partially (fee_auth needs EVM) |
| **EIP-8130** | STATICCALL to verifier (or native impl) | Medium: verifier allowlist, account lock optimization | Yes |
| **EIP-8202** | ecrecover + Merkle proof (deterministic) | Low: purely cryptographic, no EVM | Yes |
| **EIP-XXXX** | ecrecover / P-256 / WebAuthn (bounded) | Low: deterministic crypto, bounded sig sizes | Yes |
| **EIP-8223** | ecrecover + 1 SLOAD at `0x13` + balance check | Minimal: static reads only, no EVM | Yes (FOCIL/VOPS-native; only `0x13` storage trie added) |
| **EIP-8224** | fflonk proof verify (~176K gas) + EXTCODEHASH check + fixed storage reads | Minimal: bounded crypto + static reads, no EVM | Yes (FOCIL/VOPS-native; canonical fee-note code-hash recognition) |

### Adoption Positioning

| Proposal | Who Benefits Most | Adoption Path |
|---|---|---|
| **EIP-8141** | Protocol developers, L1 infrastructure, advanced smart accounts | Hard fork required. Comprehensive but long timeline. |
| **EIP-8175** | Reth/Erigon ecosystem, developers wanting flat batching + programmable sponsorship | Hard fork required. 4 new opcodes, actively iterating. Competes with EIP-8202 for `0x05` tx type. |
| **EIP-8130** | L2s (especially Base/Coinbase), wallets wanting simple AA | Hard fork required, but simpler client changes. No EVM modifications. |
| **EIP-8202** | EOAs wanting PQ safety, protocol designers tired of tx type proliferation | Hard fork required. Minimal client changes (no EVM mods), but competes with EIP-7932/8197 for the same design space. |
| **EIP-XXXX** | Wallets wanting batching + passkeys + sponsorship without smart contract complexity | Hard fork required. No EVM changes. Targets immediate UX improvement, not long-term extensibility. |
| **EIP-8223** | Smart-account controllers wanting gas sponsorship without EVM validation; protocols running funded operator accounts | Hard fork required. Adds only the `0x13` predeploy. Compatible with FOCIL/VOPS out of the box. Complementary to other proposals. |
| **EIP-8224** | Privacy-preserving users bootstrapping a fresh EOA without traceable funding; one-shot operation before transitioning to EIP-8223 | Hard fork required. Adds canonical fee-note bytecode + fflonk verification. Composable with EIP-8223. Complementary to other proposals. |

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

**Implicit EOA Authorization**: Every existing EOA can send AA transactions immediately, no registration needed. If the `owner_config` slot is empty and `ownerId == bytes32(bytes20(account))`, it's implicitly authorized.

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

**Account Changes**: A single transaction can create an account (CREATE2), modify owner configuration, and set EIP-7702-style delegation, all before call execution.

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

- **16 PRs** (14 merged, 1 open, 1 closed), active iteration from January through April 2026
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
- **No value in calls**: Calls carry no ETH value; ETH transfers require going through wallet bytecode.
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

**Authorization System**: The `authorizations` list contains typed `[role_id, scheme_id, witness]` tuples. Currently only `ROLE_SENDER` is defined. Each scheme registers a witness format, verification logic, address derivation, and gas surcharge. New signature schemes are added by registering a new `scheme_id`, with no envelope changes needed.

**Two Initial Schemes**:

- `SCHEME_SECP256K1` (`0x00`): Standard ECDSA. Same address derivation as legacy Ethereum, so existing EOAs can use the new tx format without address change.
- `SCHEME_EPHEMERAL_K1` (`0x01`): Quantum-safe one-time ECDSA keys. The user pre-generates 2^20 key pairs from a BIP-39 seed, commits to them via a Merkle tree, and embeds the root in the sender address. Each transaction uses key `i` at nonce `i` with a Merkle proof. After use, a quantum attacker recovering `sk_i` can't forge the next transaction because that requires inverting `keccak256(pk_{i+1})`, a Keccak-256 preimage attack (128-bit security against Grover's).

**Extension System**: The `extensions` list contains typed `[extension_id, extension_payload]` entries, unique by ID. Two initial extensions:

- `EXT_BLOB` (`0x01`): Carries EIP-4844 blob fields (`max_fee_per_blob_gas`, `blob_versioned_hashes`)
- `EXT_SET_CODE` (`0x02`): Carries EIP-7702 set-code authorizations, but with `(scheme_id, witness)` replacing `(y_parity, r, s)`, making delegation itself scheme-agile

**Transaction Envelope**:
```
0x05 || rlp([
    chain_id, nonce,
    max_priority_fee_per_gas, max_fee_per_gas, gas_limit,
    to, value, data,
    authorizations, extensions
])
```

**No Access List**: Deliberately omitted; transaction-level access lists are being deprecated (EIP-7928 block-level, EIP-7981 cost increase).

**Composability Without New Types**:
- Plain secp256k1 tx = base + sender auth(k1)
- Quantum-safe tx = base + sender auth(ephemeral k1)
- Blob tx = base + sender auth(...) + blob extension
- Set-code tx = base + sender auth(...) + set-code extension
- All three combined = base + sender auth(ephemeral k1) + blob ext + set-code ext

### Mempool Strategy

EIP-8202's mempool model is close to today's transaction processing:

- **secp256k1**: Identical to current: ecrecover the sender, check nonce and balance. No EVM execution.
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

- **1 PR** ([ethereum/EIPs#11438](https://github.com/ethereum/EIPs/pull/11438)), opened by Giulio2002, currently open
- **6 EthMagicians posts** at [ethereum-magicians.org/t/eip-8202-schemed-transaction/28044](https://ethereum-magicians.org/t/eip-8202-schemed-transaction/28044)
- Key participants: Giulio2002 (author), SirSpudlington (raised duplication concerns with EIP-7932/8197), bbjubjub (noted EIP-7702 interop gap for new EOAs), shemnon (EIP-8197 author, argued EIP-8202 lacks flexible tx bodies and signature substitution protection)

### Strengths

- **Stops type proliferation**: One envelope that composes features instead of minting new tx types for every combination. Blobs + set-code + new sig scheme = same type `0x05`.
- **Immediately deployable PQ path**: Ephemeral secp256k1 uses only existing ECDSA infrastructure and Keccak-256. No new crypto primitives, no contract deployment, no on-chain registration.
- **Minimal mempool disruption**: Validation is purely cryptographic: deterministic cost, no EVM execution, no banned opcode lists. Compatible with async execution models.
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

## EIP-8175: Composable Transaction

**Author**: Dragan Rakita (@rakita)
**Status**: Draft | **Category**: Core (Standards Track)
**Created**: February 26, 2026
**Requires**: EIP-2, EIP-1559, EIP-2718

### Overview

EIP-8175 introduces a new EIP-2718 transaction type (`0x05`) called `ComposableTransaction`. Instead of EIP-8141's frame modes and recursive execution, it defines a flat list of typed **capabilities** (CALL, CREATE) with a separated **signatures** list and an optional **fee_auth** field for programmable gas sponsorship.

The spec initially positioned itself as "a simpler alternative to EIP-8141, with no new opcodes, no execution frames, no per-frame gas accounting." It has since evolved to include 4 new opcodes and programmable fee_auth execution, narrowing the complexity gap with EIP-8141 while maintaining the flat composition philosophy.

### Core Design

**Typed Capabilities**: The `capabilities` field is an RLP list of typed entries. Two types are defined:

- `CALL (0x01)`: `[cap_type, to, value, data]` — message call
- `CREATE (0x02)`: `[cap_type, value, data]` — contract creation

Multiple capabilities execute sequentially within one transaction. If any capability reverts, remaining capabilities are skipped.

**Separated Signatures**: The `signatures` field contains typed `[signature_type, role, ...]` tuples. Two signature schemes are defined:

- `SECP256K1 (0x01)`: Standard ECDSA `(y_parity, r, s)`
- `ED25519 (0x02)`: RFC 8032 pure Ed25519 `(public_key, signature)` — address = `keccak256(public_key)[12:]`

Each signature has a **role**: `ROLE_SENDER (0x00)` or `ROLE_PAYER (0x01)`.

An open PR from Giulio2002 proposes adding **Falcon-512 (0x03)** as a post-quantum scheme.

**Programmable Fee Delegation (fee_auth)**: When the `fee_auth` field contains an address, that account sponsors the transaction. The protocol executes a **prelude call** to the fee_auth contract before capabilities execute. The fee_auth code must use the `RETURNETH` opcode to credit ETH to a transaction-scoped fee escrow. State changes during fee_auth persist even if the main transaction reverts, enabling sponsors to maintain independent accounting (nonces, rate limits).

**Signing Hash**: Two-stage domain-separated computation. The signatures array is blinded (emptied) before hashing, then `signature_type` and `role` are mixed in. This permits independent signing and prevents cross-scheme/cross-role confusion.

**Transaction Envelope**:
```
0x05 || rlp([
  chain_id, nonce,
  max_priority_fee_per_gas, max_fee_per_gas, gas_limit,
  fee_auth, capabilities, signatures
])
```

### New Opcodes

| Opcode | Purpose |
|---|---|
| `RETURNETH` | Debits ETH from current address and credits the parent context or fee escrow |
| `SIG` | Loads a signature at index into memory, pushes sig_type to stack |
| `SIGHASH` | Pushes the transaction base_hash to stack |
| `TX_GAS_LIMIT` | Pushes the transaction gas_limit to stack |

These enable fee_auth contracts to introspect signatures and compute escrow amounts on-chain.

### Mempool Strategy

Sender authentication is purely cryptographic: ecrecover or Ed25519 verification, no EVM execution. However, the fee_auth prelude does execute EVM code, introducing some mempool simulation complexity (though less than EIP-8141's arbitrary VERIFY frames since fee_auth is a single designated contract).

### Key Differences from EIP-8141

| Aspect | EIP-8175 | EIP-8141 |
|---|---|---|
| **Composition model** | Flat: typed capabilities (CALL, CREATE) | Recursive: frames with modes (VERIFY, SENDER, DEFAULT) |
| **New opcodes** | 4 (`RETURNETH`, `SIG`, `SIGHASH`, `TX_GAS_LIMIT`) | 4 (`APPROVE`, `TXPARAM`, `FRAMEDATALOAD`, `FRAMEDATACOPY`) |
| **Tx type** | `0x05` | `0x06` |
| **Signature model** | Separated signatures list with scheme types | Account code calls `APPROVE` in VERIFY frames |
| **Validation model** | Cryptographic sig verification + fee_auth EVM prelude | Programmable EVM in VERIFY frames |
| **Gas sponsorship** | Programmable fee_auth contract with `RETURNETH` escrow | VERIFY frame for sponsor, canonical paymaster |
| **Fee_auth state persistence** | Survives main tx revert | Frame-level: depends on frame mode |
| **Mempool complexity** | Medium: stateless sig verification, but fee_auth simulation needed | High: validation prefix, banned opcodes, gas caps |
| **Atomic batching** | Sequential capabilities, break on revert | Mode flag bit 11 on consecutive SENDER frames |
| **PQ strategy** | Ed25519 native, Falcon-512 proposed | Arbitrary sig schemes in VERIFY frames |
| **Hybrid classical+PQ** | Not natively supported | Trivial: two VERIFY frames with different schemes |
| **Programmable validation** | No — fixed signature scheme set for sender | Yes — arbitrary EVM logic |
| **Async execution** | Partially compatible (fee_auth still needs EVM) | Incompatible |
| **EOA support** | SECP256K1 EOAs work natively; Ed25519 creates new addresses | Protocol-native default code for codeless accounts |
| **EIP-7702 integration** | Not addressed | No authorization list (PQ incompatible) |

### Activity

- **5 PRs** (4 merged, 1 open), active iteration from February through April 2026
- **12 EthMagicians posts** at [ethereum-magicians.org/t/eip-8175-composable-transaction/27850](https://ethereum-magicians.org/t/eip-8175-composable-transaction/27850)
- **39 posts** in the related comparison thread [Frame Transactions vs. SchemedTransactions](https://ethereum-magicians.org/t/frame-transactions-vs-schemedtransactions-for-post-quantum-ethereum/28056)
- Key participants: rakita (author), Giulio2002 (Falcon-512 PR, cross-pollination with EIP-8202), Helkomine, DanielVF

### Evolution

The spec evolved significantly from its initial framing:

1. **Feb 26**: Initial submission, "no new opcodes, no execution frames." Static payer co-signature for sponsorship.
2. **Apr 6**: Major restructure, moves `to`/`value`/`data` into typed CALL/CREATE capabilities, adds programmable fee_auth with RETURNETH/SIG/SIGHASH opcodes.
3. **Apr 9**: Adds TX_GAS_LIMIT opcode.

The move from "no new opcodes" to 4 new opcodes is notable; it narrows the complexity gap with EIP-8141 while maintaining the flat composition philosophy.

### Strengths

- **Programmable sponsorship without full AA**: fee_auth provides gas sponsorship through contract execution without the full frame validation infrastructure.
- **Signature introspection**: SIG/SIGHASH opcodes let fee_auth contracts verify signatures in-EVM, enabling arbitrary sponsor authorization logic.
- **Independent signing**: Blinded signatures array allows parties to sign independently without ordered commitment chains.
- **Extensible capability model**: Future features added as new capability types without new tx types.
- **Fee_auth state persistence**: Sponsor accounting survives user tx failures.
- **Gas efficiency argument**: The comparison thread argues that SchemedTransaction-style PQ verification (~29,500 gas for Falcon) is cheaper than smart wallet dispatch through EIP-8141 (~63,000 gas).

### Weaknesses

- **No longer "simpler"**: The spec now has 4 new opcodes (same count as EIP-8141), programmable EVM execution in fee_auth, and growing complexity. The original simplicity pitch has eroded.
- **fee_auth needs mempool simulation**: The programmable fee_auth prelude introduces mempool validation complexity, though less than EIP-8141's VERIFY frames.
- **No programmable sender validation**: Sender authentication is limited to fixed signature schemes. Adding new schemes requires a hard fork.
- **Existing account migration unclear**: Ed25519 addresses derive from public keys, producing new addresses, not existing EOAs. Users must migrate assets.
- **No hybrid classical+PQ**: Cannot require both ECDSA and a PQ signature simultaneously (NIST-recommended transition approach), which is trivial in EIP-8141 but impossible here.
- **Tx type conflict**: Competes with EIP-8202 for the `0x05` tx type number.
- **Rapid evolution**: Major design changes from v1 (no opcodes, static payer) to v3 (4 opcodes, programmable fee_auth) in 6 weeks raises maturity concerns.

---

## EIP-XXXX: Tempo-like Transactions

**Author**: Georgios Konstantopoulos (@gakonst, Paradigm/Reth)
**Status**: Pre-draft (gist) | **Category**: Core (Standards Track)
**Requires**: EIP-1559, EIP-2718, EIP-2930, EIP-7702, EIP-2, EIP-2929

### Overview

This proposal introduces a new EIP-2718 transaction type (`0x76`) that bundles a **constrained set of wallet UX primitives** into a single transaction format: atomic batching, validity windows, gas sponsorship, parallelizable nonces, passkey signatures (P-256 and WebAuthn), and protocol-enforced access keys.

The philosophy is explicit: **constrained scope over general framework**. The spec deliberately does not attempt to replace ERC-4337, provide arbitrary validation logic, or introduce new opcodes. Instead, it standardizes the specific features that most wallets need today (batching, sponsorship, passkeys, scheduled execution) at the protocol level where they can be statically reasoned about.

### Core Design

**Atomic Call Batching**: The `calls` field is a list of `[to, value, input]` tuples executed sequentially. If any call reverts, the entire transaction reverts. Unlike EIP-8141's frame architecture, there's no concept of modes or frame-level gas isolation; it's a flat list of calls, all-or-nothing.

**Validity Windows**: `valid_after` and `valid_before` fields provide time-bounded execution. A transaction is valid only when `block.timestamp` falls within the window. This enables scheduled transactions and automatic expiry without off-chain infrastructure.

**Gas Sponsorship**: An optional `fee_payer_signature` field. If present, the recovered fee payer address pays all gas. The fee payer signs a domain-separated hash (`0x78` prefix) covering the full transaction including the sender's address. Fee payer signatures must be secp256k1. The spec explicitly does not define ERC-20 fee payment; sponsors wanting token reimbursement must only co-sign transactions that include explicit compensating calls.

**2D Nonces**: `nonce_key` selects a nonce stream, `nonce` is the sequence within it. `nonce_key == 0` uses the standard protocol nonce. `nonce_key > 0` uses independent parallel streams. This enables concurrent pending transactions without blocking.

**Multiple Signature Schemes**: The `sender_signature` field supports four encodings, detected by length/prefix:

| Scheme | Detection | Notes |
|---|---|---|
| secp256k1 | 65 bytes exactly | Standard ECDSA, 0 extra gas |
| P-256 | First byte `0x01`, 130 bytes | Optional SHA-256 pre-hash, +5,000 gas |
| WebAuthn | First byte `0x02`, variable (max 2,049 bytes) | Full passkey flow with authenticatorData + clientDataJSON, +5,000 gas |
| Keychain wrapper | First byte `0x03` | Wraps inner signature with `user_address` for access key delegation |

**Address Derivation**: For P-256/WebAuthn, the signer address is `keccak256(pub_key_x || pub_key_y)[12:]`, which produces new addresses, not existing EOAs.

**EIP-7702 Interop**: An optional `authorization_list` field processed with standard EIP-7702 semantics. Authorizations are not reverted if call execution reverts (matching 7702 behavior).

**Access Keys**: Deferred to a companion EIP. The Keychain wrapper signature scheme provides the hook: an access key signs on behalf of a root account, validated against protocol-enforced rules (expiry, spending limits).

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

Validation is purely cryptographic, with no EVM execution during signature verification. The mempool requirements are well-specified:

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
| **PQ readiness** | Not addressed; P-256/WebAuthn are not PQ-safe | Native: arbitrary sig schemes in VERIFY frames |
| **Programmable validation** | No — fixed scheme set | Yes — arbitrary EVM logic |
| **Async execution** | Compatible (no EVM in validation) | Incompatible with async models |
| **Account creation** | Not addressed | DEFAULT frame to deployer contract |
| **EOA default behavior** | Requires 7702 for non-secp256k1 EOAs | Protocol-native default code for codeless accounts |

### Activity

- **Pre-draft gist** by gakonst (Georgios Konstantopoulos, Paradigm/Reth)
- No EIP number assigned, no PR to ethereum/EIPs, no EthMagicians thread yet
- Very early stage, published as a design exploration

### Strengths

- **Immediate UX wins**: Batching, sponsorship, passkeys, validity windows, and 2D nonces, the features wallets actually need today, in a single tx type. No smart contract wrappers or off-chain infrastructure.
- **Passkeys at L1**: P-256 and WebAuthn signatures are first-class at the transaction layer. Users can sign with biometrics directly, without bundlers or relayers.
- **Simple mempool**: No EVM during validation, bounded signature sizes, deterministic verification costs. Compatible with async execution models.
- **Per-call receipts**: Applications can pinpoint which call in a batch failed, enabling better debugging and UX than all-or-nothing with no granularity.
- **No EVM changes**: No new opcodes, no changes to the execution environment. Simpler client implementation.
- **EIP-7702 compatibility**: Existing 7702 delegation works within the new tx format.
- **Validity windows**: Scheduled and expiring transactions natively, useful for limit orders, time-locked operations, and stale transaction cleanup.

### Weaknesses

- **No programmable validation**: The signature scheme set is fixed at the protocol level. Adding a new scheme requires a hard fork. Complex validation policies (multisig, social recovery, state-dependent rules) can't be expressed.
- **No PQ strategy**: P-256 and WebAuthn are both vulnerable to quantum computers. No ephemeral key scheme or arbitrary-scheme extensibility. The spec would need future hard forks to add PQ-safe schemes.
- **Fee payer limited to secp256k1**: Sponsors must use ECDSA and can't sponsor with passkeys or other schemes.
- **No per-call gas isolation**: All calls share a single gas limit. One expensive call can starve subsequent calls. No per-frame gas budgeting like EIP-8141.
- **P-256/WebAuthn create new addresses**: Address derivation from P-256 keys produces new addresses, not existing EOA addresses. Users need to migrate assets or use 7702 delegation.
- **Access keys deferred**: The Keychain wrapper is defined but the actual access key rules (expiry, spending limits, revocation) are punted to a companion EIP.
- **Pre-draft stage**: Published as a gist only. No EIP number, no community review, no iteration yet.

---

## EIP-8223: Contract Payer Transaction

**Author**: Ben Adams (@benaadams)
**Status**: Draft (PR [#11509](https://github.com/ethereum/EIPs/pull/11509)) | **Category**: Core (Standards Track)
**Created**: April 11, 2026
**Requires**: EIP-1559, EIP-2718, EIP-7708

### Overview

EIP-8223 introduces a new EIP-2718 transaction type where gas fees are charged to the target contract (`tx.to`), gated by a canonical payer-registry predeploy at `address(0x13)`. Unlike EIP-8141 and EIP-8175, which provide general-purpose sponsorship through in-transaction EVM execution, EIP-8223 covers the narrower case where **static validation is sufficient**: one SLOAD from the registry plus one balance check, no code execution during validation.

The proposal explicitly positions itself as **complementary**, not competing, to frame-based proposals. The PR description notes: "The payer registry predeploy is infrastructure consumed by any future general solution, not deprecated by it. The registry mechanism could also be expressed as a capability or frame mode within those formats."

### Core Design

**Payer Registry Predeploy (`0x13`)**: A system contract where any contract can call `authorize(sender)` to register a single authorized EOA for gas sponsorship. Storage layout uses direct-slot mapping for static validation compatibility.

**Validation Flow** (no EVM execution):

1. Extract `tx.to` from the transaction envelope.
2. One SLOAD from the registry at `0x13` to read the authorized sender for `tx.to`.
3. Verify the sender signature matches the authorized sender.
4. One balance check on `tx.to` to cover `max_fee_per_gas * gas_limit`.

**Gas Flow**: Real balance transfers (not escrow abstractions). The payer contract funds the sender, the sender pays gas via standard EIP-1559 mechanics, and unused gas refunds return to the payer. Every transfer emits an EIP-7708 Transfer log. Receipts, `effectiveGasPrice`, and gas-related logs work identically to EIP-1559.

**Two-Sided Opt-In**:
- Contract side: an explicit `registry.authorize(sender)` call (never implicit).
- Sender side: choosing the sponsored transaction type per transaction.

**Binding via `tx.to`**: Sponsorship only activates when the transaction calls the payer contract itself. No additional transaction field needed.

**One-to-One (payer → sender), Many-to-One (sender → payers)**: Each payer authorizes exactly one sender (O(1) mempool revalidation). Many payers can authorize the same EOA, enabling one signer to control multiple self-paying accounts.

**Key Rotation**: `authorize(newEOA)` replaces the prior authorization atomically. The old key is instantly deauthorized. Account assets never move, only the controlling key changes.

### Mempool Strategy

Validation is purely static:

- Account-trie reads (standard).
- One SLOAD from a known predeploy (`0x13`).
- No EVM code execution.

This is strictly compatible with **FOCIL inclusion lists** and **VOPS partial statelessness**: a VOPS node only needs to additionally retain the storage trie for `0x13`. No banned opcode lists, no validation gas caps, no prefix simulation.

### Key Differences from EIP-8141

| Aspect | EIP-8223 | EIP-8141 |
|---|---|---|
| **Scope** | Gas sponsorship only, via static payer registry | General-purpose AA: validation, execution, sponsorship |
| **New opcodes** | None | 4 (`APPROVE`, `TXPARAM`, `FRAMEDATALOAD`, `FRAMEDATACOPY`) |
| **System contracts** | Canonical payer registry at `0x13` | Canonical paymaster (mempool policy only, not consensus) |
| **Validation model** | 1 SLOAD + balance check, no EVM | Programmable EVM in VERIFY frames |
| **Signature schemes** | secp256k1 sender only | Arbitrary via account code |
| **Sponsorship binding** | Via `tx.to` (no extra field) | VERIFY frame authorizing payer |
| **Atomic batching** | Not addressed | Mode flag bit 11 on SENDER frames |
| **VOPS/FOCIL compatibility** | Native (adds only `0x13` storage trie to VOPS baseline) | Requires bounded state access discipline |
| **Async execution** | Compatible (no EVM in validation) | Incompatible |
| **EIP-7702 interop** | Composable (EOA delegates, then authorizes sponsor) | No authorization list |

### Use Cases Highlighted

- **Smart contract accounts** that pay their own gas when called (controller EOA needs no ETH).
- **Key rotation** without asset migration.
- **EIP-7702 + EIP-8223 composition**: cold EOA-1 delegates to smart wallet code, then authorizes hot EOA-2. EOA-2 sends sponsored transactions with zero balance; EOA-1 retains master control.
- **Protocol-funded operations**: protocol deploys a scoped smart account, funds it from treasury, authorizes an operator EOA. Handover is a single `authorize(newOperator)` call.

### Activity

- **1 PR** ([#11509](https://github.com/ethereum/EIPs/pull/11509)), opened April 11, 2026
- Discussion thread: [ethereum-magicians.org/t/eip-8223-contract-payer-transactions/28202](https://ethereum-magicians.org/t/eip-8223-contract-payer-transactions/28202)

### Strengths

- **FOCIL/VOPS-native**: Only one additional storage trie (`0x13`) needs to be kept. Addresses the "choose 2 of 3" trilemma head-on for the sponsored-transaction subset.
- **No EVM in validation**: Deterministic cost, trivial mempool implementation, compatible with encrypted mempools and async execution models.
- **Real balance transfers, not escrow**: Uses standard EIP-1559 accounting and EIP-7708 Transfer logs. Nothing new to index.
- **Complementary framing**: Explicitly scoped to static-sponsorship cases; does not attempt to replace frame-based general AA.

### Weaknesses

- **Sponsorship only**: Does not provide programmable validation, alternative signature schemes, or PQ support.
- **One sponsor per contract**: One-to-one binding limits multi-tenant payer patterns without separate contracts per user.
- **Limited binding**: Activation requires `tx.to` to be the payer contract, which constrains the transaction shape and conflicts with patterns where the target is a different application contract.
- **Very early stage**: PR opened April 11, 2026. No review cycle, no community consensus yet.

---

## EIP-8224: Counterfactual Transaction

**Author**: Ben Adams (@benaadams)
**Status**: Draft (PR [#11518](https://github.com/ethereum/EIPs/pull/11518)) | **Category**: Core (Standards Track)
**Created**: April 12, 2026
**Requires**: EIP-196, EIP-197, EIP-1559, EIP-2718, EIP-2780, EIP-3529, EIP-4788, EIP-6780, EIP-7708, EIP-7904

### Overview

EIP-8224 introduces a new EIP-2718 transaction type (`0x08`) for **protocol-native shielded gas funding using ZK proofs against canonical fee-note contracts**. It addresses a problem that remains even after EIP-8223: a fresh EOA with no ETH cannot pay gas privately, because receiving ETH from any source creates a traceable on-chain link.

The flow:

1. A user deposits ETH into a canonical fee-note contract instance (recognized by runtime code hash, not a fixed address), receiving a private Poseidon commitment.
2. Later, from a fresh EOA, the user submits a counterfactual transaction carrying an **fflonk** ZK proof (over BN254) that they own an unspent fee note sufficient to cover gas.
3. The protocol verifies the proof (no EVM execution required, bounded cryptographic computation plus fixed storage reads), consumes the fee note's nullifier, settles gas, and sends any leftover ETH to a designated `gas_refund_recipient`.
4. The transaction body executes normally; it can call any contract (privacy pool withdrawal, account setup, etc.).

EIP-8224 is positioned as **complementary** to EIP-8141, EIP-8175, and EIP-8223 (all from the same `benaadams` lineage). It targets the bootstrap problem for fresh EOAs that need shielded gas funding before they can use any sponsorship-based mechanism.

### Core Design

**Code-hash recognition**: Fee-note contracts are recognized by `EXTCODEHASH`, not a fixed predeploy address. Multiple instances can coexist. The transaction names its instance via `fee_note_contract`, and the proof binds to that address.

**fflonk over BN254**: Universal setup (reuses existing powers-of-tau), 2-pair pairing verification, ~176K gas proof verification cost. No circuit-specific trusted setup ceremony.

**Append-only accepted roots**: Deposits add roots that are never revoked. Proofs against older roots remain valid forever, preventing censorship-based griefing.

**Arbitrary note values**: No fixed denomination tiers. Deposit any ETH amount; the circuit proves `fee_denomination == note_value`.

**Cross-chain protection**: `chain_id` bound in the proof (8 public inputs total) as defense-in-depth against cross-chain replay.

**One-shot bootstrap pattern**: Used once to fund a smart account and register it in the EIP-8223 payer registry. All subsequent transactions from that account use cheap sponsored transactions.

### Mempool Strategy

Validation is bounded cryptographic computation plus a canonical code-hash check plus fixed storage reads. **No EVM execution.** This places EIP-8224 firmly in the [restrictive mempool tier](/mempool-strategy#restrictive-mempool-what-ships-first) alongside EIP-8223 and the EIP-8141 self-relay/canonical-paymaster prefixes.

### Intrinsic Gas Breakdown

| Component | Gas |
|---|---|
| Base (EIP-2780) | 4,500 |
| fflonk proof verification (9 ECMUL + 9 ECADD + 2-pair ECPAIRING) | 176,346 |
| Fee-note state access | 6,800 |
| Fee-note state mutation | 22,500 |
| ETH transfer logs | 3,512 |
| **Fixed subtotal** | **213,658** |
| Proof calldata (~512 bytes) | ~8,192 |
| **Typical minimum total** | **~222,000** |

### Key Differences from EIP-8141

| Aspect | EIP-8224 | EIP-8141 |
|---|---|---|
| **Scope** | Shielded gas funding via ZK proofs against fee-note contracts | General-purpose AA: validation, execution, sponsorship |
| **New opcodes** | None | 4 (`APPROVE`, `TXPARAM`, `FRAMEDATALOAD`, `FRAMEDATACOPY`) |
| **Validation model** | fflonk proof + code-hash check + fixed storage reads, no EVM | Programmable EVM in VERIFY frames |
| **Privacy model** | Private commitment (Poseidon), nullifier consumption | None natively; relies on out-of-protocol mixers |
| **Bootstrap problem** | Solved (fresh EOA can pay gas without traceable funding) | Not addressed |
| **Composability** | Designed to compose with EIP-8223 (one-shot bootstrap, then sponsored txs) | Stand-alone |
| **VOPS/FOCIL compatibility** | Native (canonical code-hash + fixed storage reads) | Requires bounded state access discipline |
| **Async execution** | Compatible (no EVM in validation) | Incompatible |
| **Cost** | ~222K gas typical | Frame transaction overhead, varies by structure |

### Activity

- **1 PR** ([#11518](https://github.com/ethereum/EIPs/pull/11518)), opened April 12, 2026
- Discussion thread not yet linked

### Strengths

- **Solves the bootstrap problem**: Fresh EOAs can fund their first transaction without traceable on-chain links to the depositor.
- **Mempool-safe by construction**: Bounded cryptographic verification, no EVM execution, fixed storage reads. Restrictive-tier compatible.
- **Universal setup (fflonk)**: No circuit-specific trusted setup ceremony required. Reuses existing powers-of-tau.
- **Append-only roots**: Censorship-resistant. Old proofs never expire.
- **Composable with EIP-8223**: One-shot bootstrap, then transition to cheap sponsored transactions.
- **Bounded ETH exit**: Unused fee-note value emerges as public ETH at `gas_refund_recipient`, doubling as an account bootstrap mechanism.

### Weaknesses

- **High intrinsic gas**: ~222K gas per transaction is significant. Intended as a one-shot operation, not a steady-state mechanism.
- **One-shot positioning**: Not designed for repeated use; the user transitions to cheaper mechanisms (EIP-8223) for ongoing activity.
- **Pre-draft artifacts**: Canonical fee-note bytecode, verification key, circuit artifacts, and cross-client test vectors are not yet published.
- **Very early stage**: PR opened April 12, 2026. No review cycle, no community consensus yet.

---

## Cross-Proposal Commentary

### What EIP-8175's Ecosystem Says About EIP-8141

From the [Frame Transactions vs. SchemedTransactions comparison thread](https://ethereum-magicians.org/t/frame-transactions-vs-schemedtransactions-for-post-quantum-ethereum/28056), Giulio2002 argues that frame transactions impose a "smart wallet tax" of ~30,000-48,000 gas for contract dispatch, storage reads, and EVM context, making PQ verification via VERIFY frames (~63,000 gas) roughly 2x more expensive than direct SchemedTransaction verification (~29,500 gas for Falcon).

The deeper argument: every real signature scheme ends up needing a precompile anyway (P256 → RIP-7212, Falcon → EIP-8052, Dilithium → EIP-8051). Frames become "an unnecessary indirection" over precompiles that were going to be needed regardless.

EIP-8141 defenders counter that: (1) the gas comparison conflates ERC-4337 EntryPoint overhead with frame transaction overhead, (2) existing EOAs cannot use new crypto schemes under SchemedTransactions without changing addresses, *"an almost certain guarantee that there will be very little adoption"* (matt), and (3) NIST-recommended hybrid classical+PQ signing is trivial in VERIFY frames but impossible in flat signature schemes.

EIP-8175 and EIP-8202 share the same author ecosystem (rakita and Giulio2002 cross-pollinate) and form an allied front pushing "flat composition, not recursive" against EIP-8141's frame model.

### What EIP-8130's Author Says About EIP-8141

From the Biconomy blog analysis:
> "Base's position: 'We can heavily optimize this and build out performant mempool/block builder implementations,' something they can't do with EIP-8141's arbitrary validation frames."

The core disagreement: EIP-8130 advocates say EIP-8141's arbitrary EVM validation creates DoS vulnerabilities. EIP-8141 supporters counter that EIP-8130 can be built atop EIP-8141 (verifiers are a subset of what VERIFY frames can do) but not vice versa.

### What EIP-8202's Authors Say About EIP-8141

From the spec's motivation:
> "This EIP is intentionally not a frame transaction system. It does not introduce recursive transactions, multiple execution payloads, new execution modes, or new opcodes."

And from the security considerations:
> "This EIP [...] intentionally forbids recursive transaction composition. That avoids drifting into frame-transaction validation complexity, where mempool validation may require richer execution-aware processing before inclusion."

However, EIP-8202 explicitly acknowledges EIP-8141 as a potential extension:
> "An EIP-8141-style frame extension could attach nested execution frames to the same transaction envelope without requiring a new top-level transaction type."

The positioning is complementary-but-skeptical: EIP-8202 solves the envelope and signature agility problem first, and frames could be layered on top later as an extension, but the authors are clearly concerned about the mempool complexity that frame execution introduces.

