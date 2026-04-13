# EIP-8141 Research - Project Instructions

This repo tracks the evolution of EIP-8141 (Frame Transaction). It is a VitePress documentation site with research documents, a landing page, and supporting infrastructure. These instructions ensure any contributor (human or agent) can update and maintain the repo consistently.

---

## Repository Structure

```
├── CLAUDE.md                          # This file - project instructions
├── README.md                          # GitHub landing page with document index and synthesis
├── package.json                       # VitePress dev dependency
├── docs/
│   ├── index.md                       # VitePress home page (hero, features, examples)
│   ├── appendix.md                 # Sources, PR timeline, contributors, external resources
│   ├── current-spec.md             # Current spec overview (execution + mempool model)
│   ├── feedback-evolution.md       # Community feedback organized by chronological phase
│   ├── original-spec.md            # Original Jan 29 submission and what it lacked
│   ├── merged-changes.md           # Every PR (merged, closed, open) with rationale
│   ├── original-vs-latest.md       # Side-by-side diff of structural changes
│   ├── competing-standards.md      # EIP-8130, EIP-8175, EIP-8202, Tempo - design + comparison
│   ├── pending-concerns.md         # Open concerns (statelessness, mempool, trilemma, complexity)
│   ├── faq.md                      # Indexed Q&A (section.question format, e.g. 2.3)
│   ├── developer-tooling.md        # Bear/bull cases for wallet/app dev adoption, protocol defaults vs ERC fragmentation
│   └── .vitepress/
│       ├── config.ts                  # Nav, sidebar, social links
│       └── theme/
│           ├── index.ts               # Theme entry - imports custom.css
│           ├── Layout.vue             # Wraps default layout, adds Footer
│           ├── Footer.vue             # 3-column footer (Docs, Competing Standards, Sources)
│           └── custom.css             # Global table styles
```

---

## Document Ordering

- Docs use slug filenames without numeric prefixes (e.g. `current-spec.md`, not `01-current-spec.md`)
- Order is defined manually in `config.ts` (nav + sidebar), `Footer.vue`, and `README.md`, not by filename
- `appendix.md` is always **last** in nav, sidebar, and footer
- The FAQ (`faq.md`) uses indexed questions: sections are numbered (1–10), questions are `section.question` (e.g., 1.1, 2.3, 8.5)
- When adding a new document, create `docs/<slug>.md` and update: `config.ts` (nav + sidebar), `Footer.vue`, and `README.md`

---

## Website Configuration

### VitePress (docs/.vitepress/)

- **config.ts**: Defines nav header and sidebar. Nav has: Home, Docs (dropdown), FAQ, Demo (external link). Sidebar lists all docs in order with Appendix last. Keep these in sync when adding/removing docs.
- **Footer.vue**: 3-column grid (Docs links, Competing Standards anchors, Sources with external links). Does NOT include FAQ or Appendix.
- **Layout.vue**: Wraps VitePress default layout, injects Footer via `#layout-bottom` slot.
- **custom.css**: Global rule `white-space: nowrap` on first column of all tables. Do not remove - prevents column text wrapping across all docs.
- **theme/index.ts**: Imports DefaultTheme, Layout, and custom.css. Keep imports here when adding new CSS.

### Landing Page (docs/index.md)

- Uses VitePress `layout: home` with hero, actions, and features in YAML frontmatter
- Hero buttons: "Read the Spec Overview" (brand), "Try the Demo" (alt)
- Below frontmatter: markdown sections with frame mode table, examples, opcode table
- Frame modes table lists DEFAULT first (it is mode 0 in the spec)
- Examples that include gas sponsorship should include a DEFAULT post-op frame for sponsor refund

### Formatting Rules

- Tables: first column never wraps (enforced by CSS). Keep first-column text concise.
- Links between docs: use root-relative paths (`/current-spec`, not `./current-spec.md`)
- Links to external sites: use full URLs with `target="_blank"` in Vue templates
- No emojis in any file
- Never use em dashes (`—`) in the middle of sentences as parenthetical separators. Rewrite the sentence using commas, periods, or colons instead. Em dashes ARE allowed in lists and tables to separate a topic from its description (e.g., `EIP-8130 — Account Configuration`).
- Keep answers in FAQ to 1-2 lines, always with question and answer on separate lines

---

## Research Data Sources

| Input | Source | Purpose |
|---|---|---|
| Latest spec | `https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8141.md` | Ground truth for current state |
| Closed/merged PRs | `gh pr list --repo ethereum/EIPs --search "8141" --state all` | Chronological record of spec changes |
| Open PRs | `gh pr list --repo ethereum/EIPs --search "8141" --state open` | Pending proposals and context |
| PR comments | `gh pr view --repo ethereum/EIPs <number> --comments` | Design rationale not in the spec |
| EthMagicians thread | `https://ethereum-magicians.org/t/frame-transaction/27617` | Community feedback and debates |
| ethresear.ch | `https://ethresear.ch/t/frame-transactions-through-a-statelessness-lens/24538` | Statelessness and mempool concerns |

