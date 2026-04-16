# EOA Support

---

## TL;DR

EIP-8141 makes existing EOAs first-class AA users with no migration, no smart-account deployment, and no [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) delegation. The mechanism is a protocol-level **default code** that runs whenever a frame targets an account with no deployed code, handling signature verification and call dispatch on the EOA's behalf.

- **Replaces EIP-7702 delegation for common cases**. No `set_code` tx, no persistent delegate, no extra signing ceremony.
- **Per-transaction, not persistent**. Default code is protocol logic, not state on the account. Nothing is recorded on-chain.
- **Composable per-transaction**. The wallet picks the frame composition for each transaction.
- **EOA can act as a paymaster**. Any EOA can sign as a sponsor without deploying a paymaster contract.
- **Custom account code remains available**. Accounts that need richer logic can still deploy code, which overrides default code.
- **DEFAULT frames serve positional roles**. First frame for account deployment, last frame for paymaster post-op refunds.

Default code does NOT handle contract deployment (that uses a separate `deploy` frame), and does not run for 7702-delegated EOAs (the delegated code takes over).

---

## What EOAs Get For Free

Every EOA gets the following behavior without opt-in, deployment, or signed authorization:

### VERIFY mode

1. Require `frame.target == tx.sender` unless the approval scope is payer-only (`0x1`). Any EOA can serve as a paymaster.
2. Read approval scope from the flags field: `scope = frame.flags & 3`. If `scope == 0`, revert.
3. Read first byte of `frame.data` as `signature_type`:
   - `0x0` (secp256k1): parse `(v, r, s)`, enforce low-`s`, reject failed `ecrecover`, require `frame.target == ecrecover(sig_hash, v, r, s)`.
   - `0x1` (P256): parse `(r, s, qx, qy)`, require `frame.target == keccak(0x04 | qx | qy)[12:]` (domain-separated), reject invalid public keys, require `P256VERIFY(sig_hash, r, s, qx, qy) == true`.
   - Anything else: revert.
4. Call `APPROVE(scope)`.

### SENDER mode

1. Require `frame.target == tx.sender`.
2. Read `frame.data` as RLP encoding of `calls = [[target, value, data], ...]`.
3. Execute each call with `msg.sender = tx.sender`. If any call reverts, revert the frame.

Combined with the [atomic batch flag (bit 2 of `flags`)](https://eips.ethereum.org/EIPS/eip-8141#mode-flags) on consecutive SENDER frames, this gives EOAs atomic multi-call without a smart account.

### DEFAULT mode

Default code reverts. DEFAULT frames are used when targeting deployed contracts: first-frame account deployment (target = deterministic deployer) and last-frame paymaster post-op refunds (target = paymaster contract).

---

## DEFAULT Frames in Practice

| Position | Use case | Why DEFAULT mode |
|---|---|---|
| **First frame** | Account deployment | Account doesn't exist yet, so EntryPoint is the only meaningful caller. |
| **Last frame** | Paymaster post-op | Paymaster gates refund logic on `caller == ENTRY_POINT`. |

**Account deployment**: targets a deterministic deployer (EIP-7997). Creates the account before VERIFY frames run. The mempool recognizes two deploy-prefixed validation shapes (`deploy → self_verify` and `deploy → only_verify → pay`).

**Paymaster post-op**: the paymaster charges upfront, the protocol refunds unused gas as ETH, then a DEFAULT frame calls the paymaster to refund the user's ERC-20 overpayment. The post-op frame is part of execution (after `payer_approved == true`) and not subject to validation rules.

---

## Why This Replaces EIP-7702 for Common Cases

| Property | EIP-7702 + delegate | EIP-8141 default code |
|---|---|---|
| Onchain footprint | Persistent delegation header | None |
| Authorization tx | Required `set_code` signing | None |
| Delegate deployment | Required (deploy + audit) | None (protocol logic) |
| Per-tx flexibility | Limited to delegate's features | Wallet composes per transaction |
| Signature schemes | Whatever delegate implements | secp256k1, P256 baked in |
| Gas sponsorship | Delegate must implement | Any EOA via default VERIFY |
| Reversal cost | Another `set_code` authorization | Nothing to reverse |

The cost of EIP-7702 in production: (1) wallet must develop and audit a smart account, (2) wallet must run relayer infrastructure on every chain, (3) user must sign a delegation, (4) delegation is persistent so revocation requires another authorization. Default code eliminates all four for the common case. See [Developer Tooling → Bull Case](/developer-tooling#bull-case-native-aa-with-powerful-defaults).

---

## Per-Transaction Composability

EIP-8141's EOA support is **per-transaction, not per-account**. The same EOA can across consecutive transactions: send a simple transfer, do an atomic approve-and-swap, use a paymaster for ERC-20 gas, or deploy a smart account in the same transaction that uses it.

Each composition is a distinct frame transaction. Nothing on the account changes between them. Feature rollout ships in the wallet's frame-construction logic, not in a smart account redeploy. New AA features become available the moment the wallet supports them, for every existing EOA, without any user action.

---

## EOA as Paymaster

Any EOA can act as a paymaster. The default VERIFY logic supports `APPROVE(scope)` for payment scope (`0x1`) and combined scope (`0x3`). A sponsor signs a VERIFY frame with payment scope; default code verifies the signature and approves payment. No paymaster contract needed.

This composes with the [restrictive mempool tier](/mempool-strategy#restrictive-mempool-what-ships-first) under the `MAX_PENDING_TXS_USING_NON_CANONICAL_PAYMASTER = 1` rule. The canonical paymaster contract still exists for high-throughput cases.

---

## When You Still Need Custom Account Code

Default code covers the common case but not everything:

- **Multisig authorization**: more than one signer
- **Social recovery**: trusted parties rotating the signing key
- **Session keys**: scoped, time-bounded keys with per-call rules
- **Custom signature schemes** beyond secp256k1 and P256
- **State-dependent validation**: rules reading more than `tx.sender`'s storage
- **Non-trivial paymaster logic**: rate limiting, allowlists, etc.

Default code is the floor, not the ceiling. Custom validation that exceeds the restrictive mempool's bounds routes through the [expansive tier](/mempool-strategy#two-tiers-in-one-mempool).

---

## What Default Code Doesn't Do

**Contract deployment**: uses a separate `deploy` frame targeting a deterministic deployer (EIP-7997). Default code's DEFAULT mode reverts.

**7702-delegated EOAs**: if an EOA has signed a `set_code` authorization, the delegate's code runs instead of default code. This is a real interoperability gap [identified by DanielVF](/current-spec#relationship-to-other-proposals): a wallet that 7702-delegates is on the hook for reimplementing what default code provided. EOAs that want default code behavior should not 7702-delegate.

---

## Summary

EIP-8141 makes EOAs first-class AA users through protocol-level default code, eliminating the authorization-transaction, smart-account-deployment, and relayer overhead that EIP-7702 + EIP-4337 requires. Default code is the floor: accounts that need multisig, recovery, or exotic validation still deploy custom code. DEFAULT frames serve two positional roles (deployment and post-op), both gated on `caller == ENTRY_POINT`.
