# Appendix

---

## Sources

- [EIP-8141 Spec](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8141.md)
- [All Related PRs](https://github.com/ethereum/EIPs/pulls?q=is%3Apr+8141)
- [Ethereum Magicians Discussion (140 posts)](https://ethereum-magicians.org/t/frame-transaction/27617)

---

## Complete PR Timeline

### Merged

| Date | PR | Author | Description |
|---|---|---|---|
| Jan 29 | [#11202](https://github.com/ethereum/EIPs/pull/11202) | fjl | Original EIP submission |
| Jan 29 | [#11205](https://github.com/ethereum/EIPs/pull/11205) | fjl | Fix: elide VERIFY frame data from sig hash |
| Jan 29 | [#11209](https://github.com/ethereum/EIPs/pull/11209) | kevaundray | Fix: status field number in TXPARAM |
| Feb 10 | [#11297](https://github.com/ethereum/EIPs/pull/11297) | lightclient | Relax APPROVE to not require top-level frame |
| Feb 11 | [#11305](https://github.com/ethereum/EIPs/pull/11305) | lightclient | Fix typo |
| Mar 2 | [#11344](https://github.com/ethereum/EIPs/pull/11344) | derekchiang | Fix CALLER/ADDRESS bug, clarify reverts |
| Mar 10 | [#11355](https://github.com/ethereum/EIPs/pull/11355) | rakita | Add EIP-8175 Composable Transaction (related) |
| Mar 10 | [#11379](https://github.com/ethereum/EIPs/pull/11379) | derekchiang | Add EOA support (default code) |
| Mar 12 | [#11400](https://github.com/ethereum/EIPs/pull/11400) | fjl | Clean up opcodes: FRAMEDATALOAD/COPY |
| Mar 12 | [#11401](https://github.com/ethereum/EIPs/pull/11401) | fjl | Add approval bits to frame mode |
| Mar 13 | [#11402](https://github.com/ethereum/EIPs/pull/11402) | fjl | Fix bit indices (1-indexed) |
| Mar 13 | [#11406](https://github.com/ethereum/EIPs/pull/11406) | derekchiang | Add derekchiang as co-author |
| Mar 25 | [#11395](https://github.com/ethereum/EIPs/pull/11395) | derekchiang | Add atomic batching |
| Mar 25 | [#11415](https://github.com/ethereum/EIPs/pull/11415) | lightclient | Add mempool policy |
| Mar 26 | [#11448](https://github.com/ethereum/EIPs/pull/11448) | derekchiang | Update default code for approval bits |
| Apr 8 | [#11251](https://github.com/ethereum/EIPs/pull/11251) | BonyHanter83 | Add EIP-1559 to requires header |
| Apr 14 | [#11521](https://github.com/ethereum/EIPs/pull/11521) | benaadams | Tighten spec (mode/flags split, FRAMEPARAM, MAX_FRAMES=64, per-frame cost, default code hardening) |
| Apr 16 | [#11534](https://github.com/ethereum/EIPs/pull/11534) | lightclient | Add `value` field to frame (SENDER-only, TXPARAM(0x08), FRAMEPARAM(0x08)) |

### Open

| Date | PR | Author | Description |
|---|---|---|---|
| Feb 6 | [#11272](https://github.com/ethereum/EIPs/pull/11272) | Thegaram | Disable EIP-3607 for frame transactions |
| Mar 26 | [#11455](https://github.com/ethereum/EIPs/pull/11455) | SirSpudlington | Default code tweaks for EIP-7392 compatibility |
| Apr 2 | [#11481](https://github.com/ethereum/EIPs/pull/11481) | lightclient | Add signatures list to outer tx (PQ aggregation) |
| Apr 2 | [#11482](https://github.com/ethereum/EIPs/pull/11482) | derekchiang | Allow precompiles for VERIFY frames (all reviewers approved) |
| Apr 6 | [#11488](https://github.com/ethereum/EIPs/pull/11488) | chiranjeev13 | Fix spec inconsistencies (APPROVE scopes, VERIFY count) |
| Apr 17 | [#11537](https://github.com/ethereum/EIPs/pull/11537) | dionysuzx | Add EIP-8141 to CFI in EIP-8081 Hegotá meta EIP (governance) |
| Apr 18 | [#11544](https://github.com/ethereum/EIPs/pull/11544) | derekchiang | Mix in FRAME_TX_TYPE to sighash (EIP-2718 alignment, all reviewers approved) |

### Related

| Date | PR | Author | Description |
|---|---|---|---|
| Apr 11 | [#11509](https://github.com/ethereum/EIPs/pull/11509) | benaadams | Add EIP-8223: Contract Payer Transaction (alternative/complementary sponsorship proposal) |
| Apr 12 | [#11518](https://github.com/ethereum/EIPs/pull/11518) | benaadams | Add EIP-8224: Counterfactual Transaction (shielded gas funding via ZK proofs) |

### Closed (not merged)

| Date | PR | Author | Description | Reason |
|---|---|---|---|---|
| Feb 13 | [#11310](https://github.com/ethereum/EIPs/pull/11310) | marukai67 | Fix link to ERC-7562 | "It's not broken" — lightclient |
| Feb 14 | [#11314](https://github.com/ethereum/EIPs/pull/11314) | marukai67 | Fix link to EIP-2718 | "Not broken, thanks though" — lightclient |
| Feb 15 | [#11321](https://github.com/ethereum/EIPs/pull/11321) | marukai67 | Fix links | "They aren't broken" — lightclient |
| Feb 25 | [#11352](https://github.com/ethereum/EIPs/pull/11352) | lucemans | Accidental PR | Self-closed |
| Mar 13 | [#11404](https://github.com/ethereum/EIPs/pull/11404) | derekchiang | Simplify approval bits | Superseded by #11401 |
| Mar 14 | [#11408](https://github.com/ethereum/EIPs/pull/11408) | SirSpudlington | Migrate default code to EIP-7932 | Rejected: authors want to keep custom behavior |

## Key Contributors

| Person | Handle | Role |
|---|---|---|
| Vitalik Buterin | @vbuterin | Co-author |
| lightclient (Matt) | @lightclient | Co-author, primary spec maintainer, added per-frame `value` (PR #11534, merged Apr 16) |
| Felix Lange | @fjl | Co-author, original PR submitter, opcode design |
| Yoav Weiss | @yoavw | Co-author |
| Alex Forshtat | @forshtat | Co-author, ERC-7562/4337 expertise |
| Dror Tirosh | @drortirosh | Co-author |
| Shahaf Nacson | @shahafn | Co-author |
| Derek Chiang | @derekchiang | Co-author (added Mar 13), EOA support, batching, precompile VERIFY |
| Daniel Von Fange | @DanielVF | Key external reviewer (Monad), adoption/performance critique |
| 0xrcinus (Orca) | @0xrcinus | Active reviewer, mode simplification proposals |
| Francisco Giordano | @frangio | Active reviewer (OpenZeppelin), naming/semantics |
| nlordell | @nlordell | Early reviewer, APPROVE propagation analysis |
| Peter Garamvolgyi | @thegaram33 | Early reviewer, EIP-3607 issue |
| Danno Ferrin | @shemnon | Reviewer, scope creep concerns |
| jochem-brouwer | @jochem-brouwer | Detailed canonical paymaster review |
| Seungmin Jeon | @sm-stack | PoC implementation, atomic batch bit flag idea |
| rmeissner | @rmeissner | Safe team representative, value-in-frames advocate |
| node.cm | @node.cm | Spec reviewer, VERIFY frame count observation |
| Chiranjeev Mishra | @chiranjeev13 | Spec consistency fixes |
| Ben Adams | @benaadams | Spec tightening (PR #11521, merged Apr 14), author of EIP-8223 (Contract Payer Transaction) and EIP-8224 (Counterfactual Transaction) |
| Jacopo | @jacopo-eth | Proposed FRAMERETURNDATASIZE/FRAMERETURNDATACOPY for multi-step flows |
| Franco Victorio | @fvictorio | Raised question about validation-frame execution ordering vs non-frame txs |
| dionysuzx | @dionysuzx | Hegotá meta-EIP maintainer, submitted PR #11537 moving EIP-8141 to CFI |
| Nero_eth | Nero_eth | ethresear.ch analyst; "Three Gates to Privacy" post framing mempool/FOCIL/VOPS constraints on privacy-pool flows through frame transactions |

## External Resources

- [Live Demo](https://demo.eip-8141.ethrex.xyz/)
- [EIP-8141 Latest Spec](https://eips.ethereum.org/EIPS/eip-8141)
- [Ethereum Magicians Discussion](https://ethereum-magicians.org/t/frame-transaction/27617)
- [PoC Implementation by sm-stack](https://github.com/sm-stack/eip8141-poc)
- [PoC Writeup](https://hackmd.io/@TB5b8ghoQyChOtUKB0RsOg/B1PhyMK_be)
- [BundleBear EIP-7702 Metrics](https://www.bundlebear.com/eip7702-overview/ethereum)
- [Account Abstraction Link Tree (matt)](https://hackmd.io/@matt/aa-link-tree)
- [Biconomy: Native AA State-of-Art Q1/26](https://blog.biconomy.io/native-account-abstraction-state-of-art-and-pending-proposals-q1-26/)
- [Openfort: What EIP-8141 Means for Developers](https://www.openfort.io/blog/eip-8141-means-for-developers)
- [FOCIL + Native Account Abstraction](https://ethereum-magicians.org/t/focil-native-account-abstraction/27999)
- [AA-VOPS: A Pragmatic Path Towards Validity-Only Partial Statelessness](https://ethresear.ch/t/a-pragmatic-path-towards-validity-only-partial-statelessness-vops/22236#p-54075-vops-and-native-account-abstraction-aavops-9)
- [Frame vs Tempo — Two clashing philosophies of native AA](https://x.com/decentrek/status/2031013555898900838)
- [The case for Frame Transactions: Flexible Foundation with Powerful Defaults](https://x.com/decentrek/status/2036697881512701997)
- [Frame Transactions and the Three Gates to Privacy](https://ethresear.ch/t/frame-transactions-and-the-three-gates-to-privacy/24666)
- [Your Ethereum Wallet is About to Change Forever](https://dorisgxyz.substack.com/p/your-ethereum-wallet-is-about-to)
- [EIP-8141 Frame Transactions (HackMD)](https://hackmd.io/@dicethedev/HyhbyJA3bg)
- [Frame Transactions vs. SchemedTransactions](https://ethereum-magicians.org/t/frame-transactions-vs-schemedtransactions-for-post-quantum-ethereum/28056)

## Competing Standards

- [EIP-8130: AA by Account Configuration](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8130.md) — [Magicians thread](https://ethereum-magicians.org/t/eip-8130-account-abstraction-by-account-configurations/25952)
- [EIP-8175: Composable Transaction](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8175.md) — [Magicians thread](https://ethereum-magicians.org/t/eip-8175-composable-transaction/27850)
- [EIP-8202: Schemed Transaction](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8202.md) — [Magicians thread](https://ethereum-magicians.org/t/eip-8202-schemed-transaction/28044)
- [EIP-8223: Contract Payer Transaction](https://github.com/ethereum/EIPs/pull/11509) — [Magicians thread](https://ethereum-magicians.org/t/eip-8223-contract-payer-transactions/28202)
- [EIP-8224: Counterfactual Transaction](https://github.com/ethereum/EIPs/pull/11518) — [Magicians thread](https://ethereum-magicians.org/t/eip-8224-counterfactual-transaction/28205)
- [Tempo-like Transaction (gakonst)](https://gist.github.com/gakonst/00117aa2a1cd327f515bc08fb807102e)

