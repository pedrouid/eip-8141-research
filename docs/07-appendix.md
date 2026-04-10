# Appendix

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

### Open

| Date | PR | Author | Description |
|---|---|---|---|
| Feb 6 | [#11272](https://github.com/ethereum/EIPs/pull/11272) | Thegaram | Disable EIP-3607 for frame transactions |
| Mar 26 | [#11455](https://github.com/ethereum/EIPs/pull/11455) | SirSpudlington | Default code tweaks for EIP-7392 compatibility |
| Apr 2 | [#11481](https://github.com/ethereum/EIPs/pull/11481) | lightclient | Add signatures list to outer tx (PQ aggregation) |
| Apr 2 | [#11482](https://github.com/ethereum/EIPs/pull/11482) | derekchiang | Allow precompiles for VERIFY frames |
| Apr 6 | [#11488](https://github.com/ethereum/EIPs/pull/11488) | chiranjeev13 | Fix spec inconsistencies (APPROVE scopes, VERIFY count) |

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
| lightclient (Matt) | @lightclient | Co-author, primary spec maintainer |
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

## EthMagicians Discussion

- **Thread**: [Frame Transaction](https://ethereum-magicians.org/t/frame-transaction/27617)
- **Total posts**: 136 (as of April 9, 2026)
- **Last documented coverage**: Posts 1-136

## External Resources

- [EIP-8141 Latest Spec](https://eips.ethereum.org/EIPS/eip-8141)
- [Ethereum Magicians Discussion (136 posts)](https://ethereum-magicians.org/t/frame-transaction/27617)
- [PoC Implementation by sm-stack](https://github.com/sm-stack/eip8141-poc)
- [PoC Writeup](https://hackmd.io/@TB5b8ghoQyChOtUKB0RsOg/B1PhyMK_be)
- [BundleBear EIP-7702 Metrics](https://www.bundlebear.com/eip7702-overview/ethereum)
- [Account Abstraction Link Tree (matt)](https://hackmd.io/@matt/aa-link-tree)

## Competing Standards

- [EIP-8130: Account Abstraction by Account Configuration](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-8130.md) — [Magicians thread](https://ethereum-magicians.org/t/eip-8130-account-abstraction-by-account-configurations/25952)
- [ERC-8221: Wallet Title Deeds](https://github.com/ethereum/ERCs/pull/1658) — [Magicians thread](https://ethereum-magicians.org/t/erc-8221-wallet-title-deeds/28182)
- [EIP-8175: Composable Transaction](https://github.com/ethereum/EIPs/pull/11355) — Simpler alternative, no new opcodes
- [Biconomy: Native AA State-of-Art Q1/26](https://blog.biconomy.io/native-account-abstraction-state-of-art-and-pending-proposals-q1-26/)
- [Openfort: What EIP-8141 Means for Developers](https://www.openfort.io/blog/eip-8141-means-for-developers)

