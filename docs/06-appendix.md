# Appendix

[< Back to Index](../README.md)

---

## Complete PR Timeline

| Date | PR | Author | Description | Status |
|---|---|---|---|---|
| Jan 29 | [#11202](https://github.com/ethereum/EIPs/pull/11202) | fjl | Original EIP submission | Merged |
| Jan 29 | [#11205](https://github.com/ethereum/EIPs/pull/11205) | fjl | Fix: elide VERIFY frame data from sig hash | Merged |
| Jan 29 | [#11209](https://github.com/ethereum/EIPs/pull/11209) | kevaundray | Fix: status field number in TXPARAM | Merged |
| Feb 4 | [#11251](https://github.com/ethereum/EIPs/pull/11251) | BonyHanter83 | Add EIP-1559 to requires header | Open |
| Feb 6 | [#11272](https://github.com/ethereum/EIPs/pull/11272) | Thegaram | Disable EIP-3607 for frame transactions | Open |
| Feb 10 | [#11297](https://github.com/ethereum/EIPs/pull/11297) | lightclient | Relax APPROVE to not require top-level frame | Merged |
| Feb 11 | [#11305](https://github.com/ethereum/EIPs/pull/11305) | lightclient | Fix typo | Merged |
| Feb 21 | [#11344](https://github.com/ethereum/EIPs/pull/11344) | derekchiang | Fix CALLER/ADDRESS bug, clarify reverts | Merged |
| Feb 26 | [#11355](https://github.com/ethereum/EIPs/pull/11355) | rakita | Add EIP-8175 Composable Transaction (related) | Merged |
| Mar 5 | [#11379](https://github.com/ethereum/EIPs/pull/11379) | derekchiang | Add EOA support (default code) | Merged |
| Mar 11 | [#11395](https://github.com/ethereum/EIPs/pull/11395) | derekchiang | Add atomic batching | Merged |
| Mar 12 | [#11400](https://github.com/ethereum/EIPs/pull/11400) | fjl | Clean up opcodes: FRAMEDATALOAD/COPY | Merged |
| Mar 12 | [#11401](https://github.com/ethereum/EIPs/pull/11401) | fjl | Add approval bits to frame mode | Merged |
| Mar 13 | [#11402](https://github.com/ethereum/EIPs/pull/11402) | fjl | Fix bit indices (1-indexed) | Merged |
| Mar 13 | [#11404](https://github.com/ethereum/EIPs/pull/11404) | derekchiang | Simplify approval bits (alternative) | Closed |
| Mar 13 | [#11406](https://github.com/ethereum/EIPs/pull/11406) | derekchiang | Add derekchiang as co-author | Merged |
| Mar 14 | [#11408](https://github.com/ethereum/EIPs/pull/11408) | SirSpudlington | Migrate default code to EIP-7932 | Closed |
| Mar 16 | [#11415](https://github.com/ethereum/EIPs/pull/11415) | lightclient | Add mempool policy | Merged |
| Mar 26 | [#11448](https://github.com/ethereum/EIPs/pull/11448) | derekchiang | Update default code for approval bits | Merged |

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
| Derek Chiang | @derekchiang | Co-author (added Mar 13), EOA support & batching |
| Daniel Von Fange | @DanielVF | Key external reviewer (Monad), adoption/performance critique |
| 0xrcinus (Orca) | @0xrcinus | Active reviewer, mode simplification proposals |
| Francisco Giordano | @frangio | Active reviewer (OpenZeppelin), naming/semantics |
| nlordell | @nlordell | Early reviewer, APPROVE propagation analysis |
| Peter Garamvolgyi | @thegaram33 | Early reviewer, EIP-3607 issue |
| Danno Ferrin | @shemnon | Reviewer, scope creep concerns |
| jochem-brouwer | @jochem-brouwer | Detailed canonical paymaster review |
| Seungmin Jeon | @sm-stack | PoC implementation, atomic batch bit flag idea |

## External Resources

- [EIP-8141 Latest Spec](https://eips.ethereum.org/EIPS/eip-8141)
- [Ethereum Magicians Discussion (119 posts)](https://ethereum-magicians.org/t/frame-transaction/27617)
- [PoC Implementation by sm-stack](https://github.com/sm-stack/eip8141-poc)
- [PoC Writeup](https://hackmd.io/@TB5b8ghoQyChOtUKB0RsOg/B1PhyMK_be)
- [BundleBear EIP-7702 Metrics](https://www.bundlebear.com/eip7702-overview/ethereum)

---

[< Previous: Current Spec Overview](./05-current-spec.md)
