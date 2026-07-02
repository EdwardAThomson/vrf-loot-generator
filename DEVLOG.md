# Development Log

## 2026-07-01

Brought the state documentation back in line with where the app actually is. The UI had grown a fourth tab, so the README's Usage section now lists all four app tabs (VRF Testing, Loot Generator, Trade Demo, Trading System) rather than the stale set of three. The WebSocket testing guide was also reconciled with reality: its recorded server startup console output and the trading tab name were updated to match the current app.

**Decisions & notes:** Docs-only reconciliation, no behavior changes. This follows the recent addition of the deterministic trade demo (commit-reveal flow with VRF verification), which is what pushed the tab count and server output out of sync with the docs.
