# EIP-8141: Frame Transaction — Research

A comprehensive analysis of [EIP-8141](https://eips.ethereum.org/EIPS/eip-8141) (Frame Transaction), covering its origin, evolution through community feedback, and current state as of March 26, 2026.

## Documents

| # | Document | Description |
|---|---|---|
| 1 | [Original Spec](./docs/01-original-spec.md) | How EIP-8141 started — the Jan 29 submission, its motivation (PQ + native AA), the original technical design with 4 opcodes and 3 frame modes, and what it didn't yet have |
| 2 | [Feedback Evolution](./docs/02-feedback-evolution.md) | How community feedback shaped the spec from expressive abstraction toward operational constraints — conceptual scrutiny, the adoption critique from Monad, the push for EOA support, mempool safety, and competing proposals |
| 3 | [Merged Changes](./docs/03-merged-changes.md) | Every PR merged (and rejected), in chronological order with rationale — from day-0 bug fixes through APPROVE relaxation, EOA support, opcode redesign, approval bits, atomic batching, and mempool policy |
| 4 | [Original vs Latest](./docs/04-original-vs-latest.md) | Side-by-side comparison table of every structural change, plus 6 key philosophical shifts including the sig-hash mode-flag precision that enables the whole flag system to work |
| 5 | [Current Spec Overview](./docs/05-current-spec.md) | What EIP-8141 can do today — the "dual spec" (execution model + mempool model), transaction structure, APPROVE, EOA default code, atomic batching, gas accounting, and practical use case examples |
| 6 | [Appendix](./docs/06-appendix.md) | Complete PR timeline (19 PRs), key contributors (16 people), and external resources |

## Synthesis: Three Patterns in the Spec's Evolution

Reading across the full history — 19 PRs, 119 EthMagicians posts, and two months of iteration — three meta-patterns emerge:

### 1. From Expressive Power to Operational Constraints

The early drafts prioritized flexibility: let accounts define arbitrary validation, let frames do anything. The later drafts are about making that flexibility survivable — capping validation gas, banning environment-dependent opcodes, requiring structured validation prefixes, and defining canonical paymaster contracts. The spec started as "validation is programmable" and matured into "validation is programmable *within bounds the network can reason about*."

### 2. Generic Primitive Over Hard-Coded Use Case

The authors repeatedly chose the more general design when faced with a tradeoff. You can see this in the Magicians responses about why frames exist instead of fixed fields, in the move from a `SENDER_ATOMIC` mode to a mode-flag approach, in the decision not to outsource default-code behavior to EIP-7932, and in the refusal to enshrine a single PQ signature scheme. The spec keeps trying to stay flexible while making the validation prefix structured enough for the network to reason about.

### 3. Two Specs in One: Execution Model + Mempool Model

EIP-8141 is increasingly two specs at once. The **execution model** says "validation and payment are programmable" — any account code can verify any signature and approve any payer. The **mempool model** says "that programmability is only publicly relayable when it fits a small set of validation-prefix shapes and state-dependency rules." Understanding this split is central to understanding where the EIP stands today, and why the mempool policy PR (#11415) was called "a big big step forwards" by even the spec's most vocal critic.

---

## Sources

- [EIP-8141 Spec](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8141.md)
- [All Related PRs](https://github.com/ethereum/EIPs/pulls?q=is%3Apr+8141)
- [Ethereum Magicians Discussion (119 posts)](https://ethereum-magicians.org/t/frame-transaction/27617)
