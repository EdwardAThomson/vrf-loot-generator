# Roadmap — vrf-loot-generator

_Status: active · updated 2026-05-30_

> A React/TypeScript app demonstrating private, verifiably-random loot generation with VRFs, plus a WebSocket-backed online trading system using a commit-reveal protocol.
>
> Collated from docs/REFACTOR_PLAN.md and docs/DEPLOYMENT_STRATEGY.md. (docs/FEATURE_COMPARISON.md was excluded — its checkboxes are a feature-status matrix / stale duplicates of the refactor phases, not an actionable task list.)

## Core Architecture & Infrastructure
- [x] TypeScript infrastructure and core type definitions
- [x] Zustand stores for all state (vrf, inventory, player, players, trading)
- [x] Single source-of-truth VRF service used everywhere
- [x] Clean component separation (no inline CSS; CSS Modules throughout)
- [x] Custom hooks for VRF, loot, inventory, trading, and WebSocket
- [x] Reusable UI component library (Card / Button / Input)
- [x] Full TypeScript coverage

## Features — Loot & VRF
- [x] Deterministic VRF-based loot generation with verification
- [x] VRF testing tab (key pairs, compute output, verify proofs)
- [x] Loot generator tab with inventory management

## Trading System
- [x] Commit-reveal protocol service (SHA-256) preventing cheating
- [x] Trading service layer (item validation, VRF integration, fairness)
- [x] Trading UI components and custom trading hooks
- [x] Cross-browser online trading

## WebSocket Backend & Online Trading
- [x] Node.js WebSocket server (Socket.io) under server/
- [x] Frontend WebSocket service with reconnection logic
- [x] Player session management (login/logout, persistent state)
- [x] Room management (create / join trading rooms)
- [x] Real-time cross-browser player lists and trade coordination

## Polish & Hardening
- [ ] Proper error handling — replace remaining alert() calls with UI feedback
- [ ] Unit tests for trading services and components
- [ ] VRF service crypto tests (blocked by Jest/crypto library compatibility)

## Backlog

### Deployment (not started)
- [ ] Test locally with production-like environment variables
- [ ] Verify TypeScript compilation passes for production build
- [ ] Update CORS origins for production domains
- [ ] Set up environment variables on hosting platforms (frontend + backend)
- [ ] Test WebSocket connections over WSS
- [ ] Verify frontend loads correctly in production
- [ ] Test WebSocket connection establishment in production
- [ ] Verify cross-browser functionality in production
- [ ] Test room creation and joining in production
- [ ] Validate trade initiation works in production
- [ ] Monitor error logs after deployment
- [ ] Configure custom domain for frontend (optional)
- [ ] Set up SSL certificates (optional)
- [ ] Update WebSocket URL to use custom domain (optional)
- [ ] Test end-to-end with custom domains (optional)

### Future Enhancements
- [ ] Enhanced trading history and targeted trade requests
- [ ] Performance optimization (code splitting, lazy loading)
- [ ] Redis-backed session storage and persistent trade-history database
- [ ] Rate limiting and structured production logging
- [ ] Error tracking / monitoring (e.g. Sentry)

## Notes

- Deployment work lives in the Backlog: it is documented (docs/DEPLOYMENT_STRATEGY.md) but unstarted, so it is excluded from the headline progress.
- The "Current Working Features" ticks in docs/FEATURE_COMPARISON.md describe already-shipped capabilities and are reflected above under the Features / Trading / Backend sections rather than carried over verbatim.
