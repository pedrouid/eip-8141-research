# Feedback on `Topics` Docs

## Scope

This review covers every doc indexed under **Topics** in the repo metadata:

- `docs/competing-standards.md`
- `docs/pending-concerns.md`
- `docs/mempool-strategy.md`
- `docs/developer-tooling.md`
- `docs/eoa-support.md`

Review criteria:

1. Are the docs well explained?
2. Are the docs straight to the point?
3. Are the docs providing the right sources?
4. Are the docs readable or too verbose?
5. Are the docs contextual or vague?

Scoring uses `1-5`:

- `5`: strong
- `3`: mixed
- `1`: weak

Line counts and external-link counts are included as rough signals only. They do **not** measure quality by themselves.

---

## Executive Summary

The Topics docs are strong on **technical understanding**, **internal consistency**, and **cross-document context**. The repo clearly has a coherent thesis, and most topic docs do a good job explaining why the topic matters to EIP-8141 rather than just dumping facts.

The biggest weakness is **source discipline**. Internal cross-links are good, but several important claims are presented as settled conclusions without direct links to the spec, PR comments, forum posts, or external analyses that justify them. This is most visible in `mempool-strategy.md`, and to a lesser extent in the evaluative parts of `competing-standards.md`, `developer-tooling.md`, and `eoa-support.md`.

The second biggest weakness is **verbosity imbalance**. Most docs are reasonably tight, but `competing-standards.md` is much longer than the rest and reads more like a research dossier than a "topic" page. `developer-tooling.md` is shorter, but too much of its weight sits inside long quotes from X posts rather than in the doc's own synthesis.

Best overall docs:

- `docs/eoa-support.md` for explanation and contextual clarity
- `docs/pending-concerns.md` for concision and structure
- `docs/mempool-strategy.md` for argument flow, even though its sourcing is the weakest

Docs most in need of revision:

- `docs/competing-standards.md` for length, uneven sourcing, and missing links in commentary sections
- `docs/mempool-strategy.md` for lack of primary-source attribution
- `docs/developer-tooling.md` for overreliance on social-post sourcing

---

## Scorecard

| Doc | Lines | External links | Well explained | Straight to the point | Right sources | Readable / not too verbose | Contextual / not vague | Overall |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `competing-standards.md` | 727 | 11 | 4 | 2 | 3 | 2 | 4 | 3 |
| `pending-concerns.md` | 139 | 4 | 4 | 4 | 3 | 4 | 4 | 4 |
| `mempool-strategy.md` | 184 | 0 | 4 | 4 | 1 | 4 | 4 | 3 |
| `developer-tooling.md` | 151 | 2 | 4 | 3 | 2 | 3 | 4 | 3 |
| `eoa-support.md` | 189 | 3 | 5 | 3 | 3 | 4 | 5 | 4 |

High-level answers to the five questions:

- **Well explained?** Yes, mostly. The repo is good at explaining mechanisms and tradeoffs.
- **Straight to the point?** Mixed. Three docs are fairly tight; `competing-standards.md` is not.
- **Providing the right sources?** Inconsistent. Internal cross-links are strong; primary-source traceability is uneven.
- **Readable or too verbose?** Mostly readable, but `competing-standards.md` is too long and `developer-tooling.md` is quote-heavy.
- **Contextual or vague?** Generally contextual inside the repo's ecosystem, but occasionally vague for newcomers because acronyms and conclusions arrive before enough grounding.

---

## Cross-Doc Findings

### What is working well

- The docs share a consistent voice and structure. They feel like one body of research rather than disconnected pages.
- The repo usually explains **why** a topic matters to EIP-8141, not just **what** the topic is.
- Internal cross-linking is strong. `pending-concerns.md`, `mempool-strategy.md`, `developer-tooling.md`, and `eoa-support.md` reinforce each other well.
- Most docs open with a useful frame or TL;DR instead of burying the thesis.
- The docs are strongest when they translate protocol mechanics into practical consequences for wallets, users, or nodes.

### The main issues

