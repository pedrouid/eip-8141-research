# Developer Tooling

---

## TL;DR

**The problem**

When an account abstraction standard ships without protocol-level defaults, every common feature (batching, fee sponsorship, permissions, recovery) has to be standardized downstream as an ERC. Those ERCs take years to converge across wallets, and often fragment into competing designs stewarded by different vendors, which leaks into app developer APIs.

**Bear case**: EIP-8141 is too unopinionated. Without protocol defaults for common AA features, the ecosystem will reproduce the ERC-5792 saga (1 year to converge, still inconsistent adoption) for every feature. Permissions already show this: Base's ERC-7895 + Spend Permissions and MetaMask's ERC-7710 + ERC-7715 model permissions very differently, and neither has wider wallet adoption.

**Bull case**: EIP-8141 already ships with protocol defaults that cover the most common cases. Default EOA code makes existing EOAs able to send frame transactions with no account upgrade and no EIP-7702 delegation. Permissionless ERC-20 paymasters work through the default code path. The adoption cost is "implement a new transaction type" rather than "deploy/audit a smart account and run relayer infrastructure on every chain," which is the 100x gap versus EIP-7702 + EIP-4337.

**How EIP-8141 addresses the concern**

- Default code for EOAs covers secp256k1 and P256 signature verification without account migration
- Permissionless ERC-20 paymasters work for existing EOAs via the default code path (spec example 4)
- Canonical paymaster is a protocol-blessed sponsorship default that the public mempool can validate efficiently
- Atomic batching is expressed directly in the transaction format via the batch flag on consecutive SENDER frames
- The escape hatch (arbitrary EVM in VERIFY/SENDER frames) remains for the configurability cases

**What remains**: Permissions, session keys, social recovery, and the wallet-to-app RPC layer are not covered by protocol defaults and will still need ERC-level standardization. Those are where the fragmentation risk continues.

---

## The Problem: Fragmentation of AA Developer APIs

When AA ships with primitives and no policy, the ecosystem fills the policy gap. Each common feature has to be standardized as a wallet-level ERC, and each ERC has to be adopted by every major wallet to be useful to app developers. The pattern is well-documented:

**Slow convergence**. ERC-5792 (`wallet_sendCalls` for batch calls) took roughly a year for major wallets to align on. Adoption across top wallets and apps is still incomplete.

**Fragmented APIs**. Competing wallet vendors steward parallel standards for the same feature, each with different mental models that leak into app developer APIs:

| Feature | Standard A | Standard B |
|---|---|---|
| Permissions / session keys | MetaMask: ERC-7710 + ERC-7715 | Base: ERC-7895 + Spend Permissions |
| Batch calls | ERC-5792 (converged, slowly) | — |
| Fee sponsorship | ERC-7677 (Coinbase lineage) | Wallet-specific proposals emerging |

The permissions example is the canonical warning. ERC-7710/7715 and ERC-7895/Spend Permissions model permissions in substantially different ways, no other wallets implement either yet, and apps that want permissions have to either pick a side or ship two implementations.

**Root cause**. Without protocol defaults, every wallet's policy is as valid as any other. That is how you end up with N parallel ERCs per feature and a multi-year convergence cycle per ERC.

---

## Bear Case: Complexity Without Defaults

*Position*: EIP-8141 is too unopinionated. Without protocol-level defaults, it will reproduce the ERC-5792, ERC-7895, and ERC-7710 fragmentation pattern for every AA feature.

The argument in full:

> An ideal UX-focused protocol should offer wallets and app devs with conventional defaults, and an escape hatch for configurability. Defaults that cover ~80% of real world use cases; configurability for the 20%.
>
> The problem with not having defaults on a native AA standard like Frame Transactions is that now we need to create ERCs for common and trivial AA features so that wallets can align on standard APIs to distribute downstream to app devs (e.g. batch calls, fee sponsorship, permissions, etc).
>
> We have a batch call standard now great (ERC-5792), but that took 1 year (!!!!) for wallets to align on, and a lot of top wallets or apps don't even use it yet.
>
> Now, we need ERCs for fee sponsorship and permissions (and more). There are a few ERCs out there now which cover this, however, there are a lot of dupes with fragmented APIs stewarded by different large wallets. For example, Base's ERC-7895 + Spend Permissions vs. MetaMask's ERC-7710 + ERC-7715, which have largely differing permission models that leak to app devs, and no other wallets implement these standards yet.
>
> If the protocol had defaults, then wallets would just need to proxy through for app devs via `eth_sendTransaction` fields that mirror the RLP structure (we do this already!).
>
> I'm not saying we should not have any configurability at all, but we should offer conventional defaults with a configurable escape hatch.

**Practical implication for wallet tooling**. Shipping EIP-8141 in wallet SDKs (e.g. Viem) is conditional on confidence that frame transactions become the native AA standard. If the spec ships without protocol defaults for batching, fee sponsorship, and permissions, the follow-on ERC work still has to happen and still has to converge across wallets, with the same multi-year cycle that ERC-5792 demonstrated.

---

## Bull Case: Native AA With Powerful Defaults

*Position*: EIP-8141 ships with defaults substantial enough to change the adoption calculus. Dismissing it as "just another AA proposal" misses a 100x reduction in adoption cost versus EIP-7702 + EIP-4337.

