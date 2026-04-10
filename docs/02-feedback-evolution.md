# How Feedback Evolved Over Time

---

The feedback on EIP-8141 arrived in distinct waves, each pushing the spec along a clear trajectory: **from expressive abstraction toward deployability, compatibility, and mempool safety**. The early drafts prioritized flexibility; the later drafts are about making that flexibility survivable for clients, wallets, and the p2p network.

---

## Phase 1: Conceptual & Compatibility Scrutiny (Jan 29 – Feb 10)

### APPROVE Propagation Debate

*nlordell, frangio, fjl — EthMagicians posts #16-32*

The first major discussion was about how `APPROVE` interacts with nested call frames. Key questions:
- Does `APPROVE` auto-propagate through `RETURN`?
- Can inner contracts accidentally approve transactions?
- How do proxy-based smart accounts (like Safe) use `APPROVE` if it requires top-level invocation?

Resolution: The authors decided **against** auto-propagation. `APPROVE` is transaction-scoped and updates `sender_approved`/`payer_approved` directly. Only `frame.target` (checked via `ADDRESS == frame.target`) can call `APPROVE`. This was later relaxed (PR #11297) to allow `APPROVE` from nested calls, enabling proxy-based accounts to adopt 8141 more easily.

### "Why Not Simpler Alternatives?"

*Helkomine — posts #6-14*

Helkomine argued that command-oriented architectures like Uniswap's UniversalRouter could achieve the same functionality. Matt (lightclient) explained: frames exist for **protocol-level introspection** — allowing the p2p layer to reason about transaction validity bounds. The previous attempt (EIP-2938) had failed precisely because it lacked this structured introspection, making safe mempool relay rules impossible.

Key quote from matt (post #9):

> Frames are required to support introspection *by the protocol*. It's not about supporting multiple calls at the EVM layer. It's about allowing end users to flexibly define the way their transactions should be handled. The protocol can in turn, use the modes we're introducing to reason about the transaction and safely bound the resources needed to validate and propagate abstract transactions over p2p.

### EIP-3607 Compatibility

*thegaram33 — post #26, PR #11272*

Peter Garamvölgyi identified that EIP-3607 (which rejects transactions from senders with deployed code) would block 8141's `SENDER` frames for smart accounts. He submitted PR #11272 to disable this check for frame transactions. This PR remains open.

### APPROVE Security in Non-Account Contracts

*thegaram33 — posts #37-41*

thegaram33 raised the concern that any contract containing the `APPROVE` opcode could potentially be used as a frame target, creating an alternative authorization pathway. fjl responded that `APPROVE` is literally just `RETURN` with extra semantics — and execution approval only works when `frame.target == tx.sender`. This concern actually **reinforced** the design decision to restrict `APPROVE` to `frame.target`.

---

## Phase 2: Adoption & UX Concerns (Feb – Mar 10)

### EIP-7702 Adoption Data Battle

*DanielVF vs matt — posts #64-71*

DanielVF (from Monad) presented data showing only ~0.28% of transactions in 1000 blocks were EIP-7702. Matt countered that this metric was wrong — most 7702 usage goes through entrypoint contracts and "relayed actions" not direct transactions. BundleBear data showed 4M+ operations/week from 7702-enabled accounts. The disagreement highlighted a key insight: **measuring AA adoption requires looking at operations, not raw transaction counts**.

### The Adoption Critique

*DanielVF — post #64*

DanielVF made a comprehensive argument across three posts:
1. Smart contracts as asset owners is the "adoption killer" — wallets are expensive/dangerous to build, users get locked into vendors, no interoperability
2. EIP-1559 succeeded because it was simple and standardized; 4337/7702 failed because they required each wallet to build custom, dangerous smart contracts
3. If 99%+ of frame txns will be from EOAs, why not just build a simpler tx type?

Key quote from DanielVF (post #64):

> What are the bytes that a wallet sends over a transaction to authorize moving 1 Eth from one address to another? EIP-8141 at this moment doesn't define this. The authorizing address contract code could have any code under the sun, so we don't know what the wallet should send.

This argument directly influenced the spec's evolution toward EOA support.

### Derek Chiang's Response and EOA Support

*derek — posts #60, #65*

Derek Chiang, who had 3 years of commercial AA experience, largely agreed with DanielVF's adoption concerns and proposed EOA support for 8141. His argument:
- EOAs can enjoy AA benefits (gas abstraction, sponsorship) without smart contract risks
- Wallets integrate by supporting a new tx type, not building/auditing smart accounts
- Works consistently across all EVM chains without contract deployments
- Still preserves the option for advanced users to use smart contract accounts

Key quote from derek (post #62):

> It flips the default from "your EOA can't use any AA features unless you delegate to a smart account" to "your EOA can use most AA features by default, and can do more if you delegate to a smart account."

This led to PR #11379 (merged Mar 10), a pivotal change.

---

## Phase 3: Operational Constraints & Mempool Safety (Mar 10 – Mar 25)

### Async Execution Incompatibility

*DanielVF, pdobacz — posts #53, #79, #119-123*

The most structural criticism: frame transactions require EVM execution to determine transaction inclusion validity, which is fundamentally incompatible with async execution models (Monad, and potentially future Ethereum via EIP-7886). Traditional transactions only need 3 state reads (balance, nonce, code) for inclusion checks.

Impact assessment:
- Monad: frame txns are "mutually incompatible" with their async execution model
- Base: drafted EIP-8130 specifically as an alternative to EVM-driven inclusion
- Ethereum: constrains future performance optimizations

However, the authors argued this is manageable: FOCIL provides censorship resistance, mempool rules cap validation gas at 100k, and the `VERIFY` frame structure allows the protocol to bound validation costs.

### Atomic Batching Debate

*pedrouid, 0xrcinus, derekchiang, frangio — posts #72-89, PR #11395*

pedrouid argued SENDER frames should always be atomic. derekchiang explained why non-atomic is the better default:
- Non-atomicity is more general (OR logic) while atomicity is more specific (AND logic)
- A paymaster using VERIFY needs the guarantee that the ERC-20 transfer SENDER frame won't revert just because a subsequent user operation reverts
- Having top-level frames default to non-atomic while providing atomic opt-in is more elegant

Key quote from frangio (post #73, PR #11395 comment):

> The main use case I've heard for non-atomic frames is using ERC-20 for gas payment. The payer needs the guarantee that once it has accepted payment, the next frame will do an ERC-20 transfer and not revert.

0xrcinus proposed a GROUP-based approach (explicit group IDs). The final design used bit flags in the mode field — a consecutive run of SENDER frames with the atomic batch flag (bit 11) set forms an atomic batch.

### P256 Scope Creep

*shemnon, frangio — posts #78, #94-99*

Danno Ferrin flagged the addition of P256 signature support in the default code as "significant scope creep." frangio noted P256 accounts (via passkeys) don't support key rotation, undermining one of AA's motivations. The authors decided to keep P256 in the default code but acknowledged the tradeoff — it provides immediate utility for passkey users but creates accounts that can't be migrated to PQ-secure schemes without additional EIPs.

Key quote from shemnon (post #99):

> P256 on its own is a fine discussion to have, I am concerned that 8141 is becoming a kitchen sink EIP that will fall apart once one interest doesn't get what they want.

### PQ Signature Aggregation Path

*fjl — post #23*

A less discussed but strategically important point: fjl noted that the VERIFY frame design deliberately enables future **signature aggregation**. Because VERIFY frames cannot change execution outcomes and their data is elided from the signature hash, a block builder could theoretically strip all VERIFY frames from transactions and replace them with a single succinct proof of validity. This is a key part of the long-term PQ strategy — PQ signatures are large, and aggregation could dramatically reduce their on-chain cost. The precise mechanism isn't worked out yet, but the frame architecture was designed to keep this path open.

### Mempool Rules as Turning Point

*lightclient — post #112, PR #11415*

lightclient's mempool policy PR was a turning point. DanielVF called it "a big big step forwards" (post #114). Key innovations:
- **Canonical paymaster**: removes complex reputation/staking from ERC-7562 — a standardized paymaster contract that nodes verify by code match
- **Validation prefix**: only the frames up to `payer_approved = true` are subject to mempool rules
- **Capped validation gas**: MAX_VERIFY_GAS = 100,000
- **Structural templates**: four recognized validation prefixes for public mempool acceptance

---

## Phase 4: Alternative Proposals

Several alternative/competing proposals emerged:

- **EIP-8175 "Composable Transaction"** (rakita, PR #11355): A simpler alternative with no new opcodes, no execution frames, no per-frame gas accounting. The payer co-signs the transaction.
- **EIP-8130** (Base): Structured phases with verifiers instead of EVM-based validation, designed for performance chains.
- **Tempo Transaction** (Monad): Already shipped their own simpler tx type, rejecting frame transactions.

---

## Phase 5: Value, Precompiles, and Signature Aggregation (Mar 26 – Apr 9)

### VALUE in SENDER Frames

*rmeissner, DanielVF, frangio, 0xrcinus, derek, matt — posts #124-134*

rmeissner (Safe team) identified a gap: SENDER frames have no `value` property, preventing native ETH transfers without custom execute methods in smart accounts. This sparked strong consensus among participants.

DanielVF argued that without value, frames become "dumb message pipes" requiring full-featured smart contract wallets for basic operations. frangio agreed, noting it enables accounts to focus purely on verification. 0xrcinus called the value-in-frame approach "more intuitive."

Two approaches were proposed:
- **Option A**: Add a `value` field to frames + use the atomic flag for safety (preferred by Safe/rmeissner, 0xrcinus, and majority)
- **Option B**: Allow SENDER frames to `DELEGATECALL` a precompile implementing execute functionality

Key quote from rmeissner (post #130):

> Safe's preference is for removing DELEGATECALLs entirely, favoring value field with atomic flag instead. Formal verification is easier and stronger security guarantees.

Key quote from DanielVF (post #132):

> Value in SENDER frames enables clean separation between what the transaction does and authorization/payment. Removing value limits frames to "dumb message pipes," harming adoption and requiring full-featured smart contract wallets.

matt (post #134) confirmed the authors support including value in frames now that atomic batching exists, noting the previous hesitation was that value only works in SENDER frames, creating field mismatches. This is a strong signal that a value field will be added.

### Signature Aggregation Forward-Compatibility

*lightclient — PR #11481, April 2*

lightclient proposed adding a `signatures` field to the outer transaction object. The motivation is PQ forward-compatibility: PQ signatures are large, and aggregation will be critical as users migrate. The proposed design:

- A new `signatures` list in the outer transaction, each containing the signature, algorithm metadata, message, and signer
- Signatures are verified *before* frame execution, so frames can assume validity and just check authority
- In the future, block-level aggregated witnesses could elide individual signatures entirely

From lightclient's PR description:

> Any important goal of 8141 is to be forward compatible with signature aggregation techniques, especially with respect to PQ signatures. As those signatures are quite large, aggregating them may become very important as many users begin migrating.

This is the most structurally significant open proposal — it would change the transaction format itself.

### Precompile-Based Verification

*derekchiang — PR #11482, April 2*

derek proposed allowing VERIFY frames to target precompiles directly. This extends the default-code verification logic to contract accounts, enabling:

- Contract accounts to use precompiles for verification while having code for other purposes
- Key rotation (the precompile reads the public key commitment from storage)
- Shared verification logic between EOAs and contract accounts

This PR is still being worked on but represents a meaningful expansion of the verification model.

### EOA + EIP-7702 Delegation Compatibility

*DanielVF — posts #120, #122*

DanielVF identified that accounts with EIP-7702 delegated code cannot use signature-based authorization with frame transactions. When an EOA has delegated its code to a smart contract, the default code path isn't invoked, but the delegated contract may not implement `APPROVE`. This is a gap that needs addressing.

### Async Execution Compatibility (Continued)

*DanielVF, derek — posts #121-123*

The async execution thread continued. DanielVF pointed derek to ethresearch threads and EIP-7886, mentioning an upcoming EthCC talk. derek asked for more resources to ensure frame transactions remain compatible with Ethereum's potential move toward async execution.

### Spec Consistency Fixes

*node.cm, chiranjeev13 — posts #135-136, PR #11488*

node.cm (new participant) identified that VERIFY frames are implicitly capped at 2 per transaction, since only two approval flags exist (`sender_approved` and `payer_approved`) and each can only be set once. They recommended making this explicit in the Constraints section.

chiranjeev13 followed up with PR #11488 fixing multiple spec inconsistencies:
- Add static VERIFY frame count check (`<= 2`) to constraints
- Fix stale APPROVE scope values in the structural rules
- Remove `frame.target != tx.sender` check from default VERIFY code to allow any EOA as paymaster

### Signature Index Discovery Problem

*derekchiang — PR #11481 comment, Apr 9*

derekchiang raised a practical concern with lightclient's signatures list proposal (PR #11481): smart contracts leveraging outer signatures have no way to know which index their signature occupies in the list. Since a transaction may have any number of signatures in arbitrary order, a contract can't hardcode an index. The updated default code has to loop through the entire signature list to find the relevant entry — an ergonomic and gas-efficiency weakness that may need addressing before the proposal can be finalized.

### EIP-3607 Compatibility Status Update

*lightclient — PR #11272, Apr 8*

lightclient's earlier review on the EIP-3607 compatibility PR (#11272, disabling the EIP-3607 check for frame transactions) was dismissed on Apr 8. The PR remains open without resolution — the interaction between EIP-3607's sender-has-code rejection and frame transactions for smart accounts is still an unresolved design question.

