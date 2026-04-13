# EOA Support

---

## TL;DR

EIP-8141 makes existing EOAs first-class AA users with no migration, no smart-account deployment, and no [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) delegation. The mechanism is a protocol-level **default code** that runs whenever a frame targets an account with no deployed code, handling signature verification and call dispatch on the EOA's behalf.

- **Replaces EIP-7702 delegation for common-case EOAs**. No `set_code` authorization tx, no persistent delegate contract on the account, no extra signing ceremony. Existing EOAs send frame transactions and the protocol routes through default code automatically.
- **Per-transaction, not persistent**. Default code is protocol logic, not state on the account. Each frame transaction composes its own frame sequence. Nothing is recorded on-chain about how the account was used.
- **Composable per-transaction**. The wallet picks the frame composition for each transaction (simple call, atomic batch, sponsored ERC-20 gas, account deployment, etc.). Default code adapts to whatever frames the wallet sends.
- **EOA can act as a paymaster**. Default code's VERIFY logic supports the payment approval scope (`APPROVE(0x1)` and `APPROVE(0x3)`), so any EOA can sign as a sponsor without deploying a paymaster contract.
- **Custom account code remains available**. Accounts that need richer logic (multisig, social recovery, custom signature schemes, session keys) can still deploy code, which overrides default code for that account.
- **DEFAULT frames serve specific positional roles**. They are used as the **first frame** for account deployment (target = deterministic deployer) and as the **last frame** for paymaster post-op refunds (target = paymaster contract). Default code itself reverts in DEFAULT mode because EOAs have no meaningful EntryPoint-callable behavior.

What default code does NOT do: contract deployment (handled by a separate `deploy` frame using a deterministic deployer), and it does not run for accounts that already have code deployed (including 7702-delegated EOAs, where the delegated code takes over).

---

## What EOAs Get For Free

Every EOA gets the following behavior without any opt-in, deployment, or signed authorization. The spec defines it as a single dispatch on `frame.mode`:

### VERIFY mode

The default verification logic:

1. Require `frame.target == tx.sender`. Otherwise revert.
2. Read approval scope from mode bits: `scope = (frame.mode >> 8) & 3`. If `scope == 0`, revert.
3. Read first byte of `frame.data` as `signature_type`:
   - `0x0` (secp256k1): parse `(v, r, s)` and require `frame.target == ecrecover(sig_hash, v, r, s)`.
   - `0x1` (P256): parse `(r, s, qx, qy)`, require `frame.target == keccak(qx | qy)[12:]`, and require `P256VERIFY(sig_hash, r, s, qx, qy) == true`.
   - Anything else: revert.
4. Call `APPROVE(scope)`.