- **Primary-source attribution is not consistent enough.** Several strong claims sound authoritative but are not directly tied to PRs, specific forum posts, spec sections, or external references.
- **Analysis and fact are sometimes blended too tightly.** This makes the docs persuasive, but occasionally less trustworthy than they could be.
- **Acronym density is high.** VOPS, FOCIL, ERC-7562, canonical paymaster, restrictive tier, expansive tier, and related terms are often assumed rather than introduced.
- **Some docs repeat their central claim too many times.** This affects readability more than correctness.

### Priority fixes

1. Add explicit source links to `mempool-strategy.md` for every major claim.
2. Shorten `competing-standards.md` or split it into a summary doc plus a reference appendix.
3. Replace most long quotes in `developer-tooling.md` with shorter summaries plus links.
4. Add missing links in `competing-standards.md` where outside materials are named but not linked.
5. Make "repo analysis" vs "quoted/source-backed claim" more explicit across all topic docs.

---

## Per-Doc Review

## `docs/competing-standards.md`

**Bottom line**

This doc is valuable and clearly informed, but it is too long for how it is positioned in the repo. It explains the landscape well, but it is not very straight to the point. It has more sources than the other topic docs in raw count, yet still has uneven traceability because many evaluative judgments are not tied to specific sources.

**What works**

- The opening comparative section is strong. It immediately gives the reader a usable mental map of the design space: `docs/competing-standards.md:9-81`.
- The repeated structure per proposal makes scanning predictable: overview, core design, mempool strategy, differences, activity, strengths, weaknesses.
- The activity sections are useful because they separate proposal maturity from technical design quality: `164-169`, `270-274`, `372-376`, `587-590`, `673-676`.
- The doc is contextual rather than vague. It always explains each proposal relative to the repo's core question: how EIP-8141 compares.

**Where it falls short**

- It is too verbose. At 727 lines, this is not a topic explainer anymore; it is a mini-reference book.
- The per-proposal sections become repetitive. The same comparison logic reappears in multiple tables and bullet lists.
- Several strong judgments are not tightly sourced. Examples:
  - "No longer simpler" and the erosion of the original pitch: `192-198`
  - "allied front pushing 'flat composition, not recursive'": `706`
  - various strengths and weaknesses sections across proposals: `181-198`, `276-289`, `378-395`, `497-515`, `592-604`, `678-692`
- There are explicit sourcing gaps:
  - "Pre-draft gist by gakonst" is mentioned without linking the gist: `493-495`
  - "From the Biconomy blog analysis" has no link: `710-713`
  - Cross-proposal commentary quotes or paraphrases strong positions, but usually links only to a thread, not the exact post or source excerpt: `698-726`

**Answers to the five questions**

- **Well explained:** Yes. This is one of the most informed docs in the repo.
- **Straight to the point:** No, not enough. The top section is efficient; the full doc is not.
- **Right sources:** Partly. Breadth is good, precision is uneven.
- **Readable or too verbose:** Too verbose.
- **Contextual or vague:** Contextual.

**Recommendations**

- Keep the comparative analysis at the top almost as-is.
- Compress each proposal to a shorter "What it is / Why it matters / Biggest tradeoff / Maturity" block.
- Move deep per-proposal detail into a second doc or appendix if needed.
- Link every named external artifact, especially the Biconomy analysis and the Tempo-like gist.
- Label subjective repo conclusions as analysis instead of presenting them with the same tone as sourced facts.

---

## `docs/pending-concerns.md`

**Bottom line**

This is the tightest topic doc. It is mostly well explained, mostly straight to the point, and structured in a way that helps readers understand both the criticism and the repo's counter-argument. Its main weakness is narrow sourcing rather than poor writing.

**What works**

- The opening summary table is excellent for fast orientation: `docs/pending-concerns.md:9-21`.
- The concern -> counterpoint pattern is strong. It keeps the doc analytical instead of becoming a list of complaints: `25-36`, `53-62`, `80-88`, `96-117`.
- The doc is concise. At 139 lines, it gets a lot done without much waste.
- It is contextual. Every concern is tied to a concrete protocol consequence: mempool health, censorship resistance, statelessness, or implementation scope.

