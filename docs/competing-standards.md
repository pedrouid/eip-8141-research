# Competing Standards

---

## TL;DR

Five general-purpose proposals sit on a spectrum from maximum generality (EIP-8141: arbitrary EVM in VERIFY frames) to maximum constraint (EIP-XXXX/Tempo: fixed UX primitives, no programmable validation). EIP-8141 and EIP-8130 are the two most active, both fully PQ-ready through different mechanisms: arbitrary account code vs. verifier contracts. EIP-8130 wins on mempool simplicity and performance; EIP-8141 wins on expressiveness and EOA defaults. Two complementary proposals (EIP-8223 and EIP-8224) cover static sponsorship and shielded gas funding, composing with any general-purpose design.

---

## Comparative Analysis

### The Fundamental Tradeoff: Generality vs. Deployability

The five general-purpose proposals sit on a spectrum (alternatives, you choose one):

```
More General                                                                More Constrained
    |                                                                             |
 EIP-8141       EIP-8175       EIP-8130       EIP-8202                      EIP-XXXX
 (arbitrary     (flat caps,    (verifier       (flat extensions,              (fixed UX
  EVM in         programmable   contracts,     scheme-agile auth,            primitives,
  VERIFY         fee_auth)      no wallet      single execution)             passkeys)
  frames)                       code)
```

Two complementary proposals sit off the spectrum (narrower scope, compose with any of the above):

```
                Static Sponsorship                       Shielded Gas Funding
                ──────────────────                       ────────────────────
                 EIP-8223                                 EIP-8224
                 (canonical payer registry                (fflonk ZK proof against
                  at 0x13, one SLOAD                       canonical fee-note
                  + balance check,                         contracts, ~222K gas,
                  no EVM in validation)                    bootstrap problem)
```

**EIP-8141** gives maximum flexibility: any account code can define any validation logic, multiple execution frames per transaction, atomic batching. The cost is mempool complexity (banned opcodes, gas caps, validation prefixes) and async execution incompatibility.

**EIP-8175** provides flat capability composition with programmable gas sponsorship via fee_auth, but limits sender validation to fixed signature schemes. It started as "simpler than 8141" but evolved to include 4 new opcodes and EVM execution in the fee_auth prelude.

**EIP-8130** makes validation programmable but operationally predictable through verifier contracts: any validation logic can be expressed inside a verifier, while the allowlist and known gas bounds give nodes predictable cost. It is also designed as a full cross-chain account standard. The constraint is that verifiers implement a pure `verify(hash, data) → ownerId` interface, which shapes how complex policies (time-based, state-dependent) need to be expressed.

**EIP-8202** takes a different angle entirely; it doesn't try to be an AA system. Instead, it solves signature agility and feature composition at the transaction envelope level. One execution payload, flat typed extensions, no new opcodes. The cost is no batching, no programmable validation, and no gas sponsorship (yet).

**EIP-XXXX (Tempo-like)** takes the most constrained approach, bundling the specific UX features wallets need today (batching, sponsorship, passkeys, validity windows, 2D nonces) into a single tx type with no new opcodes and no programmable validation. The cost is a fixed feature set that requires hard forks to extend, and no PQ strategy.

### ECDSA Decoupling

| Proposal | Approach | Programmable Validation |
|---|---|---|
| **EIP-8141** | Arbitrary EVM in VERIFY frames. Account code defines its own sig scheme. No ECDSA dependency in the tx format. | Yes: any logic via account code + APPROVE |
| **EIP-8175** | Fixed signature scheme set (secp256k1, Ed25519). New schemes require hard fork. | No: sender auth is cryptographic only |
| **EIP-8130** | Declarative verifier contracts. Any sig scheme expressible inside a verifier (including PQ schemes). Nodes maintain allowlist. Fully PQ-ready: deploy a PQ verifier, nodes add to allowlist. | Yes: within the `verify(hash, data) → ownerId` interface |
| **EIP-8202** | Typed `scheme_id` in authorization (secp256k1, P256, Falcon-512). New schemes added per EIP. | No: fixed cryptographic check per scheme |
| **EIP-XXXX** | Fixed set: secp256k1, P-256, WebAuthn. New schemes require hard fork. | No |
| **EIP-8223** | secp256k1 sender only. Not a decoupling proposal. | No |
| **EIP-8224** | fflonk ZK proof verification. Not a decoupling proposal. | No |