This is what lets an EOA validate itself as the sender or as a payer. For payer scope (`0x1`), [PR #11488](https://github.com/ethereum/EIPs/pull/11488) explicitly removes the `frame.target != tx.sender` check from the default VERIFY code path so any EOA can serve as a paymaster.

### SENDER mode

The default execution logic:

1. Require `frame.target == tx.sender`. Otherwise revert.
2. Read `frame.data` as the RLP encoding of `calls = [[target, value, data], ...]`.
3. For each call, execute it with `msg.sender = tx.sender`. If any call reverts, revert the frame.

This is the EOA's way of issuing one or more calls in a single SENDER frame. Combined with the atomic batch flag (bit 11) on consecutive SENDER frames, it gives EOAs atomic multi-call without a smart account.

### DEFAULT mode

Default code reverts. EOAs have no meaningful behavior to execute when called by the EntryPoint (which is what DEFAULT mode signifies), so the protocol does not synthesize one.

This does not mean DEFAULT frames are unused. They are widely used in practice, but only when targeting deployed contracts at specific positions in the transaction. See the next section.

---

## DEFAULT Frames in Practice

A DEFAULT frame sets `caller = ENTRY_POINT` (instead of `tx.sender` like SENDER mode). That is exactly what you want for two specific roles in a frame transaction, both gated by position:

| Position | Use case | Why DEFAULT mode |
|---|---|---|
| **First frame** | Account deployment | The account being deployed does not exist yet, so there is no `tx.sender` code to act as caller. EntryPoint is the only meaningful caller. |
| **Last frame** | Paymaster post-op (refunds) | The paymaster's refund logic gates on `caller == ENTRY_POINT`, which is a cleaner authorization than gating on the sender. |

These are the only two valid DEFAULT frame use cases known today. Both are positional conventions, not protocol-enforced constraints, but the public mempool's recognized validation prefixes assume them.

### Account Deployment (first frame)

The deployment frame targets a known deterministic deployer contract. Per the spec, this is EIP-7997 in the current restrictive-mempool policy. The deployer creates the account at a deterministic address before any VERIFY frame runs, so by the time the validation prefix executes, the account's code is in place.

This is the only way to bundle account creation with first use in a single transaction. The public mempool recognizes two deploy-prefixed validation shapes (`deploy → self_verify` and `deploy → only_verify → pay`), with `deploy` always as the first frame.

### Paymaster Post-Op (last frame)

The post-op pattern is most useful for ERC-20 paymasters. The flow:

1. **Validation phase**. The paymaster is charged X gas (calculated from `tx.gas_limit`) and collects X worth of ERC-20 tokens from the user as upfront payment.
2. **Execution phase**. Only Y gas is actually consumed. The protocol refunds the unused `X - Y` gas to the paymaster as ETH.
3. **Post-op (last frame)**. A DEFAULT frame calls the paymaster. The paymaster's refund logic runs:

   > "If I am called by the EntryPoint, look at how much I should refund the user, and send ERC-20 tokens back to them."

The DEFAULT mode is the security boundary. The paymaster gates the refund logic on `caller == ENTRY_POINT`, which guarantees the call originated from the protocol's post-op step, not from the sender or any other contract. A SENDER frame could in principle do the same work, but having the EntryPoint as caller is the cleaner authorization since the refund logic does not need (and should not require) the user as caller.

The mempool implication: the recognized canonical-paymaster validation prefix is `[only_verify, pay]` with the `pay` frame collecting `X` upfront. The post-op DEFAULT frame is part of execution (after `payer_approved == true`) and therefore not subject to the public mempool's validation rules. It can implement arbitrary refund logic.

---

## Why This Replaces EIP-7702 for Common Cases

EIP-7702 lets an EOA delegate execution to a smart contract by signing a `set_code` authorization. Once delegated, the EOA's code field stores `0xef0100 || delegate_address`, which causes calls to the EOA to execute the delegate's code instead. The delegation is persistent. It stays until the user signs another delegation.

EIP-8141 default code achieves the equivalent effect for the most common AA features without any of that:

| Property | EIP-7702 + delegate contract | EIP-8141 default code |
|---|---|---|
| Onchain footprint | Delegation header (`0xef0100 + addr`) stored on the account, persistent | None. No state change on the account. |
| Authorization tx | Required `set_code` authorization signed by EOA | None. The frame transaction itself is the only signature needed. |
| Delegate contract deployment | Required (deploy + audit + maintain) | None. Default code is protocol logic. |
| Per-tx flexibility | Limited to whatever the delegate contract implements | Wallet composes frame sequence per transaction |
| Signature schemes covered | Whatever the delegate implements | secp256k1, P256 (passkey/WebAuthn) baked in |
| Atomic batching | Whatever the delegate implements | Bit 11 mode flag on consecutive SENDER frames, native |
| Gas sponsorship | Delegate must implement paymaster pattern | Any EOA can serve as paymaster via default VERIFY |
| Reversal cost | Sign another `set_code` authorization to undo | Nothing to reverse. There's no commitment. |

The cost of EIP-7702 in production is real:

1. Wallet must develop and audit a smart account.
2. Wallet must run relayer/bundler infrastructure on every chain.
3. User must sign a delegation to opt in.
4. Delegation is persistent, so revocation requires another signed authorization.

EIP-8141 default code removes all four. The wallet implements a new transaction type, the user signs a frame transaction, and the protocol does the rest. See [Developer Tooling → Bull Case](/developer-tooling#bull-case-native-aa-with-powerful-defaults) for the broader adoption-cost argument.

---

## Per-Transaction Composability

The most underappreciated property of EIP-8141's EOA support is that it is **per-transaction, not per-account**. Every frame transaction picks its own frame sequence. The same EOA can, across consecutive transactions:

- Send a simple value transfer with one VERIFY + one SENDER frame
- Send an atomic ERC-20 approve-and-swap with one VERIFY + two SENDER frames (atomic flag on the first SENDER)
- Use a paymaster for ERC-20 gas with two VERIFY + multiple SENDER + one DEFAULT post-op frame
- Deploy a smart account in the same transaction that uses it for the first time

Each composition is a distinct frame transaction. Nothing on the account changes between them. Compare this to EIP-7702, where the delegate contract decides what's possible and a feature change requires either (a) signing a new delegation to a different contract, or (b) the delegate contract being upgradable, which adds its own complexity and risk.

Practical implication for wallets: feature rollout can ship in the wallet's frame-construction logic, not in a redeploy of the smart account. New AA features become available the moment the wallet supports them, for every existing EOA, without any user action.

---

## EOA as Paymaster

Any EOA can act as a paymaster, not just contract-based sponsors.

The default VERIFY logic supports `APPROVE(scope)` for any of the valid scope values, including `0x1` (payment approval) and `0x3` (sender + payment combined). [PR #11488](https://github.com/ethereum/EIPs/pull/11488) explicitly removes the `frame.target != tx.sender` check from the default VERIFY code so the target can be any EOA, not just the sender.

What this enables:

- **Sponsor-as-EOA**: a sponsor signs a frame transaction containing their own VERIFY frame with payment scope. The default code verifies the sponsor's signature and approves payment. No paymaster contract needs to be deployed.
- **Existing wallets become sponsorship sources**: any EOA wallet can mint sponsored transactions for users by signing as the payer in a VERIFY frame.
- **No paymaster infrastructure required for the simple case**: the canonical paymaster contract still exists for high-throughput sponsorship use cases (it's a public-mempool-blessed pattern with reserved-balance accounting), but for low-volume sponsorship, an EOA-as-paymaster works directly.

This composes with the [restrictive mempool tier](/mempool-strategy#restrictive-mempool-what-ships-first): an EOA-as-paymaster transaction matches the `[only_verify, pay]` validation prefix, qualifying for public mempool propagation under the `MAX_PENDING_TXS_USING_NON_CANONICAL_PAYMASTER = 1` rule for non-canonical paymasters.

---

## When You Still Need Custom Account Code

Default code covers a lot of ground but not everything. You still need to deploy account code (or use EIP-7702 delegation to a smart account contract) when you need:

- **Multisig authorization**: more than one signer required to authorize a transaction
- **Social recovery**: trusted parties able to rotate the signing key
- **Session keys with policy**: scoped, time-bounded keys with per-call rules
- **Custom signature schemes** beyond secp256k1 and P256 (Falcon, Dilithium, BLS, etc.)
- **State-dependent validation**: rules that read more than `tx.sender`'s storage during validation
- **Non-trivial paymaster logic**: token-denominated gas with rate limiting, allowlists, etc.

The pattern: use default code for the 80% of accounts and operations that do not need any of the above. Deploy custom code (or 7702-delegate to it) only for accounts that need it. Default code is the floor, not the ceiling.

For the mempool implications of these custom validation patterns, see [Mempool Strategy → Two Tiers in One Mempool](/mempool-strategy#two-tiers-in-one-mempool). Custom validation logic that exceeds the restrictive mempool's bounds (e.g. arbitrary state reads outside `tx.sender`) routes through the expansive tier.

---

## What Default Code Doesn't Do

Two important boundaries:

### Default code does not handle contract deployment

Contract deployment uses a separate `deploy` frame as the first frame of the transaction, targeting a known deterministic deployer contract (per the spec's mempool policy, EIP-7997 is the deployer-of-record under PR #11521's spec tightening). The default code's DEFAULT mode case explicitly reverts. See [DEFAULT Frames in Practice → Account Deployment](#account-deployment-first-frame) for the full pattern.

### Default code does not run for 7702-delegated EOAs

If an EOA has signed an EIP-7702 `set_code` authorization, its code field is set to `0xef0100 + delegate_address` and the delegate's code runs instead of default code. This means a 7702-delegated EOA loses access to default code's signature verification and call dispatch unless the delegate contract reimplements those behaviors.

This is a real interoperability gap, [identified by DanielVF](/current-spec#relationship-to-other-proposals). A wallet that 7702-delegates an EOA to a smart account is on the hook for reimplementing what default code provided. The flip side: an EOA that wants default code's behavior should NOT 7702-delegate. Default code is the simpler path for the common case.

---

## Summary

- **EOAs are first-class AA users in EIP-8141**. The protocol's default code handles secp256k1 and P256 signature verification (VERIFY mode) and batched call dispatch (SENDER mode) without any code being deployed on the account.
- **No EIP-7702 delegation needed for the common case**. No authorization tx, no persistent on-chain state change, no smart-account deployment, no relayer infrastructure to maintain.
- **EOA support is per-transaction, not per-account**. Each frame transaction composes its own frame sequence; nothing about the account changes between transactions.
- **EOAs can serve as paymasters**. The default VERIFY logic supports the payment approval scope, and PR #11488 removed the `target == tx.sender` constraint, so any EOA can sign as a sponsor.
- **Custom account code is still the right path when you need richer logic**. Multisig, recovery, session keys, exotic signature schemes, complex paymasters all require deploying account code (or 7702-delegating to it). Default code is the floor, not the ceiling.
- **Two boundaries to remember**. Default code does not handle contract deployment (use a `deploy` frame as the first frame) and does not run for 7702-delegated EOAs (the delegated code overrides it).
- **DEFAULT frames are positional**. They serve as the first frame for account deployment (target = deterministic deployer) and as the last frame for paymaster post-op refunds (target = paymaster contract). DEFAULT mode is what gates the paymaster's refund logic to `caller == ENTRY_POINT`.
