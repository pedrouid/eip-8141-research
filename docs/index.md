---
layout: home
hero:
  name: EIP-8141
  text: Frame Transaction
  tagline: Native account abstraction and post-quantum readiness for Ethereum — one transaction type, multiple frames, programmable validation
  actions:
    - theme: brand
      text: Read the Spec Overview
      link: /01-current-spec
    - theme: alt
      text: Competing Standards
      link: /06-competing-standards
    - theme: alt
      text: View on GitHub
      link: https://github.com/pedrouid/eip-8141-research
features:
  - title: Programmable Validation
    details: Any account can define its own signature verification — ECDSA, P256/passkeys, post-quantum schemes — using the APPROVE opcode in VERIFY frames
  - title: Native Gas Sponsorship
    details: Third parties pay gas on behalf of users through sponsor VERIFY frames and canonical paymasters — no bundlers or off-chain relayers required
  - title: Atomic Batching
    details: Group multiple operations (approve + swap, multi-send) into atomic batches that succeed or revert together, natively at the protocol level
  - title: Post-Quantum Ready
    details: No ECDSA dependency in the transaction format — accounts choose their own cryptographic scheme, with signature aggregation designed in from day one
  - title: EOA Compatible
    details: Built-in default code means any existing EOA can send frame transactions today with ECDSA or P256 — no smart contract deployment needed
  - title: Two Specs in One
    details: The execution model allows arbitrary validation; the mempool model constrains it to propagatable shapes — making programmability survivable for the network
---

## How It Works

A frame transaction (`0x06`) consists of multiple **frames**, each with a mode that tells the protocol what the frame does:

| Mode | Name | Purpose |
|---|---|---|
| `VERIFY` | Verification | Authenticate the sender, authorize payment — read-only, must call `APPROVE` |
| `SENDER` | Execution | Execute the user's intended operations (calls, transfers, contract interactions) |
| `DEFAULT` | Deployment | Deploy accounts, run post-operation hooks |

### Example: Gas Sponsorship with ERC-20 Fees

| Frame | Mode | Target | What it does |
|---|---|---|---|
| 0 | VERIFY | sender | Verify sender signature, approve execution |
| 1 | VERIFY | sponsor | Verify sponsor, approve payment |
| 2 | SENDER | ERC-20 | Transfer fee tokens to sponsor |
| 3 | SENDER | target | Execute user's intended call |
| 4 | DEFAULT | sponsor | Post-op: refund overcharged fees |

No bundler, no EntryPoint contract, no off-chain infrastructure. The protocol handles it natively.

## New Opcodes

EIP-8141 introduces four new opcodes that give frame transactions their power:

| Opcode | Purpose |
|---|---|
| `APPROVE` | Terminates a VERIFY frame and sets transaction-scoped approval flags — scope `0x1` approves execution, `0x2` approves payment, `0x3` approves both |
| `TXPARAM` | Reads transaction parameters (sender, nonce, fees) from inside a frame — replaces `ORIGIN` for introspection |
| `FRAMEDATALOAD` | Loads 32 bytes from the current frame's `data` field — how account code reads signatures and calldata passed to a frame |
| `FRAMEDATACOPY` | Copies frame data to memory — bulk version of `FRAMEDATALOAD` for larger payloads |

`APPROVE` is the central innovation: it's how account code tells the protocol "I've verified this transaction — proceed." The other three opcodes give frame code access to the transaction and frame context it needs to make that decision.

## Sources

- [EIP-8141 Spec](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8141.md)
- [All Related PRs](https://github.com/ethereum/EIPs/pulls?q=is%3Apr+8141)
- [Ethereum Magicians Discussion (136 posts)](https://ethereum-magicians.org/t/frame-transaction/27617)
