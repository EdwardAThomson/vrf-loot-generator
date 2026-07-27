# Implementation Plan: Hardening the VRF Loot System

_Status: active · created 2026-07-27_

This plan collects the fixes and build-out identified by the July 2026 audit (see `questions.md` answers) and the prior-art research. Work is organized into phases: Phase 1 items are independent and run in parallel; Phase 2 items depend on Phase 1 landing first. Tick items as they complete.

## Phase 1a: Test infrastructure and headless harness

- [x] Fix `jest.config.js`: deleted instead (typo plus jest 27/30 env mismatch); `npm test` (react-scripts) is the single blessed runner
- [x] Make crypto-touching suites runnable: `setupTests.ts` now polyfills `TextEncoder`/`TextDecoder` and `crypto.getRandomValues`; the shadowing un-polyfilled `setupTests.js` duplicate was deleted
- [x] All existing test suites load and run: 6/6 suites, 64 passed, 2 skipped, 0 failures
- [x] Remove the `VRFService` mock from `loot.service.test.ts`: all loot verify tests now run real keygen/evaluate/proofToHash
- [x] Add a true tampered-proof rejection test: single-bit flips in s, t, and the embedded VRF point are all rejected
- [x] Headless harness: `npm run harness` (src/scripts/headless-harness.ts), 12/12 checks PASS, nonzero exit on failure, CI-usable

New known bugs surfaced by 1a (deferred, marked with test.skip + TODO in vrf.service.test.ts):
- [x] `VRFService.evaluate` accepts a garbage private key (elliptic/BN.js silently coerces non-hex strings); should throw (fixed by the Phase 2 ECVRF migration: strict 64-hex-char key validation; test un-skipped)
- [x] `VRFService.evaluate` accepts an empty message (empty `Uint8Array` is truthy so the guard misses it); should throw (fixed by the Phase 2 ECVRF migration; test un-skipped)

## Phase 1b: Core crypto correctness fixes

- [x] Fix `LootService.verifyItem` soundness gap: bind the proof to the supplied output (check the proof's embedded VRF point equals `vrfOutput`, and use `computedIndex` instead of discarding it). Verification now also reconstructs the message from `(blockhash, itemIndex)` rather than trusting the free-form message string
- [x] Fixed-width index encoding: replace `` `${blockhash}-${i}` `` string messages with `tx_hash_bytes || uint32_be(i)` via new `src/utils/message.utils.ts`, applied in generation and verification, plumbed through trade wire types and demo/online-trading call sites
- [x] Tests covering both fixes, including the forged-item case (valid proof for the message, unrelated `vrfOutput`) which previously passed verification: `src/services/loot/__tests__/loot.verify-binding.test.ts`, 14 tests, real crypto

## Phase 1c: Xaya roguelike integration design (separate repo)

- [x] Design doc in `~/Projects/xayaroguelike/docs/` describing how to add player-held-VRF private loot to the Xaya GSP architecture: key registration, seed sourcing in the Xaya move model, where loot generation and verification live (GSP vs channel vs client), trade/reveal flow, and a phased adoption path (written: `xayaroguelike/docs/VRF_PRIVATE_LOOT_INTEGRATION.md`, 418 lines, uncommitted)
- [x] Doc addresses the known pitfalls: registration ordering, input grinding and entry costs, reveal-or-abandon economics, dedicated VRF key derived from wallet signature

## Phase 2: after Phase 1a and 1b land

- [x] Migrate VRF to RFC 9381 ECVRF (prefer edwards25519 suite) replacing the ad-hoc Key Transparency P-256 construction; keep `evaluate`/`verify` service API stable (implemented ECVRF-EDWARDS25519-SHA512-TAI in `src/services/vrf/ecvrf.ts` over @noble/curves + @noble/hashes; validated byte-exact against the RFC 9381 Appendix B.3 vectors; sizes are now pk 32B, pi 80B, beta 64B; added `VRFService.verify` returning beta and deterministic `keyPairFromSeed`)
- [x] Commitment/reveal layer for loot: per-item VRF calls (as now) with `H(O_i)` as the per-item public commitment, items held in a private (sealed) state until the player reveals. Decision note: the earlier "one VRF call + HKDF(O, item:i)" idea was rejected because revealing the master `O` would reveal every item in the segment; per-item VRF preserves the selective reveal the architecture doc requires (implemented in `src/services/loot/loot-commitment.service.ts`: versioned, domain-separated commitment `C_i = sha256(canonical({domain, v, blockhash, itemIndex, publicKey, outputHash: sha256(beta)}))`, public manifest + private per-item records, `revealItem`/`verifyRevealedItem` reusing LootService/VRFService; tests in `loot-commitment.service.test.ts`)
- [x] Stop shipping `O` and the proof at generation time (note: with RFC 9381, `O` = beta is derived from the proof's Gamma point via proof_to_hash, so the proof still reveals `O` and both must be withheld until reveal) (sealed generation publishes only the manifest; the reveal package is the only wire structure carrying beta/pi; trading rejects sealed items in `TradingService.validateTradeItems`/`prepareTradeCommitment`; manifest non-leak asserted in tests and harness)
- [x] Reveal state in the inventory store and UI (sealed vs revealed items) (inventory store gained `sealedManifest`/`sealedRecords` plus `sealLoot`/`revealSealedItem`/`clearSealedLoot`; private records are in-memory only since the store is not persisted; Loot Generator tab gained a Transparent/Sealed mode toggle with face-down commitment cards and per-item Reveal in `SealedLootDisplay.tsx`)
- [x] Rework the trading commit-reveal service weaknesses: canonical serialization instead of `JSON.stringify`, remove the 1-second timestamp tolerance in `verifyReveal` (new `src/utils/canonical.ts` encoder; commitments now bind item identity only, versioned payload `sha256(canonical({v, items, nonce}))`, timestamps are metadata; tests in `src/services/trading/__tests__/commit-reveal.service.test.ts`)

## Phase 3: backlog (not scheduled)

- [x] Replace remaining `alert()` calls with UI feedback (carried from ROADMAP.md). Done: added a Toast system (notifications store + ToastContainer) and an inline cancel confirmation in TradeInterface; no alert() or window.confirm remain in src/.
- [x] Dungeon layout generator from `SHA-256(tx_hash)` per the architecture doc (implemented in `src/services/dungeon/dungeon.service.ts`: public `layout_seed = SHA-256(tx_hash)`, `item_count = (seed[31] % MAX_ITEMS) + 1`, seeded sfc32 PRNG, rooms + L corridors + entrance/exit + per-slot item spots on a 40x25 grid; Dungeon Demo tab ties the public layout to sealed loot via `useSealedLoot`; tests in `src/services/dungeon/__tests__/` plus harness determinism/reachability checks)
- [ ] On-chain contracts: key registration, explore tx, trade settlement

## Constraints

- Phase 1a must not change logic in `src/services/`; Phase 1b must not touch `jest.config.js` or test environment setup. This keeps the parallel work conflict-free.
- The ECVRF migration (Phase 2) rewrites `vrf.service.ts`, which is why Phase 1b's fixes are deliberately minimal there.
