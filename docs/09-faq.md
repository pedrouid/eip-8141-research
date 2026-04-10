# Frequently Asked Questions

---

## General

**What is EIP-8141?**
A new transaction type (`0x06`) that splits a transaction into multiple frames — each with a purpose (verify, execute, deploy) — giving every account programmable validation and native batching at the protocol level. [Read the spec overview →](/01-current-spec)

**What problem does it solve?**
Today, advanced transaction features (gas sponsorship, batching, custom signatures) require off-chain infrastructure and smart contract middleware. EIP-8141 moves these capabilities into the protocol itself.

**What are frames?**
Ordered steps within a single transaction. Each frame has a mode — `VERIFY` (authenticate), `SENDER` (execute), or `DEFAULT` (deploy/post-op) — that tells the protocol what the frame does. [See frame modes →](/01-current-spec#frame-modes)

**Is EIP-8141 live on mainnet?**
No. It is a draft EIP under active development targeting a future hard fork. [Track progress on GitHub →](https://github.com/ethereum/EIPs/pulls?q=is%3Apr+8141)

**What new opcodes does it introduce?**
Four: `APPROVE` (authorize execution/payment), `TXPARAM` (read tx parameters), `FRAMEDATALOAD` and `FRAMEDATACOPY` (read frame data). [Details →](/01-current-spec#the-approve-mechanism)

---

## ERC-4337 & Bundlers

**Does EIP-8141 replace ERC-4337?**
Yes. EIP-8141 is the native protocol successor to ERC-4337 — it moves account abstraction into the transaction layer, eliminating the need for bundlers, the EntryPoint contract, and off-chain UserOperation infrastructure entirely.

**Why are bundlers no longer needed?**
The protocol itself handles validation, gas payment, and execution ordering through frames. There is no separate UserOperation mempool — frame transactions use the standard public mempool.

**What about existing ERC-4337 wallets?**
Smart accounts built for ERC-4337 can migrate their validation logic into VERIFY frames. The core verification code (signature checks, access policies) is reusable — what changes is how it's invoked.

**Does this affect ERC-4337 paymaster contracts?**
Yes. EIP-8141 introduces its own [canonical paymaster mechanism](/01-current-spec#mempool-policy) at the protocol level, replacing ERC-4337's paymaster interface.

**What happens to bundler operators?**
The bundler role is absorbed by the protocol and standard block builders. There is no separate bundler market or infrastructure to maintain.

---

## EIP-7702 & Account Delegation

**Does EIP-8141 replace EIP-7702?**
For most use cases, yes. EIP-7702 requires EOAs to permanently delegate to a smart contract — a persistent on-chain state change. EIP-8141 gives EOAs native AA without any delegation, code deployment, or state change. [See EOA default code →](/01-current-spec#eoa-default-code)

**Can 7702-delegated accounts still use EIP-8141?**
Yes. EIP-7702 accounts can send frame transactions — the two are complementary. However, 7702 delegation is no longer necessary for EOAs to access batching, sponsorship, or custom signatures.

**Why is removing the 7702 dependency important?**
EIP-7702 relies on ECDSA for its authorization list, making it incompatible with post-quantum signature schemes. EIP-8141 has no authorization list — accounts choose their own cryptography. [See competing standards →](/06-competing-standards#key-differences-from-eip-8141)

---

## Users

**What does EIP-8141 mean for regular users?**
Users get gas sponsorship, atomic batching, and passkey/biometric signing without needing to deploy smart contracts, migrate to new addresses, or rely on third-party relayers.

**Can I keep my existing EOA address?**
Yes. EOAs work natively with frame transactions — no code deployment, no delegation, no address change. Your account stays codeless before, during, and after the transaction.

**Can I pay gas in ERC-20 tokens?**
Yes. A sponsor pays ETH gas on your behalf, and a SENDER frame transfers ERC-20 tokens to compensate them — all within one atomic transaction. [Example →](/01-current-spec#practical-use-cases)

**Can I batch multiple actions in one transaction?**
Yes. Multiple SENDER frames execute sequentially, and consecutive frames with the atomic flag revert together if any fails. [See atomic batching →](/01-current-spec#atomic-batching)

**Do I need a smart contract wallet to use this?**
No. The protocol has built-in default behavior for codeless accounts — ECDSA and P256 signature verification, and multi-call decoding in SENDER frames. [Details →](/01-current-spec#eoa-default-code)

**Is this compatible with passkeys / biometrics?**
Yes. The EOA default code supports P256 signatures natively, which covers Apple/Google passkeys and WebAuthn without any contract deployment.

---

## Wallet Developers

**How does EIP-8141 reduce wallet development overhead?**
Bundler infrastructure, UserOperation formatting, EntryPoint ABI compatibility, and ERC-4337 paymaster integration all go away. Wallets construct a standard transaction with frames instead.

**Do wallets still need to run or depend on bundlers?**
No. Frame transactions enter the public mempool like any other transaction. No separate bundler endpoint, no bundler selection, no bundler availability concerns.

**Does this reduce vendor dependency?**
Yes. Today, wallets depend on bundler providers (Pimlico, Alchemy, etc.) for AA functionality. With EIP-8141, the protocol is the infrastructure — any Ethereum node can validate and propagate frame transactions.

**What about gas sponsorship infrastructure?**
Wallets interact with the canonical paymaster directly at the protocol level. No paymaster service API, no vendor SDK, no third-party uptime dependency for basic sponsorship flows.

**Can wallets still build custom validation logic?**
Yes. VERIFY frames execute arbitrary account code — wallets can implement multisig, social recovery, session keys, or any scheme. The [mempool policy](/01-current-spec#mempool-policy) constrains what's publicly relayable, but custom logic is valid on-chain.

**What's the migration path from ERC-4337?**
Move validation logic from `validateUserOp` into VERIFY frame code that calls `APPROVE`. Replace bundler submission with standard transaction broadcasting. Replace EntryPoint paymaster calls with canonical paymaster VERIFY frames.

---

## Post-Quantum Readiness

**Is EIP-8141 post-quantum safe?**
The transaction format itself has no ECDSA dependency. Accounts choose their own signature scheme in VERIFY frames — any PQ algorithm can be used without protocol changes.

**How does this compare to other proposals?**
EIP-8141 offers the most flexible PQ path (arbitrary schemes). EIP-8202 uses [ephemeral one-time ECDSA keys](https://ethereum-magicians.org/t/eip-8202-schemed-transaction/28044). EIP-8130 requires deploying PQ verifier contracts. [Full comparison →](/06-competing-standards#pq-readiness)

---

## Mempool & Network Health

**How do nodes validate frame transactions?**
Nodes execute the VERIFY frames and check that `APPROVE` is called. The [mempool policy](/01-current-spec#mempool-policy) restricts validation to recognized prefixes with bounded gas and banned opcodes.

**What is the canonical paymaster?**
A standardized paymaster contract recognized by mempool policy. Nodes verify it by runtime code match and track reserved balances for pending transactions. [Spec details →](/01-current-spec#mempool-policy)

**What if wallets don't adopt the canonical paymaster?**
Transactions using non-canonical paymasters cannot propagate through the public mempool or be enforced by FOCIL inclusion lists — degrading censorship resistance for those users. [See concern #4 →](/08-pending-concerns#4-the-canonical-paymaster-adoption-risk)

**Does this affect censorship resistance?**
Potentially. Mempool health is censorship resistance — if minimal nodes can't validate certain frame transactions, those transactions lose public propagation guarantees. [See concern #3 →](/08-pending-concerns#3-mempool-health-is-censorship-resistance)

---

## Statelessness & Scalability

**How does EIP-8141 interact with statelessness goals?**
Frame transaction validation requires more state access than legacy transactions (~100k gas vs ~3k gas). This tensions with VOPS (Validity-Only Partial Statelessness) nodes that carry minimal state. [See concern #1 →](/08-pending-concerns#1-stateless-validation-is-fundamentally-harder-for-frame-transactions)

**What is the "choose 2 of 3" trilemma?**
The observation that current designs cannot simultaneously deliver Frames/Native AA, Public Mempool/FOCIL, and Statelessness/VOPS — you can have at most two. [See concern #7 →](/08-pending-concerns#7-the-choose-2-of-3-trilemma)

**Is there a workaround for VOPS compatibility?**
A witness-based approach (transactions carry proofs for state accessed outside VOPS) has been proposed, but it adds significant complexity — ~4 kB per extra storage slot. [See concern #8 →](/08-pending-concerns#8-witness-based-focil-compatibility--possible-but-complex)

**What about encrypted mempools?**
Encrypted mempools (e.g., LUCID protocol) are fundamentally incompatible with frame transaction validation — nodes can't check fields needed for DOS prevention if contents are encrypted. [See concern #5 →](/08-pending-concerns#5-encrypted-mempools-are-incompatible)

**How much extra state do nodes need?**
At full AA adoption with 4 cached storage slots per account, VOPS nodes would need ~72 GB total — an 8x increase from today's ~10 GB floor. [See concern #2 →](/08-pending-concerns#2-vops-nodes-and-the-state-growth-problem)

---

## Competing Proposals

**What are the alternatives to EIP-8141?**
Three competing proposals: EIP-8130 (declared verifiers, no EVM in validation), EIP-8202 (scheme-agile flat transactions), and a Tempo-like proposal (fixed UX primitives). [Full comparison →](/06-competing-standards)

**Which is most likely to ship?**
Unclear. EIP-8141 is the most comprehensive but also the most complex. EIP-8130 has strong Base/Coinbase backing. EIP-8202 and Tempo are earlier stage. [See activity comparison →](/06-competing-standards#adoption-positioning)

**Can EIP-8130 be built on top of EIP-8141?**
Yes — declared verifiers are a subset of what VERIFY frames can do. The reverse is not true. This is a key argument from EIP-8141 proponents.

---

## Implementation & Timeline

**Is implementation complexity a concern?**
Yes. Frame transactions touch consensus, mempool policy, p2p propagation, client state management, and wallet infrastructure simultaneously. This breadth is a contributing factor to Glamsterdam delays. [See concern #9 →](/08-pending-concerns#9-implementation-complexity-and-scope)

**Where can I follow the spec development?**
- [EIP-8141 spec on GitHub](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8141.md)
- [All related PRs](https://github.com/ethereum/EIPs/pulls?q=is%3Apr+8141)
- [Ethereum Magicians discussion](https://ethereum-magicians.org/t/frame-transaction/27617)
- [Statelessness concerns on ethresear.ch](https://ethresear.ch/t/frame-transactions-through-a-statelessness-lens/24538)

---

*For the full list of open concerns, see [Pending Concerns →](/08-pending-concerns)*