The argument in full ([source](https://x.com/decentrek/status/2036697881512701997)):

> I've written about how Frames is the only AA proposal that's flexible enough to support all use cases AND ships with powerful defaults that make adoption easy.
>
> The key thing to realize about Frames is that it's going to work on existing EOAs without any account upgrades (no EIP-7702 delegations required). And another key thing to realize is that Frames enables "permissionless ERC20 paymasters" (see example 4 on the spec). When you combine these two facts, you realize that existing EOA wallets will be able to support "pay gas with any token" by just supporting a new transaction type. No need to trust/audit a smart account, no need to run relayer infra. It's so much power unlocked with so little work that it would be impossible for existing wallets to not adopt it.
>
> Again, if the counter argument is "well then why wasn't 7702/4337 widely adopted," we are comparing apples with oranges here. The adoption cost of 7702 + 4337 is 100x that of Frames because you need to 1) develop/audit a smart account, and 2) run relayer infra on EVERY chain you want to support. With Frames, those two issues are gone, you just implement a new transaction type. It's as easy as it gets. Also not to mention that Frames (or any form of native AA) will be significantly more gas-efficient / lower-latency than relayer-based AA like 7702+4337.

**Practical implication for wallet tooling**. If the adoption cost truly is "implement a new transaction type," the most-requested AA features (ERC-20 gas payment for existing EOAs, sponsored transactions without a relayer) become reachable from a standard EOA. That preempts the fragmentation pressure that drove ERC-5792 and ERC-7677. The permissions and session-key ERC problem remains, but batching and sponsorship are handled at the protocol layer.

---

## How EIP-8141 Addresses These Concerns

### Default Code for EOAs

Every EOA without deployed code executes a protocol-defined default that handles:

- secp256k1 signature verification (standard EOA path)
- P256 signature verification (WebAuthn / passkey path, via EIP-7212 precompile)
- Gas sponsorship via the canonical paymaster pattern

Existing EOAs, without EIP-7702 delegation and without migrating to a smart account, can send frame transactions that use permissionless ERC-20 paymasters. The default code is the policy layer for the 80% case.

**Implication**. Wallets do not need to ship batching and sponsorship as ERC-level standards on top of frames. Those behaviors are reachable directly from a standard EOA by sending a frame transaction.

### Permissionless ERC-20 Paymasters

Example 4 in the [current spec](/current-spec) shows an ERC-20 paymaster pattern that:

- Does not require a specific smart account deployment
- Does not require a trusted or audited paymaster contract
- Does not require off-chain relayer infrastructure

A wallet that adds frame transaction support gets "pay gas with any token" for free for every existing EOA user.

### Canonical Paymaster (Mempool Policy)

The [canonical paymaster](/current-spec#mempool-policy) is a protocol-blessed contract that the public mempool knows how to validate efficiently. Wallets that route sponsored transactions through it inherit public mempool inclusion and FOCIL compatibility. This is an explicit default for sponsorship that does not preclude building non-canonical paymasters for advanced cases. The adoption risk is tracked as a [pending concern](/pending-concerns#4-the-canonical-paymaster-adoption-risk).

### Atomic Batching in the Transaction Format

Atomic batching is expressed via bit 11 of `frame.mode` on consecutive SENDER frames ([spec](/current-spec)). Apps do not need a wallet-level RPC standard to batch, and wallets do not need to agree on a separate ERC for batching behavior. The transaction format itself carries the batch semantics.

### The Escape Hatch

For the 20% configurability case, accounts can still deploy code and define arbitrary validation or execution logic via VERIFY and SENDER frames. Permissions, session keys, social recovery, and more complex policies live here, which is where wallet-level ERCs are still expected to emerge.

---

## Where Fragmentation Risk Still Lives

Protocol defaults cover batching, ECDSA and P256 signatures, and ERC-20 gas sponsorship. They do not cover everything:

| Feature area | Default covers? | ERC work still needed? |
|---|---|---|
| Atomic batching | Yes (mode flag, bit 11) | No |
| Gas sponsorship, native ETH | Yes (canonical paymaster) | No for basic case |
| Gas sponsorship, ERC-20 | Yes (default code + spec example 4) | No for basic case |
| secp256k1 and P256 signatures | Yes (default code) | No |
| Post-quantum signatures | Via account code or precompiles | Scheme-by-scheme ERCs expected |
| Permissions / session keys | No | Yes (ERC-7710/7715 vs ERC-7895 divergence already exists) |
| Social recovery | No | Yes |
| Multisig policies | No | Yes |
| Wallet → app communication | Out of scope | Yes (ERC-5792 and successors) |

The bear case is not wrong, it is partially absorbed. Protocol defaults remove the fragmentation pressure on the most common features. They do not remove it for permissions, recovery, or the wallet-to-app RPC layer. The ERC-5792, ERC-7895, and ERC-7710 pattern is still expected to continue for those.

---

## Summary

- The fragmentation concern is real. Wallet-level ERCs converge slowly and often produce competing standards stewarded by different wallet vendors.
- EIP-8141 addresses the features most likely to fragment via default EOA code: batching (via atomic batch flag), secp256k1/P256 signatures, and ERC-20 gas sponsorship through permissionless paymasters, all reachable from existing EOAs without smart account deployment or EIP-7702 delegation.
- Adoption cost for wallets is implementing a new transaction type, not deploying/auditing a smart account or running per-chain relayer infrastructure. This is the 100x claim in the bull case.
- Permissions, session keys, recovery, and the wallet RPC layer remain outside the protocol defaults, so ERC-level fragmentation risk continues in those areas. This is where the bear case still applies.
- The escape hatch remains. Accounts that need advanced policies can deploy code with VERIFY and SENDER frames, which is where the 20% configurability case is handled.