Both EIP-8141 and EIP-8130 are fully PQ-ready, through different mechanisms. EIP-8141 achieves it via arbitrary account code in VERIFY frames. EIP-8130 achieves it via verifier contracts: deploy a contract implementing any PQ signature scheme, and nodes add it to their allowlist. The tradeoff is expressiveness vs. operational predictability: EIP-8141's VERIFY frames can run any EVM logic, while EIP-8130's verifiers are constrained to the pure `verify(hash, data) → ownerId` interface, which gives nodes bounded, predictable validation cost.

On key rotation: EIP-8130 has native onchain key rotation via `owner_config` changes, portable across chains. EIP-8141 delegates key management entirely to account code, with no protocol-level rotation mechanism. EIP-8223 offers key rotation for sponsored accounts via `authorize(newEOA)`.

### Gas Sponsorship

| Proposal | Sponsorship Model | Canonical Paymaster |
|---|---|---|
| **EIP-8141** | VERIFY frame authorizes payer. Canonical paymaster recognized by runtime code match. Non-canonical limited to 1 pending tx. Any EOA can sponsor via default code. | Yes: protocol-blessed, mempool-validated |
| **EIP-8175** | Programmable `fee_auth` contract with `RETURNETH` escrow. Sponsor state persists even if main tx reverts. | No: fee_auth is per-sponsor |
| **EIP-8130** | `payer` + `payer_auth` fields. Payer authenticated via same verifier infrastructure as sender. | No: uses verifier allowlist |
| **EIP-8202** | `ROLE_PAYER` reserved but not yet defined. No sponsorship today. | No |
| **EIP-XXXX** | `fee_payer_signature` field (secp256k1 only). Fee payer pays all gas. | No: direct co-signing |
| **EIP-8223** | Canonical payer registry at `0x13`. Static validation (1 SLOAD + balance check). `tx.to` pays gas. | Yes: predeploy registry |
| **EIP-8224** | Shielded gas funding via ZK proofs. One-shot bootstrap, then transition to EIP-8223. | No: fee-note contract |

### Transaction Batching

| Proposal | Batching Model | Atomicity Control |
|---|---|---|
| **EIP-8141** | Multiple frames per tx. SENDER frames execute sequentially with per-frame gas. | Flags field bit 2 on consecutive SENDER frames: opt-in atomic batches |
| **EIP-8175** | Typed capabilities list (CALL, CREATE). Sequential execution. | All-or-nothing: if any capability reverts, remaining are skipped |
| **EIP-8130** | Call phases (array of arrays). Completed phases persist if later phases revert. | Per-phase atomicity: calls within a phase are atomic |
| **EIP-8202** | Single execution payload. No native batching. | N/A: one call per tx (multicall wrappers needed) |
| **EIP-XXXX** | `calls` list of `[to, value, input]` tuples. | All-or-nothing: entire tx reverts on any call failure |
| **EIP-8223** | Not addressed. Single call per tx. | N/A |
| **EIP-8224** | Not addressed. Single call per tx. | N/A |

### Developer Tooling

