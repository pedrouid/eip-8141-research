# How Feedback Evolved Over Time

---

The feedback on EIP-8141 arrived in distinct waves, each pushing the spec along a clear trajectory: **from expressive abstraction toward deployability, compatibility, and mempool safety**. The early drafts prioritized flexibility; the later drafts are about making that flexibility survivable for clients, wallets, and the p2p network.

---

## Phase 1: Conceptual & Compatibility Scrutiny (Jan 29 – Feb 10)

*In this phase, the thread tested whether the `APPROVE` mechanism and the frame abstraction held up under proxy-account, nested-call, and ecosystem-compatibility pressure. The core design question was: does this new opcode actually behave safely across the call-graph shapes real accounts use?*

### APPROVE Propagation Debate

*nlordell, frangio, fjl — EthMagicians posts #16-32*

The first major discussion was about how `APPROVE` interacts with nested call frames. Key questions:
- Does `APPROVE` auto-propagate through `RETURN`?
- Can inner contracts accidentally approve transactions?
- How do proxy-based smart accounts (like Safe) use `APPROVE` if it requires top-level invocation?

Resolution: The authors decided **against** auto-propagation. `APPROVE` is transaction-scoped and updates `sender_approved`/`payer_approved` directly. Only `frame.target` (checked via `ADDRESS == frame.target`) can call `APPROVE`. This was later relaxed (PR #11297) to allow `APPROVE` from nested calls, enabling proxy-based accounts to adopt 8141 more easily.

### "Why Not Simpler Alternatives?"

*Helkomine — posts #6-14*

Helkomine argued that command-oriented architectures like Uniswap's UniversalRouter could achieve the same functionality. Matt (lightclient) explained: frames exist for **protocol-level introspection**, allowing the p2p layer to reason about transaction validity bounds. The previous attempt (EIP-2938) had failed precisely because it lacked this structured introspection, making safe mempool relay rules impossible.

Key quote from matt (post #9):

> Frames are required to support introspection *by the protocol*. It's not about supporting multiple calls at the EVM layer. It's about allowing end users to flexibly define the way their transactions should be handled. The protocol can in turn, use the modes we're introducing to reason about the transaction and safely bound the resources needed to validate and propagate abstract transactions over p2p.

### EIP-3607 Compatibility

*thegaram33 — post #26, PR #11272*

Peter Garamvölgyi identified that EIP-3607 (which rejects transactions from senders with deployed code) would block 8141's `SENDER` frames for smart accounts. He submitted PR #11272 to disable this check for frame transactions. This PR remains open.

### APPROVE Security in Non-Account Contracts

*thegaram33 — posts #37-41*

thegaram33 raised the concern that any contract containing the `APPROVE` opcode could potentially be used as a frame target, creating an alternative authorization pathway. fjl responded that `APPROVE` is literally just `RETURN` with extra semantics, and execution approval only works when `frame.target == tx.sender`. This concern actually **reinforced** the design decision to restrict `APPROVE` to `frame.target`.

**What changed because of this phase**: `APPROVE` semantics locked down to transaction-scoped with an `ADDRESS == frame.target` check, then relaxed via PR #11297 to allow `APPROVE` from nested calls so proxy-based accounts (Safe-style) could adopt the spec. EIP-3607 compatibility opened as PR #11272.

---

## Phase 2: Adoption & UX Concerns (Feb – Mar 10)

*The thread pivoted from "does this work?" to "will anyone use it?" Monad's adoption data and Derek Chiang's commercial-AA experience reframed the question: if nearly all frame transactions will come from EOAs, the spec has to serve EOAs natively or lose to a simpler alternative.*

### EIP-7702 Adoption Data Battle

*DanielVF vs matt — posts #64-71*

DanielVF (from Monad) presented data showing only ~0.28% of transactions in 1000 blocks were EIP-7702. Matt countered that this metric was wrong: most 7702 usage goes through entrypoint contracts and "relayed actions" not direct transactions. BundleBear data showed 4M+ operations/week from 7702-enabled accounts. The disagreement highlighted a key insight: **measuring AA adoption requires looking at operations, not raw transaction counts**.

### The Adoption Critique

*DanielVF — post #64*

DanielVF made a comprehensive argument across three posts:
1. Smart contracts as asset owners is the "adoption killer": wallets are expensive/dangerous to build, users get locked into vendors, no interoperability
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

**What changed because of this phase**: EOA default code added via PR #11379 (Mar 10). This was the single biggest shift in the spec's trajectory, moving it from "smart-account-assumed" to "EOA-first." Every downstream design decision (default VERIFY code, default SENDER code, paymaster-by-EOA) followed from here.

---

## Phase 3: Operational Constraints & Mempool Safety (Mar 10 – Mar 25)

*With EOA support landed, attention shifted to making frame transactions safely propagatable and performant at the p2p layer. The async-execution critique (from Monad), the atomic-batching debate, and the mempool policy dominated. These are all operational questions about whether clients and builders can actually ship this.*

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

0xrcinus proposed a GROUP-based approach (explicit group IDs). The final design used bit flags in the mode field: a consecutive run of SENDER frames with the atomic batch flag (bit 11) set forms an atomic batch.

### P256 Scope Creep

*shemnon, frangio — posts #78, #94-99*

Danno Ferrin flagged the addition of P256 signature support in the default code as "significant scope creep." frangio noted P256 accounts (via passkeys) don't support key rotation, undermining one of AA's motivations. The authors decided to keep P256 in the default code but acknowledged the tradeoff: it provides immediate utility for passkey users but creates accounts that can't be migrated to PQ-secure schemes without additional EIPs.

Key quote from shemnon (post #99):

> P256 on its own is a fine discussion to have, I am concerned that 8141 is becoming a kitchen sink EIP that will fall apart once one interest doesn't get what they want.

### PQ Signature Aggregation Path

*fjl — post #23*

A less discussed but strategically important point: fjl noted that the VERIFY frame design deliberately enables future **signature aggregation**. Because VERIFY frames cannot change execution outcomes and their data is elided from the signature hash, a block builder could theoretically strip all VERIFY frames from transactions and replace them with a single succinct proof of validity. This is a key part of the long-term PQ strategy: PQ signatures are large, and aggregation could dramatically reduce their on-chain cost. The precise mechanism isn't worked out yet, but the frame architecture was designed to keep this path open.

### Mempool Rules as Turning Point

*lightclient — post #112, PR #11415*

lightclient's mempool policy PR was a turning point. DanielVF called it "a big big step forwards" (post #114). Key innovations:
- **Canonical paymaster**: removes complex reputation/staking from ERC-7562, replacing it with a standardized paymaster contract that nodes verify by code match
- **Validation prefix**: only the frames up to `payer_approved = true` are subject to mempool rules
- **Capped validation gas**: MAX_VERIFY_GAS = 100,000
- **Structural templates**: four recognized validation prefixes for public mempool acceptance

Alternative and competing proposals (EIP-8175, EIP-8130, Tempo) emerged around this period; they are documented in [Competing Standards](/competing-standards) and their per-EIP pages rather than as timeline entries here.

**What changed because of this phase**: atomic-batch flag added (PR #11395, Mar 25). Comprehensive mempool policy merged (PR #11415, Mar 25) with canonical paymaster, validation-prefix templates, banned opcodes, and MAX_VERIFY_GAS = 100k. These turned EIP-8141 from a spec into something clients could begin implementing.

---

## Phase 4: Forward-Compatibility Extensions & Open Gaps (Mar 26 – Apr 10)

*With the core spec landed, the thread moved into extension territory: forward-compat hooks for PQ signature aggregation and precompile-based verification, plus a steady stream of open gaps (EIP-7702 interaction, EIP-3607, signature-index discovery, frame-returndata) that needed decisions before the spec could be called complete.*

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

This is the most structurally significant open proposal; it would change the transaction format itself.

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

### EIP-3607 Compatibility Status Update

*lightclient — PR #11272, Apr 8*

lightclient's earlier review on the EIP-3607 compatibility PR (#11272, disabling the EIP-3607 check for frame transactions) was dismissed on Apr 8. The PR remains open without resolution. The interaction between EIP-3607's sender-has-code rejection and frame transactions for smart accounts is still an unresolved design question.

### Signature Index Discovery Problem

*derekchiang — PR #11481 comment, Apr 9*

derekchiang raised a practical concern with lightclient's signatures list proposal (PR #11481): smart contracts leveraging outer signatures have no way to know which index their signature occupies in the list. Since a transaction may have any number of signatures in arbitrary order, a contract can't hardcode an index. The updated default code has to loop through the entire signature list to find the relevant entry, an ergonomic and gas-efficiency weakness that may need addressing before the proposal can be finalized.

### Frame Return Data Access

*jacopo-eth — post #137, Apr 10*

Jacopo raised that access to frame returndata would enable using it as input in multi-step flows without requiring wrapper contracts (similar to the motivation behind ERC-8211). He proposed native support via `FRAMERETURNDATASIZE` and `FRAMERETURNDATACOPY` opcodes, with per-byte gas cost and a cap per frame. No author response yet.

**What changed because of this phase**: community consensus built around adding a per-frame `value` field (posts #124-134). Signature-aggregation (PR #11481) and precompile-VERIFY (PR #11482) proposals entered review, both with all-reviewer approval pending merge. Spec-consistency PR #11488 opened. No merges landed yet. This phase set up the pivot that followed.

---

## Phase 5: Sibling EIPs and Broad Spec Tightening (Apr 11 – Apr 15)

*Ben Adams produced three PRs in five days: two narrower sibling EIPs (EIP-8223 for static sponsorship, EIP-8224 for shielded gas funding) and a 295-line tightening PR that restructured the spec's internal consistency. The character of the thread shifted from "proposals and debates" to "structural changes landing."*

### Contract Payer Transaction (EIP-8223)

*benaadams — PR #11509, Apr 11*

In parallel with the tightening PR, Ben Adams submitted EIP-8223 (PR #11509), a narrower sponsored-transaction proposal where gas fees are charged to `tx.to` via a canonical payer-registry predeploy at `0x13`. Validation requires one SLOAD and one balance check with no EVM execution, making it FOCIL/VOPS-compatible. The PR description explicitly positions EIP-8223 as complementary to EIP-8141 and EIP-8175 rather than competing: EIP-8223 covers the narrow case where static validation is sufficient, while frame-based proposals handle the general case. The registry mechanism could also be expressed as a capability or frame mode within those formats.

### Counterfactual Transaction (EIP-8224)

*benaadams — PR #11518, Apr 12*

A day later, Ben Adams submitted EIP-8224 (PR #11518), addressing the bootstrap problem that remains even after EIP-8223: a fresh EOA with no ETH cannot pay gas privately, because receiving ETH from any source creates a traceable on-chain link. EIP-8224 introduces a new transaction type (`0x08`) carrying an fflonk ZK proof (over BN254) that the sender owns an unspent fee note in a canonical fee-note contract (recognized by code hash). Validation is bounded cryptographic computation plus fixed storage reads, no EVM execution, ~222K gas typical. The intended composition: one-shot bootstrap via EIP-8224 to fund a smart account, then transition to cheap sponsored transactions via EIP-8223. Together with EIP-8141, the three proposals form a layered stack for general-purpose AA, static sponsorship, and shielded gas funding.

### Validation Frame Ordering Within a Block

*fvictorio — post #138, Apr 13*

Franco Victorio asked whether validation frames of frame transactions are executed first within a block, before non-frame transactions and non-validation frames, drawing an analogy to how ERC-4337 separates validation and execution phases. The question is about block-level scheduling, not transaction-level ordering, and remains unanswered in the thread.

### Broad Spec Tightening (Merged)

*benaadams — PR #11521, submitted Apr 13, merged Apr 14*

Ben Adams submitted a 295-line spec tightening PR consolidating several open threads: splitting `mode`/`flags`, introducing `FRAMEPARAM` and `resolved_target`, hardening default secp256k1/P256 paths (low-`s`, P256 domain separation), reducing `MAX_FRAMES` from 1000 to 64, adding per-frame gas costs, locking deterministic deployment to EIP-7997, and strengthening security warnings around VERIFY-data malleability and DELEGATECALL + APPROVE. lightclient and derekchiang both approved. fjl questioned lowering MAX_FRAMES, but benaadams argued that journaling carries across frames (up to 2000 effective call depth) and it is easier to increase later after measurement. This is the broadest restructuring since PR #11401 (approval bits) and the first to add a fifth opcode (`FRAMEPARAM`) to the spec.

### Bytecodes in VOPS Proposal

*derekchiang — ethresear.ch post #12, Apr 15*

derekchiang proposed adding contract bytecodes to the VOPS baseline, noting that total contract bytecode is ~10.55 GB (as of 2024). Including it roughly doubles the VOPS size but stays well below the ~280 GB full state. This directly addresses the bytecode availability gap identified in [VOPS state growth](/vops-compatibility#state-growth-at-scale) and the [AA-VOPS discussion](https://ethresear.ch/t/a-pragmatic-path-towards-validity-only-partial-statelessness-vops/22236): the original VOPS proposal bounded storage reads to N slots per account but did not address how AA-VOPS nodes obtain delegate bytecodes. Including bytecodes in the baseline resolves this without new opcodes or rent mechanisms.

**What changed because of this phase**: PR #11521 merged Apr 14, bringing the mode/flags split, the `FRAMEPARAM` opcode (fifth opcode in the spec), `MAX_FRAMES` reduced to 64, per-frame gas cost added, and default-code hardening for secp256k1 and P256. EIP-8223 (PR #11509) and EIP-8224 (PR #11518) submitted as complementary sibling proposals rather than competitors. Bytecodes-in-VOPS reframing surfaced on ethresear.ch.

---

## Phase 6: Value Field and Fork Inclusion (Apr 16 – Apr 19)

*The pending `value` field consensus landed and the proposal entered formal fork-inclusion governance. External analysis (Nero_eth's three-gates post) began shaping the next wave of discussion around privacy-pool flows, and forum debate reopened the default-code-vs-7702 delegation interaction.*

### Per-Frame Value (Merged)

*lightclient — PR #11534, submitted and merged Apr 16*

lightclient merged the long-requested `value` field two days after PR #11521 landed, resolving the consensus that had built up across posts #124-134 (rmeissner, DanielVF, frangio, 0xrcinus, derek, matt). The PR description captures the reversal plainly: the authors originally resisted a frame-level `value` because user operations were expected to be handled by the account itself, but with frames now aimed at delivering a good out-of-the-box experience without wallet-side batching, native `value` became "a critical field for the SENDER frame." Non-zero `value` is restricted to `SENDER` frames so that `VERIFY` remains `STATICCALL`-like and `DEFAULT` does not require `ENTRY_POINT` to fund transfers. A subtle default-code consequence: when a SENDER frame's `resolved_target != tx.sender`, the default code now returns successfully with empty data (matching an empty-code account) rather than reverting, because the top-level `value` transfer has already been applied by the frame call. The PR was auto-merged after all reviewers approved; no debate on the merged diff.

### Three Gates to Privacy

*Nero_eth — [ethresear.ch post](https://ethresear.ch/t/frame-transactions-and-the-three-gates-to-privacy/24666), Apr 16*

Nero_eth framed privacy-pool inclusion as a three-gate problem: public mempool (100k VERIFY cap rejects Groth16 ~250k gas), FOCIL enforcement (250k per-IL budget fits roughly two frame transactions), and VOPS/AA-VOPS node validation (nullifier slots are hash-keyed in an external pool contract, outside the VOPS+4 window). The useful observation for EIP-8141: frames structurally remove relayer trust in privacy flows, because invalid or replayed proofs revert in VERIFY before gas is charged, so a sponsor can be paid from the withdrawn amount itself with zero trust assumption. Five protocol changes proposed: canonical-pool code-hash exemption, ~400k per-tx VERIFY cap for canonical frames, validation-index FOCIL enforcement `(tx_hash, claimed_index)`, `MAX_VERIFY_GAS_PER_INCLUSION_LIST = 2^20`, and relaxed state access for canonical pools. Acknowledged tradeoff: attesters absorb up to ~28% block gas in the worst case under the validation-index model. The proposals are routed into the research repo under [Mempool Strategy → Privacy Pools and the Three Gates](/mempool-strategy#privacy-pools-three-gates).

### Value Field Announced on Forum

*derek (post #139, Apr 17), DanielVF (post #140, Apr 17)*

derek announced the value-field merge on the forum, linking the commit. DanielVF welcomed it and named two remaining priorities he wants addressed before the proposal is production-ready: (1) the default signature-handling path should become an explicit opt-in rather than a protocol default, to future-proof transactions against sig-scheme changes, and (2) atomic batching of frames needs to become practically usable, not just structurally defined. These are framed as the last blockers from the wallet/adoption side before he considers the spec complete for deployment.

### Hegotá CFI Inclusion

*dionysuzx — PR #11537, Apr 17*

dionysuzx opened a PR against EIP-8081 (the Hegotá fork meta EIP) adding EIP-8141 to the `Considered for Inclusion` list, plus EIP-7716 and EIP-8205 to `Proposed for Inclusion`. Decisions were captured at ACDE #233 (timestamp 5871s) and ACDC #177 (timestamps 3532s and 3853s). This formalizes a fork-inclusion status that had been assumed based on strawmap signals but not yet committed to the meta EIP. The PR requires one more reviewer approval from @ralexstokes or @timbeiko.

### Default Code vs 7702 Delegation Interaction

*DanielVF, derek, alex-forshtat-tbk — posts #141-145, Apr 17-19*

DanielVF raised that a 7702-delegated EOA today can choose per-transaction whether to invoke its delegation or send a "regular transaction" that bypasses the delegation code, because the transaction-type envelope encodes that intent explicitly. Under the current EIP-8141 rule ("if there's code, use the code, otherwise use the default code"), a 7702-delegated EOA loses that choice: the delegation code always wins. DanielVF argued for restoring explicit opt-in via a flag byte in `frame.data` selecting between default-code paths and the 7702 delegation. derek agreed the inconsistency is interesting but questioned the implementation. alex-forshtat-tbk observed that the existing `signature_type` first byte already acts as an EOA-scoped flag (`0x0` for ecrecover, `0x1` for P256VERIFY) and proposed extending it with `0x2` meaning "use 7702 code." No PR yet; sits on top of the 7702-delegation + default-code gap already flagged in the current-spec Related Proposals table.

**What changed because of this phase**: per-frame `value` merged (PR #11534, Apr 16). EIP-8141 formally submitted to the Hegotá CFI list via PR #11537 (still pending one reviewer). The next wave of discussion opened with Nero_eth's three-gates analysis, focused on how frame transactions interact with privacy pools under FOCIL and VOPS constraints.

---

## Phase 7: Guarantors, Sighash Security, and Mempool Relaxations (Apr 22 – Apr 29)

*Phase 7 opens with a same-day pairing on Apr 22: a small security cleanup aligning the sighash with EIP-2718, and the first of two mempool-policy proposals from derekchiang that reframe long-standing restrictions. The guarantors PR proposes an economic-risk workaround (a payer that commits to paying gas even if sender validation fails) that lets mempool nodes skip sender simulation entirely, which would open ERC-20 gas repayment with trustless onchain verification to public propagation without the VOPS/statelessness tradeoffs that motivated the original restriction. Two days later, a second PR drops EIP-7997 from `requires` and relaxes the deploy-frame rule so any stateless factory qualifies. The phase closes with two follow-ups from lightclient: a cleanup that removes the now-redundant RLP call batching from the default account, and an alternative framing of the guarantors problem (allow payer to approve before sender) that briefly auto-merged in error before being reverted. The two mempool PRs push the restrictive tier toward a more rule-based, less named-contract-dependent policy. This phase sits at the beginning of its discussion arc, not the end.*

### Transaction-Type Sighash Fix (Merged)

*derekchiang — PR #11544, submitted Apr 18, merged Apr 22*

derekchiang opened a 1-line PR fixing a cross-type signature replay weakness in `compute_sig_hash`: the existing `keccak(rlp(tx_copy))` omits the `FRAME_TX_TYPE` byte that EIP-2718 typed transactions conventionally prefix before RLP. The fix is a direct `keccak(bytes([FRAME_TX_TYPE]) + rlp(tx_copy))`. Approved by all reviewers within hours; auto-merged on Apr 22 with no further debate. A small but security-relevant alignment with the EIP-2718 convention that other typed transactions already follow.

### Guarantors Proposal

*derekchiang — PR #11555, Apr 22*

derekchiang opened an early proposal introducing a "guarantor" payer: a payer that covers gas even if sender validation fails. When a transaction has a guarantor, mempool nodes may skip sender-validation simulation entirely, so the sender's VERIFY frame is free to read shared state (ERC-20 balances, environmental opcodes, anything the restrictive-tier rules currently forbid) and still propagate through the public mempool. If inclusion reveals that sender validation would have failed, the guarantor absorbs the gas cost. Guarantors are expected to be either accounts the user controls (self-guarantee) or third parties with a commercial or trust relationship to the user. The PR description explicitly frames the proposal as still iterating. The mempool-strategy impact is substantial: this would open a third path for ERC-20 gas repayment alongside the live (offchain) and permissionless (onchain) paymaster patterns, by moving the shared-state read problem from a mempool-policy violation into an economic-risk problem the guarantor absorbs.

Why this matters for statelessness: the original reason the restrictive tier bans shared-state reads during validation is VOPS compatibility. A node carrying only a partial-statelessness slice cannot safely validate a transaction whose inclusion depends on state outside its slice. Guarantors route around that by making the guarantor's commitment (which *is* inside every node's slice, since it is a paymaster-like signature check) sufficient grounds to admit the transaction. The VOPS invariant is preserved; the economic risk shifts from the protocol to the guarantor.

**What to watch**: whether guarantors gather author consensus beyond derekchiang; how the economic model handles third-party guarantor markets (AMM-backed, staked, or something else); whether the design generalizes beyond ERC-20 to privacy flows (nullifier reads, shielded withdrawals) and complex AA validation; and the interaction with VOPS/FOCIL. Guarantor-backed transactions sidestep sender simulation, but the guarantor's own validation still has to fit the restrictive tier for the mempool to admit the transaction at all.

### Deploy-Frame Factory Relaxation

*derekchiang — PR #11567, Apr 24*

Two days after the guarantors proposal, derekchiang opened a second structural mempool proposal: drop the hard-coded EIP-7997 deterministic factory requirement for `deploy` frames. The current spec pins EIP-7997 both as a `requires` entry and as the only valid `frame.target` a mempool node will propagate a deploy frame to. The PR removes both: any contract can be the factory target provided the deploy frame's execution still satisfies the validation trace rules. The mempool write policy is rewritten as an explicit carve-out: `CREATE`, `CREATE2`, or `SETDELEGATE` operations that install code at `tx.sender`, plus `SSTORE`s to `tx.sender`'s storage. `CREATE` (0xF0) and `SETDELEGATE` (0xF6) join `CREATE2` (0xF5) in the deploy-frame opcode carve-out, and installed code may be either conventional contract code or an EIP-7702 delegation indicator.

Why this matters for the mempool model: EIP-7997 was a convenience dependency, not a safety dependency. The actual safety property the restrictive tier needs is that deploy-frame outcome is independent of chain state outside `tx.sender`. PR #11567 reifies that property directly in the trace rules rather than encoding it as "must call a specific contract." Any stateless factory qualifies. The PR also blurs the line between smart-account deployment and EIP-7702 delegation installation: both now flow through the same deploy-frame primitive, with the mempool treating delegation-indicator installation as a legitimate deployment outcome.

**What to watch**: whether core authors accept the trace-rule framing over a named-contract whitelist; whether reviewers push back on allowing arbitrary `CREATE` and `SETDELEGATE` inside the deploy frame (the original restriction was defensive); and how this interacts with PR #11482's precompile-targeting VERIFY frames and the default-code-vs-7702 discussion from Phase 6. If adopted, EIP-7997 becomes a canonical-but-optional factory and the spec drops its only same-fork hard dependency.

### RLP Call Batch Removed from Default Code (Merged)

*lightclient — PR #11577, merged Apr 29*

A small cleanup completing the transition of multi-call out of the default-code payload and into the frame list. Default-code `SENDER` mode previously decoded `frame.data` as RLP `[[target, value, data], ...]` and returned successfully on cross-EOA targets; now it simply reverts. The use cases are covered by atomic frame batching (PR #11395) and per-frame `value` (PR #11534). Auto-merged with no debate.

### Payer-Before-Sender Alternative to Guarantors

*lightclient — PRs #11575, #11579, #11580, Apr 28-29*

In parallel with derekchiang's still-iterating guarantors PR (#11555), lightclient floated a simpler framing: rather than introduce a new "guarantor" role, just relax the ordering rule so the payer can call `APPROVE_PAYMENT` before the sender approves execution. A payer that commits to gas before sender validation absorbs the same economic risk a guarantor would, without a new role. PR description: *"I think it is simpler to just allow the payer to approve before the sender instead of adding the full guarantor role."*

PR #11575 auto-merged on Apr 28; lightclient had intended a draft, and opened #11579 the next day reverting. The content is now open as draft #11580. Net spec impact: zero. The next-sync question is which framing (#11555 guarantors or #11580 ordering relaxation) gathers author consensus; both attack the same problem of admitting shared-state sender validation in the public mempool by shifting risk onto a payer.