**Where it falls short**

- Source breadth is narrow. The intro honestly says the primary source is one ethresear.ch thread: `5`. That honesty is good, but the document ends up leaning heavily on a single discussion.
- Some claims deserve stronger backing than they currently get:
  - market-adoption risk around the canonical paymaster: `64-78`
  - Glamsterdam delay / implementation-scope impact: `131-135`
- FOCIL appears before a newcomer is likely grounded in it: `55-58`.
- The unresolved concerns sometimes get less space than the proposed resolution. Concern 6 is a good example: `90-94`.

**Answers to the five questions**

- **Well explained:** Yes.
- **Straight to the point:** Yes.
- **Right sources:** Mixed. Honest, but too narrow.
- **Readable or too verbose:** Readable.
- **Contextual or vague:** Contextual, though acronym-heavy.

**Recommendations**

- Keep the overall structure.
- Add a one-line glossary or first-use explanation for VOPS and FOCIL.
- Add at least one supporting source per concern where possible, even if the doc preserves the no-named-attribution policy.
- Give unresolved concerns the same level of development as resolved ones.

---

## `docs/mempool-strategy.md`

**Bottom line**

This is one of the best-written docs structurally and one of the weakest-sourced docs in the repo. It is clear, organized, and surprisingly readable for a difficult topic, but it asks the reader to accept too many important claims without direct evidence.

**What works**

- The TL;DR is very strong and unusually effective for a protocol doc: `docs/mempool-strategy.md:5-16`.
- The section order is good. Each section answers the next obvious question.
- The doc is straight to the point. It does not wander much.
- Internal cross-links to `current-spec`, `pending-concerns`, and `developer-tooling` are useful and make the page feel integrated.

**Where it falls short**

- It has **zero external links** despite making several major claims.
- Important claims that need explicit backing include:
  - the Bitcoin analogy and historical claim: `134-152`
  - the claim that frame transactions do not need relayers: `156-173`
  - the statement that the trilemma is resolved: `116-130`
  - the VOPS+4 proposal and witness-size estimates: `80-112`
- Some lines are written like conclusions from an accepted design rather than a proposed framework:
  - "This is 'AA for the 80% case'": `60`
  - "The trilemma is resolved": `130`
  - "No live actor is required. The contract is the actor.": `169`
- The doc is contextual inside the repo, but not fully self-contained. A reader who does not already know VOPS, FOCIL, or ERC-7562 may need to bounce out early.

**Answers to the five questions**

- **Well explained:** Yes.
- **Straight to the point:** Yes.
- **Right sources:** No.
- **Readable or too verbose:** Readable.
- **Contextual or vague:** Contextual inside the repo, but slightly underdefined for a cold reader.

**Recommendations**

- Add source links for each major section, ideally to spec text, Magicians posts, and ethresear.ch discussions.
- Distinguish clearly between "current public mempool policy" and "proposed broader framework."
- Keep the existing structure; the problem is provenance, not organization.
- Add one-line first-use definitions for VOPS, FOCIL, and ERC-7562.

---

## `docs/developer-tooling.md`

**Bottom line**

This doc does a good job making the topic relevant to wallet and app developers, and the bear-case / bull-case framing is effective. The biggest issue is source quality: the core debate relies too heavily on two X posts, which makes the doc feel less durable than the rest of the repo.

**What works**

- The doc explains the problem in practical terms instead of abstract protocol language: `docs/developer-tooling.md:27-43`.
- The bear-case / bull-case structure is one of the cleanest in the repo: `47-83`.
- The closing table on where fragmentation still lives is useful and specific: `125-141`.
- The doc is contextual. It keeps tying protocol choices back to wallet implementation cost and app-facing API fragmentation.

**Where it falls short**

- The main arguments are sourced almost entirely from two X posts: `51-63` and `73-79`.
- The quote blocks are too long relative to the document size. They slow the pace and crowd out the doc's own synthesis.
- Several factual claims need better support:
  - ERC-5792 took "roughly a year" to converge: `31`
  - adoption is still incomplete: `31`
  - the "100x" adoption-cost claim: `13`, `71`, `149`