| Proposal | Wallet Integration Cost | Infrastructure Required |
|---|---|---|
| **EIP-8141** | Implement new tx type. Default code covers EOAs with no smart account needed. | No bundlers, no relayers. Public mempool. |
| **EIP-8175** | Implement new tx type. Compose capabilities + signatures. | No bundlers. fee_auth contracts for sponsorship. |
| **EIP-8130** | Implement new tx type. Register owners via Account Configuration Contract. | Verifier contracts. Node allowlist coordination. |
| **EIP-8202** | Implement new tx type. Existing secp256k1 EOAs keep their address. | Minimal: no new contracts. |
| **EIP-XXXX** | Implement new tx type. P-256/WebAuthn create new addresses. | Minimal: no new contracts. |
| **EIP-8223** | Implement new tx type. Payer calls `authorize(sender)` on registry. | Payer registry predeploy only. |
| **EIP-8224** | Implement new tx type. User deposits into fee-note contract, generates ZK proof. | Fee-note contracts + proof generation tooling. |

On EVM changes: EIP-8141 requires 5 new opcodes and a new frame execution model. EIP-8175 requires 4 new opcodes. EIP-8130 and all other proposals require zero EVM modifications, which simplifies client implementation and reduces the cross-client coordination burden. EIP-8130 achieves comparable programmability to EIP-8141 with a smaller protocol-change surface. EIP-8141's advantage is that default code gives EOAs AA features without smart account deployment or registration.

### Mempool Strategy

| Proposal | Validation Cost | Mempool Complexity |
|---|---|---|
| **EIP-8141** | EVM execution (capped at 100k gas) | High: validation prefix shapes, banned opcodes, canonical paymaster |
| **EIP-8175** | Crypto sig verification + fee_auth EVM prelude | Medium: stateless sigs, but fee_auth simulation needed |
| **EIP-8130** | STATICCALL to verifier (or native impl) | Medium: verifier allowlist, account lock optimization |
| **EIP-8202** | ecrecover / P256VERIFY / Falcon-512 verify (deterministic) | Low: purely cryptographic, no EVM |
| **EIP-XXXX** | ecrecover / P-256 / WebAuthn (bounded) | Low: deterministic crypto, bounded sig sizes |
| **EIP-8223** | ecrecover + 1 SLOAD at `0x13` + balance check | Minimal: static reads only, no EVM |
| **EIP-8224** | fflonk proof verify (~176K gas) + EXTCODEHASH check + fixed storage reads | Minimal: bounded crypto + static reads, no EVM |

On tracing requirements: EIP-8141 is the only proposal that requires full EVM tracing during validation (banned opcode enforcement, storage access tracking, validation-prefix pattern matching). EIP-8175 requires partial tracing for fee_auth simulation. EIP-8130 avoids tracing entirely for allowlisted verifiers: nodes can implement hot-path signature algorithms natively and skip EVM execution, resulting in lower validation gas and minimal validation state. For unknown verifiers, EIP-8130 nodes can fall back to STATICCALL with gas caps, but the common path is trace-free.

### Other Capabilities

| Proposal | EOA Support | Account Creation | Async Execution | Cross-Chain |
|---|---|---|---|---|
| **EIP-8141** | Protocol-native default code (ECDSA + P256) | DEFAULT frame to deployer | Incompatible | Not addressed |
| **EIP-8175** | secp256k1 native; Ed25519 creates new addresses | Not addressed | Partially (fee_auth needs EVM) | Not addressed |
| **EIP-8130** | Implicit EOA authorization, auto-delegation | CREATE2 via `account_changes` | Compatible | Yes: `chain_id = 0` replays |
| **EIP-8202** | secp256k1 EOAs keep address; P256/Falcon create new | Not addressed | Compatible | Not addressed |
| **EIP-XXXX** | secp256k1 native; P-256/WebAuthn create new addresses | Not addressed | Compatible | Not addressed |
| **EIP-8223** | EOA delegates via 7702, then authorizes sponsor | Not addressed | Compatible | Not addressed |
| **EIP-8224** | Fresh EOA bootstrapping via ZK proof | Not addressed | Compatible | Cross-chain via `chain_id` binding |

## Individual Proposals

Each proposal is covered in detail on its own page:

- [EIP-8175: Composable Transaction](/eip-8175)
- [EIP-8130: AA by Account Configuration](/eip-8130)
- [EIP-8202: Scheme-Agile Transactions](/eip-8202)
- [EIP-XXXX: Tempo-like Transactions](/eip-xxxx)
- [EIP-8223: Contract Payer Transaction](/eip-8223)
- [EIP-8224: Counterfactual Transaction](/eip-8224)


---

## Cross-Proposal Commentary

### What EIP-8175's Ecosystem Says About EIP-8141

In the [Frame Transactions vs. SchemedTransactions comparison thread](https://ethereum-magicians.org/t/frame-transactions-vs-schemedtransactions-for-post-quantum-ethereum/28056), Giulio2002 ([post #1](https://ethereum-magicians.org/t/frame-transactions-vs-schemedtransactions-for-post-quantum-ethereum/28056/1)) argues that frame transactions impose a "smart wallet tax" of ~30,000-48,000 gas for contract dispatch, storage reads, and EVM context, making PQ verification via VERIFY frames (~63,000 gas) roughly 2x more expensive than direct SchemedTransaction verification (~29,500 gas for Falcon).

The deeper argument: every real signature scheme ends up needing a precompile anyway (P256 → RIP-7212, Falcon → EIP-8052, Dilithium → EIP-8051). Frames become "an unnecessary indirection" over precompiles that were going to be needed regardless.

EIP-8141 defenders counter that: (1) the gas comparison is contested. ch4r10t33r ([post #17](https://ethereum-magicians.org/t/frame-transactions-vs-schemedtransactions-for-post-quantum-ethereum/28056/17)) argues "the 30,000–48,000 gas 'smart wallet tax' figure is substantially inflated when applied to a natively-validated Frame Transaction", because the figure conflates ERC-4337 EntryPoint overhead with frame transaction overhead. (2) existing EOAs cannot use new crypto schemes under SchemedTransactions without changing addresses, which matt ([post #15](https://ethereum-magicians.org/t/frame-transactions-vs-schemedtransactions-for-post-quantum-ethereum/28056/15)) characterized as *"an almost certain guarantee that there will be very little adoption"*. (3) NIST-recommended hybrid classical+PQ signing is trivial in VERIFY frames but impossible in flat signature schemes.

*Analysis*: EIP-8175 and EIP-8202 share overlapping authors (rakita and Giulio2002 cross-pollinate across both). The two proposals advocate a consistent "flat composition, not recursive" design position against EIP-8141's frame model.

### What EIP-8130's Author Says About EIP-8141

From the [Biconomy blog analysis](https://blog.biconomy.io/native-account-abstraction-state-of-art-and-pending-proposals-q1-26/):
> "Base's position: 'We can heavily optimize this and build out performant mempool/block builder implementations,' something they can't do with EIP-8141's arbitrary validation frames."

The EIP-8130 author's position is that EIP-8141 loses on most operational metrics: higher gas cost for non-EOA validation, mempool tracing requirements, no native key rotation, larger EVM surface area (5 new opcodes), and weaker developer experience unless the ecosystem aligns on follow-on ERCs. EIP-8130 offers comparable programmability (any logic can be expressed in a verifier) with better performance characteristics (native hot-path implementations, no tracing, minimal validation state) and built-in account management (onchain owner configuration, cross-chain portability).

EIP-8141 supporters counter that: (1) EIP-8130 can be built atop EIP-8141 (verifiers are a subset of what VERIFY frames can do) but not vice versa, (2) default code gives EOAs immediate AA without registration or contract deployment, and (3) the generality of VERIFY frames enables use cases that the verifier interface cannot express (stateful validation, multi-step authorization flows).

The tension is structural: EIP-8130 constrains validation to a pure function interface and gains performance and predictability in return. EIP-8141 preserves maximum expressiveness and accepts the mempool complexity cost. Whether the constrained or general approach better serves the ecosystem depends on which use cases dominate in practice.

### What EIP-8202's Authors Say About EIP-8141

From the spec's motivation:
> "This EIP is intentionally not a frame transaction system. It does not introduce recursive transactions, multiple execution payloads, new execution modes, or new opcodes."

And from the security considerations:
> "This EIP [...] intentionally forbids recursive transaction composition. That avoids drifting into frame-transaction validation complexity, where mempool validation may require richer execution-aware processing before inclusion."

However, EIP-8202 explicitly acknowledges EIP-8141 as a potential extension:
> "An EIP-8141-style frame extension could attach nested execution frames to the same transaction envelope without requiring a new top-level transaction type."

The positioning is complementary-but-skeptical: EIP-8202 solves the envelope and signature agility problem first, and frames could be layered on top later as an extension, but the authors are clearly concerned about the mempool complexity that frame execution introduces.

---

## Summary

The competing landscape splits along two axes:

**Generality vs. deployability** (the spectrum at the top of this doc): EIP-8141 is the most general (arbitrary EVM in VERIFY frames), and the constraint level rises as you move through EIP-8175 (programmable fee_auth), EIP-8130 (declared verifiers, no wallet code), EIP-8202 (flat scheme-agile envelope), to EIP-XXXX/Tempo-like (fixed UX primitives, no programmable validation).

**Scope** (general-purpose AA vs. narrower complementary proposals): EIP-8223 and EIP-8224 are intentionally scoped narrower than the other five. They address only sponsored gas and shielded gas funding respectively, and explicitly compose with whatever general-purpose AA design ships.

What to take away:

- **ECDSA decoupling and PQ readiness**: EIP-8141 and EIP-8130 are both fully PQ-ready and offer programmable validation, through different mechanisms (arbitrary EVM vs. verifier contracts). EIP-8175, EIP-8202, and EIP-XXXX restrict sender authentication to fixed cryptographic schemes, requiring hard forks for new ones. For the full PQ roadmap implications, see [PQ Roadmap](/pq-roadmap).
- **Performance and mempool complexity** favor EIP-8130 over EIP-8141 for non-EOA accounts. EIP-8130 requires no EVM tracing, supports native hot-path verifier implementations, and has minimal validation state. EIP-8141 requires full EVM tracing during validation (banned opcodes, storage access tracking) with higher gas overhead for smart account validation. EIP-8141's advantage is that codeless EOAs get the cheapest path via default code. EIP-8202 / EIP-XXXX / EIP-8223 / EIP-8224 all prioritize mempool simplicity further, at the cost of programmable validation.
- **Gas sponsorship** has the widest design variance. EIP-8141 uses VERIFY frames with a canonical paymaster. EIP-8175 uses programmable fee_auth contracts. EIP-8130 uses the same verifier infrastructure for payers. EIP-8223 takes the narrowest approach with a static payer registry. EIP-8202 has no sponsorship yet.
- **Transaction batching** separates the general-purpose proposals from the envelope-only ones. EIP-8141 (frames), EIP-8175 (capabilities), EIP-8130 (call phases), and EIP-XXXX (calls list) all support native batching with different atomicity models. EIP-8202, EIP-8223, and EIP-8224 do not.
- **Developer tooling and EVM surface**: EIP-8141 requires 5 new opcodes and a new frame execution model, the largest EVM change of any proposal. EIP-8130 achieves comparable programmability with zero EVM modifications. EIP-8141's default code advantage (EOAs get AA for free) is weighed against EIP-8130's simpler client implementation burden and native account management (onchain owner config, key rotation, cross-chain portability).
- **Key rotation**: EIP-8130 has native onchain key rotation via `owner_config` changes. EIP-8141 delegates key management entirely to account code, with no protocol-level rotation mechanism. EIP-8223 offers key rotation for sponsored accounts via `authorize(newEOA)`.
- **Complementary stack possibility**: the benaadams stack (EIP-8141 + EIP-8223 + EIP-8224) is the only proposal cluster designed to layer general-purpose AA, static sponsorship, and shielded gas funding into a single coherent design. The other proposals are more standalone.

