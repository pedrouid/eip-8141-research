# Developer Tooling

---

## TL;DR

When AA ships without protocol-level defaults, every common feature (batching, sponsorship, permissions) must be standardized as an ERC. Those ERCs converge slowly and often fragment across wallet vendors. EIP-8141 addresses the most common features via default EOA code (signatures, batching, ERC-20 sponsorship) at the protocol level, but permissions, session keys, and recovery remain outside protocol defaults and will still need ERC standardization.

---

## Practical Takeaways

**If you're building a wallet:**
- Plan to drop bundler, EntryPoint, and UserOperation infrastructure from the 8141 path. Frame transactions enter the public mempool directly.
- Existing EOA addresses keep working. No migration, no smart-account deployment, and no 7702 delegation required. Default code handles secp256k1, P256 (passkeys), and ETH transfer out of the box.
- Session keys, multisig, social recovery, and richer permissions still need account code or ERC standardization. Protocol defaults do not cover these.
- For gas sponsorship, prefer the canonical paymaster for the public-mempool path; use EOA-as-paymaster (default VERIFY with payment scope) where one sponsor + one user is sufficient.

**If you're building an app:**
- Your contracts keep seeing `msg.sender = tx.sender` in SENDER frames, so token approvals, NFT ownership checks, and access control all work unchanged.
- "Gas paid in ERC-20" and "approve + swap atomic" become standard patterns, no RPC negotiation with a specific wallet vendor required.
- Post-quantum migration is handled at the account level, not the app level. No app-side changes needed to support users migrating to PQ signatures.

**If you want the reasoning behind these claims:** the bull/bear cases and fragmentation analysis below.

---

## The Fragmentation Problem

Without protocol defaults, each AA feature becomes a wallet-level ERC that must be adopted by every major wallet to be useful to app developers. The pattern is well-documented:

**Slow convergence**. [ERC-5792](https://eips.ethereum.org/EIPS/eip-5792) (`wallet_sendCalls` for batch calls) took an extended period for wallets to align on, and adoption remains incomplete.

**Fragmented APIs**. Competing vendors steward parallel standards for the same feature:

| Feature | Standard A | Standard B |
|---|---|---|
| Permissions / session keys | MetaMask: [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710) + [ERC-7715](https://eips.ethereum.org/EIPS/eip-7715) | Base: [ERC-7895](https://eips.ethereum.org/EIPS/eip-7895) + [Spend Permissions](https://docs.base.org/identity/smart-wallet/concepts/features/optional/spend-permissions) |
| Batch calls | [ERC-5792](https://eips.ethereum.org/EIPS/eip-5792) (converged, slowly) | - |
| Fee sponsorship | [ERC-7677](https://eips.ethereum.org/EIPS/eip-7677) (Coinbase lineage) | Wallet-specific proposals emerging |

Without protocol defaults, every wallet's policy is as valid as any other. That is how you get N parallel ERCs per feature and a multi-year convergence cycle per ERC.

---

## Bear Case: Complexity Without Defaults

*Position*: EIP-8141 is too unopinionated. [Source](https://x.com/_jxom/status/2043135281604464905)

A UX-focused protocol should ship conventional defaults covering ~80% of use cases, plus an escape hatch for the 20%. Without them, the ecosystem reproduces the ERC-5792/ERC-7895/ERC-7710 fragmentation for every AA feature. Permissions already show this: Base and MetaMask model them differently, neither has wider adoption, and apps must pick a side or ship two implementations.

Shipping EIP-8141 in wallet SDKs (e.g. [Viem](https://viem.sh)) depends on confidence that frame transactions become the native AA standard. If the spec ships without defaults for batching, sponsorship, and permissions, follow-on ERC work still has to happen with the same extended convergence cycle.

---

## Bull Case: Native AA With Powerful Defaults

*Position*: EIP-8141 ships with defaults that change the adoption calculus. Sources: [Decentrek — Powerful Defaults](https://x.com/decentrek/status/2036697881512701997), [Doris G — Your Wallet is About to Change Forever](https://dorisgxyz.substack.com/p/your-ethereum-wallet-is-about-to), [dicethedev — Bundler Bottleneck framing](https://hackmd.io/@dicethedev/HyhbyJA3bg).

EIP-8141 already provides protocol-level defaults for the most common features:

- **Default code for EOAs**: secp256k1 and P256 signature verification without account migration, smart account deployment, or EIP-7702 delegation. Existing EOAs send frame transactions and the protocol handles verification automatically.
- **Native ETH transfers**: SENDER frames carry a `frame.value` field (PR #11534, Apr 16), so wallets build simple ETH sends as one SENDER frame with `target = destination, value = amount` rather than shipping RLP call-list boilerplate in default code.
- **Permissionless ERC-20 paymasters**: existing EOA wallets get "pay gas with any token" by adding a new tx type, without trusting a smart account or running relayer infrastructure ([spec example 4](/current-spec#practical-use-cases)).
- **Canonical paymaster**: a protocol-blessed sponsorship contract that the public mempool validates efficiently. Wallets routing through it inherit FOCIL compatibility. Adoption risk is tracked as an [open question](/mempool-strategy#canonical-paymaster-adoption).
- **Atomic batching**: expressed via bit 2 of `frame.flags` on consecutive SENDER frames. No wallet-level RPC standard needed, no separate ERC for batch semantics.
- **Escape hatch**: arbitrary EVM in VERIFY/SENDER frames for the configurability cases.

The adoption cost reduces to "implement a new transaction type" rather than "deploy/audit a smart account and run relayer infrastructure on every chain." The "no relayer" claim is structural: privacy rebroadcasters and ERC-20 gas fronting are expressible as pure onchain contracts (including, in principle, shielded-pool sponsorship once the [three mempool/FOCIL/VOPS gates](/mempool-strategy#privacy-pools-three-gates) are relaxed). See [Mempool Strategy](/mempool-strategy#why-frame-transactions-dont-need-relayers).

**"Bundler Bottleneck" framing** (dicethedev): the central wallet-developer claim is that ERC-4337 requires a bundler because validation runs off-protocol. Frame transactions run validation in-protocol, which removes the structural need for the bundler/EntryPoint/paymaster-service triad for the common cases. This is the same argument stated from the wallet side rather than the mempool side.

**Synthesis framing** (Doris G): EIP-8141 converges programmable validation (ERC-4337), EOA compatibility (EIP-7702), and authorization-as-protocol-primitive (EIP-3074), and adds frame-based atomic batching on top. Prior standards are evolutionary predecessors, not competitors. Session keys and graduated-permission patterns (phone passkey for daily <1 ETH, hardware for ≤50 ETH, AI-agent session keys with expiry, multi-signer treasury policies) move from ERC-4337-smart-account-only to protocol-native; they can be expressed in default-code VERIFY paths plus account code, without a bundler or EntryPoint.

**What frames do not solve** (Doris G): cross-chain identity persistence. Per-transaction validation runs inside a frame; the mapping from "which keys are authorized for this user" to "this user's assets across chains" is a separate layer. A keystore registry is the complementary infrastructure for asset-signer separation. EIP-8141 is silent on this layer by design.

---

## Where Fragmentation Risk Still Lives

Protocol defaults cover batching, signatures, and ERC-20 sponsorship. They do not cover everything:

| Feature area | Default covers? | ERC work still needed? |
|---|---|---|
| Atomic batching | Yes (flags field, bit 2) | No |
| Gas sponsorship, native ETH | Yes (canonical paymaster) | No for basic case |
| Gas sponsorship, ERC-20 | Yes (default code + spec example 4) | No for basic case |
| secp256k1 and P256 signatures | Yes (default code) | No |
| Post-quantum signatures | Via account code or precompiles | Scheme-by-scheme ERCs expected |
| Permissions / session keys | No | Yes (ERC-7710/7715 vs ERC-7895 divergence exists) |
| Social recovery | No | Yes |
| Multisig policies | No | Yes |
| Wallet-to-app communication | Out of scope | Yes (ERC-5792 and successors) |

The bear case is not wrong, it is partially absorbed. Protocol defaults remove fragmentation pressure on the most common features. They do not remove it for permissions, recovery, or the wallet-to-app RPC layer.

---

## Summary

- The fragmentation concern is real. Wallet-level ERCs converge slowly and fragment across vendors.
- EIP-8141 addresses the features most likely to fragment via protocol defaults: batching, signatures, and ERC-20 sponsorship, all reachable from existing EOAs.
- Permissions, session keys, recovery, and the wallet RPC layer remain outside protocol defaults. ERC-level fragmentation continues for those.