- The doc is reasonably concise overall, but the quote-heavy middle makes it feel less straight to the point than it should.

**Answers to the five questions**

- **Well explained:** Yes.
- **Straight to the point:** Mixed.
- **Right sources:** Not really, not yet.
- **Readable or too verbose:** Readable, but over-quoted.
- **Contextual or vague:** Contextual.

**Recommendations**

- Replace long verbatim quote blocks with short summaries and links.
- Add direct links to the ERCs being discussed and at least one implementation or adoption reference where claims depend on ecosystem uptake.
- Keep the two-sided framing. It works well.

---

## `docs/eoa-support.md`

**Bottom line**

This is the strongest topic doc for explanation quality. It teaches the reader how EOA support works, where the boundaries are, and why the mechanism matters. Its main weaknesses are repetition and lighter-than-ideal sourcing for how confidently some claims are stated.

**What works**

- The TL;DR is dense but useful, and the scope is clear immediately: `docs/eoa-support.md:5-16`.
- The step-by-step walkthrough of VERIFY, SENDER, and DEFAULT mode is the clearest mechanism explanation in the Topics set: `20-52`.
- The doc is very contextual. It explains both behavior and practical implication throughout:
  - replacing common EIP-7702 use cases: `89-113`
  - per-transaction composability: `117-128`
  - when custom account code is still needed: `148-161`
  - what default code does not do: `165-177`
- The boundaries are explicit, which improves trust.

**Where it falls short**

- Some core claims repeat too often:
  - no 7702 needed for common cases: `7-16`, `89-113`, `181-189`
  - per-transaction composability: `10-11`, `117-128`, `185`
  - EOA as paymaster: `12`, `36`, `132-145`, `186`
- Source coverage is better than `mempool-strategy.md`, but still not strong enough for the certainty level of the prose.
- One clarity issue should be fixed directly:
  - the VERIFY-mode steps say `frame.target == tx.sender` as a general rule: `28`
  - then the payer-scope exception is introduced afterward via PR #11488: `36`
  - that exception should be stated inline in the numbered logic, not as a follow-up correction

**Answers to the five questions**

- **Well explained:** Yes, strongly.
- **Straight to the point:** Mixed. It is clear, but somewhat repetitive.
- **Right sources:** Mixed.
- **Readable or too verbose:** Readable, with moderate repetition.
- **Contextual or vague:** Strongly contextual.

**Recommendations**

- Keep this doc's overall structure. It is the best teaching-oriented topic page.
- Reduce repeated adoption/composability points across TL;DR, middle sections, and summary.
- Add direct links to the exact spec sections being paraphrased.
- Rewrite VERIFY-mode explanation so the payer-scope exception appears where the rule is first stated.

---

## Best and Worst by Criterion

### Best explained

- `docs/eoa-support.md`
- `docs/pending-concerns.md`

### Most straight to the point

- `docs/pending-concerns.md`
- `docs/mempool-strategy.md`

### Best sourced

- `docs/competing-standards.md` in raw breadth
- `docs/pending-concerns.md` in honesty about its source base

### Weakest sourced

- `docs/mempool-strategy.md`
- `docs/developer-tooling.md`

### Most verbose

- `docs/competing-standards.md`

### Most contextual

- `docs/eoa-support.md`
- `docs/developer-tooling.md`

### Most likely to feel vague to a newcomer

- `docs/mempool-strategy.md` because of unsourced assertions plus acronym load
- `docs/pending-concerns.md` because FOCIL/VOPS arrive quickly

---

## Final Verdict

The Topics section is already good enough to feel like serious research, not marketing copy. The docs are generally well explained, and most of them are contextual rather than vague. The main improvements needed are not conceptual. They are editorial:

- tighten the longest doc
- add better primary-source traceability
- reduce repeated claims
- separate sourced fact from repo interpretation more clearly

If those changes are made, the Topics docs will feel substantially more rigorous without needing a major rewrite.
