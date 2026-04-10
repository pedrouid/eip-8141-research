---
layout: home
hero:
  name: EIP-8141
  text: Frame Transaction
  tagline: Native account abstraction and post-quantum readiness for Ethereum - one transaction type, multiple frames, programmable validation
  actions:
    - theme: brand
      text: Read the Spec Overview
      link: /01-current-spec
    - theme: alt
      text: Try the Demo
      link: https://demo.eip-8141.ethrex.xyz/
features:
  - title: Programmable Validation
    details: Accounts define their own signature verification (ECDSA, P256/passkeys, post-quantum) using the APPROVE opcode in VERIFY frames
  - title: Native Gas Sponsorship
    details: Third parties pay gas through sponsor VERIFY frames and canonical paymasters. No bundlers or relayers needed.
  - title: Atomic Batching
    details: Group multiple operations into atomic batches that succeed or revert together, natively at the protocol level
  - title: Post-Quantum Ready
    details: No ECDSA dependency in the transaction format. Accounts choose their own cryptographic scheme with signature aggregation built in.
  - title: EOA Native
    details: Built-in behavior for codeless accounts. EOAs get native AA without delegations, contract deployments, or state changes.
  - title: Two Specs in One
    details: The execution model allows arbitrary validation. The mempool model constrains it to propagatable shapes.
---

## How It Works

A frame transaction (`0x06`) consists of multiple **frames**, each with a mode that tells the protocol what the frame does:

| Mode | Name | Purpose |
|---|---|---|
| `DEFAULT` | Deployment | Deploy accounts, run post-operation hooks |
| `VERIFY` | Verification | Authenticate the sender, authorize payment - read-only, must call `APPROVE` |
| `SENDER` | Execution | Execute the user's intended operations (calls, transfers, contract interactions) |

### Example: Gas Sponsorship with ERC-20 Fees

| Frame | Mode | Target | What it does |
|---|---|---|---|
| 0 | VERIFY | sender | Verify sender signature, approve execution |
| 1 | VERIFY | sponsor | Verify sponsor, approve payment |
| 2 | SENDER | ERC-20 | Transfer fee tokens to sponsor |
| 3 | SENDER | target | Execute user's intended call |
| 4 | DEFAULT | sponsor | Post-op: refund overcharged fees |

No bundler, no EntryPoint contract, no off-chain infrastructure. The protocol handles it natively.

## EOAs Get Native Account Abstraction

One of EIP-8141's most significant properties: **EOAs don't need EIP-7702 to benefit from native account abstraction.**

With EIP-7702, an EOA must permanently delegate to a smart contract - a state change that persists on-chain, requires trusting the delegate contract's code, and introduces complexity around delegation management. With EIP-8141, none of that is needed.

The protocol has **built-in fallback behavior** for accounts with no code. When a frame targets a codeless account:

- **VERIFY frames**: The protocol verifies the signature (ECDSA or P256) and calls `APPROVE` - natively, without any deployed code
- **SENDER frames**: The protocol decodes the frame data as a list of calls and executes them with `msg.sender = tx.sender`

No code is ever deployed to the EOA - not temporarily, not permanently. The EOA stays codeless before, during, and after the transaction. There's truly zero state change to the account itself.

### Example: Gasless Uniswap LP Management

An EOA at address A holds a Uniswap v4 liquidity position. The user wants to rebalance their position range without paying gas:

| Frame | Mode | Target | What it does |
|---|---|---|---|
| 0 | VERIFY | A | Protocol verifies ECDSA signature, approves execution |
| 1 | VERIFY | sponsor | Sponsor authorizes gas payment |
| 2 | SENDER | Position Manager | `decreaseLiquidity(...)` - remove from old range |
| 3 | SENDER | Position Manager | `collect(...)` - collect tokens |
| 4 | SENDER | USDC | `transfer(sponsor, fee)` - pay sponsor in USDC |
| 5 | SENDER | Position Manager | `increaseLiquidity(...)` - add to new range |
| 6 | DEFAULT | sponsor | Post-op: refund overcharged gas fees |

Every SENDER frame executes with `msg.sender = A`. Uniswap sees the EOA as the caller - existing token approvals, NFT position ownership, and LP state all work as-is. The sponsor pays gas, the user compensates in USDC, and the EOA never changes. No delegation, no contract deployment, no migration.

With bit 11 (atomic batch flag) set on frames 2-5, those frames become all-or-nothing - if the collect or USDC transfer fails, the `decreaseLiquidity` reverts too, protecting the user from partial execution.

## New Opcodes

EIP-8141 introduces four new opcodes that give frame transactions their power:

| Opcode | Purpose |
|---|---|
| `APPROVE` | Terminates a VERIFY frame and sets transaction-scoped approval flags - scope `0x1` approves execution, `0x2` approves payment, `0x3` approves both |
| `TXPARAM` | Reads transaction parameters (sender, nonce, fees) from inside a frame - replaces `ORIGIN` for introspection |
| `FRAMEDATALOAD` | Loads 32 bytes from the current frame's `data` field - how account code reads signatures and calldata passed to a frame |
| `FRAMEDATACOPY` | Copies frame data to memory - bulk version of `FRAMEDATALOAD` for larger payloads |

`APPROVE` is the central innovation: it's how account code tells the protocol "I've verified this transaction - proceed." The other three opcodes give frame code access to the transaction and frame context it needs to make that decision.