---

## Update Process

When updating the repo to capture new developments, follow this checklist in order:

### 1. Gather New Data

- **Fetch latest spec** from `master` branch - compare against `current-spec.md`
- **Search for new PRs** since the last documented PR (check `appendix.md` for the most recent)
- **Read all comments** on new and updated PRs - PR comments often contain critical design rationale
- **Read new EthMagicians posts** beyond the last documented post number (check `appendix.md`)
- **Check competing proposals** for new PRs or discussion threads (EIP-8130, EIP-8175, EIP-8202)
- **Check ethresear.ch** for new posts in relevant threads

### 2. Update Documents

Each document has a specific scope. Update only the relevant ones:

| Document | When to update |
|---|---|
| `current-spec.md` | Spec changed (new PRs merged), or pending proposals section needs updating |
| `feedback-evolution.md` | New EthMagicians posts, new PR review comments with substantive debate |
| `original-spec.md` | Rarely - only if new context about the original submission surfaces |
| `merged-changes.md` | New PRs merged, closed, or opened. Update status of existing open PRs. |
| `original-vs-latest.md` | Spec changed structurally (new PRs merged that alter behavior) |
| `competing-standards.md` | New competing EIPs, new PRs on existing competitors, new comparison threads |
| `pending-concerns.md` | New concerns raised in ethresear.ch, EthMagicians, or private discussions |
| `faq.md` | New questions arise from community, or answers change due to spec updates |
| `developer-tooling.md` | New bear/bull arguments emerge from wallet/app developers, or protocol defaults expand |
| `appendix.md` | Always - update PR timeline, post count, contributor list, external resources |

### 3. Update Infrastructure

- **README.md**: Update "Last updated" date and coverage numbers. Update document table if docs added.
- **config.ts**: Update nav/sidebar if docs added or renamed
- **Footer.vue**: Update if docs added to Docs column or new external links added to Sources

### 4. Verify Consistency

After updates, check:
- All internal links between docs are valid (root-relative paths match filenames)
- PR numbers, post numbers, and dates are consistent across documents
- The appendix PR timeline matches what's described in `merged-changes.md`
- FAQ cross-references to `pending-concerns.md` use correct anchor slugs

---

## Writing Principles

- **Traceability**: Every claim links to a specific PR number, EthMagicians post number, or commit
- **Direct quotes**: Use author quotes to capture rationale - paraphrasing loses nuance
- **Rejected PRs matter**: Closed PRs reveal the design space the authors explored and chose against
- **Comments over descriptions**: PR review threads often contain more insight than the PR description
- **Chronological + thematic**: `merged-changes.md` is chronological; `feedback-evolution.md` groups by thematic phase
- **What's absent**: Document what the spec does NOT have - gaps explain future direction
- **No names in concerns**: `pending-concerns.md` does not attribute concerns to named individuals - it presents arguments, not people
- **FAQ brevity**: Answers are 1-2 lines max. Link to docs or external sources for detail.

---

## Style Rules

- Be pragmatic and direct. No filler, no trailing summaries.
- Don't add features, refactor code, or clean up code that wasn't part of the ask
- No docstrings, comments, or type annotations on code you didn't touch
- Keep commit messages concise (1-2 lines)
- Don't create new files unless explicitly needed - prefer editing existing ones

---

## Common Tasks

### Adding a new document

1. Create `docs/<slug>.md`
2. Add to `config.ts` nav (inside Docs dropdown) and sidebar (before Appendix)
3. Add to `Footer.vue` if it belongs in the Docs column
4. Add to `README.md` document table
5. Update this file's repository structure section

### Adding a new competing standard

1. Add full section in `competing-standards.md` following the existing pattern: Overview, Core Design, Mempool Strategy, Key Differences table, Activity, Strengths, Weaknesses
2. Update the comparative analysis section (spectrum diagram, PQ table, Mempool table, Adoption table)
3. Add a "What X's ecosystem says about EIP-8141" subsection if relevant cross-discussion exists
4. Add link in `appendix.md` under Competing Standards
5. Update `Footer.vue` Competing Standards column if needed

### Adding a new pending concern

1. Add numbered section in `pending-concerns.md` following existing pattern
2. Add row to the Summary of Open Questions table at the bottom
3. Add cross-reference in `faq.md` if a relevant question exists (use anchor slug format)
4. Do not attribute concerns to named individuals

### Updating PR status

1. Update `merged-changes.md` - move PR between Open/Merged/Closed sections as needed, add review comment summaries
2. Update `appendix.md` PR timeline table
3. If a merged PR changes the spec: update `current-spec.md` and `original-vs-latest.md`
