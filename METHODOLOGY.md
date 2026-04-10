# Research Methodology

A repeatable process for producing comprehensive EIP evolution documentation. This methodology was used for the initial EIP-8141 research (March 26, 2026) and can be re-run to capture new developments.

---

## Inputs

| Input | Source | Purpose |
|---|---|---|
| Latest spec | `https://github.com/ethereum/EIPs/blob/master/EIPS/eip-{N}.md` | Ground truth for current state |
| Closed/merged PRs | `https://github.com/ethereum/EIPs/pulls?q=is%3Apr+is%3Aclosed+{N}` | Chronological record of spec changes |
| Open PRs | `https://github.com/ethereum/EIPs/pulls?q=is%3Apr+is%3Aopen+{N}` | Pending proposals and context |
| EthMagicians thread | `https://ethereum-magicians.org/t/{slug}` | Community feedback, debates, and rationale not captured in PRs |

---

## Process

### Step 1: Fetch the Latest Spec

Read the canonical EIP markdown from the ethereum/EIPs repo (`master` branch). Extract:

- **Header metadata**: status, type, category, created date, authors, requires
- **Full technical content**: motivation, specification, rationale, backwards compatibility, security considerations

This serves as the reference point for Step 5 (current spec documentation) and as a comparison target for Step 4 (original vs latest diff).

### Step 2: Collect All Related PRs

Search the ethereum/EIPs repo for all PRs referencing the EIP number. For each PR, record:

- PR number, author, date, status (merged/closed/open)
- Title and description
- **All review comments and discussion threads within the PR**

Sort chronologically. This produces the raw timeline used in Step 3.

Important: PR comments often contain critical design rationale that doesn't appear in the spec itself. Read every comment thread, not just the PR description.

### Step 3: Read the EthMagicians Discussion Thread

The EthMagicians forum thread is where most conceptual debate happens. Read all posts and extract:

- Key arguments for/against design decisions
- Alternative proposals raised by reviewers
- Author responses explaining rationale
- Adoption concerns, security critiques, and competing proposals
- Direct quotes that capture pivotal moments in the debate

Tag each discussion point with the post numbers and participants for traceability.

### Step 4: Identify the Original Spec

The first merged PR is the original EIP submission. Reconstruct the original spec by either:

- Reading the diff of the initial PR (preferred, gives exact original content)
- Reading the spec at the initial commit hash

Document what the original spec included AND what it did not yet have (gaps that later PRs filled).

### Step 5: Synthesize into Documents

Using the raw data from Steps 1-4, produce the following deliverables:

#### Document 1 — Current Spec Overview (`01-current-spec.md`)
What the EIP can do today and how it works. Cover:
- Transaction structure and encoding
- Execution model (frames, modes, opcodes)
- Mempool model (validation rules, paymaster, gas caps)
- Practical use cases with concrete examples

#### Document 2 — Feedback Evolution (`02-feedback-evolution.md`)
How community feedback shaped the spec over time. Organize chronologically by phase:
- Group related discussions into thematic phases
- For each phase: what was debated, who participated, what was resolved and how
- Include direct quotes that capture pivotal arguments
- Note competing/alternative proposals that emerged

#### Document 3 — Original Spec (`03-original-spec.md`)
How the EIP started. Cover: submission date, authors, motivation, original technical design (opcodes, transaction structure, modes), and what was absent from the initial version.

#### Document 4 — Merged Changes (`04-merged-changes.md`)
Every PR (merged and rejected), in chronological order. For each:
- What changed and why
- Key review comments that influenced the outcome
- How the change relates to feedback from Document 2
- Direct quotes from PR descriptions and reviewers

#### Document 5 — Original vs Latest (`05-original-vs-latest.md`)
Side-by-side comparison of every structural change between the original submission and the current spec. Highlight:
- Added features
- Removed features
- Modified behaviors
- Philosophical shifts in the spec's approach

#### Document 6 — Competing Standards (`06-competing-standards.md`)
- Design, tradeoffs, and comparative analysis of competing proposals against EIP-8141

#### Document 7 — Appendix (`07-appendix.md`)
- Complete PR timeline table
- Key contributors and their roles
- External resources (PoC implementations, metrics dashboards, related EIPs)

---

## How to Re-run This Research

When updating the documentation to capture new developments:

1. **Re-fetch the latest spec** (Step 1) — the spec may have changed since last run
2. **Search for new PRs** since the last documented PR date (check the appendix for the most recent PR)
3. **Read new EthMagicians posts** beyond the last documented post number
4. **Update each document** with new findings:
   - Append new phases to Document 2
   - Append new PRs to Document 3
   - Update the comparison in Document 4
   - Rewrite Document 5 to reflect the current state
   - Update the timeline and contributors in Document 6
5. **Update the README** synthesis section if new meta-patterns emerge

### Checklist for Each Update Cycle

- [ ] Read latest spec from `master` branch
- [ ] Search `is:pr 8141` for new PRs since last PR date
- [ ] Read all comments on each new PR
- [ ] Read new EthMagicians posts since last documented post
- [ ] Check for new competing/related EIPs mentioned in discussions
- [ ] Update docs 01-06 as needed
- [ ] Update README with new synthesis if applicable
- [ ] Record the update date and coverage range

---

## Principles

- **Traceability**: Every claim links back to a specific PR number, post number, or commit
- **Direct quotes**: Use author quotes to capture rationale — paraphrasing loses nuance
- **Rejected PRs matter**: Closed PRs and rejected proposals reveal the design space the authors explored and chose against
- **Comments over descriptions**: PR review threads often contain more insight than the PR description itself
- **Chronological + thematic**: Organize merged changes chronologically but group feedback thematically by phase
- **What's absent**: Document what the spec does NOT have, not just what it does — gaps explain future direction
