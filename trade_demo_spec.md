# Overview of Desired Functionality
You have an existing system where loot items are generated deterministically using a Verifiable Random Function (VRF) based on a blockhash. Each player's inventory contains items calculated locally, without visibility by other players. You want to extend your app to support:

* Visual Representation of loot items.
* Two Players (assumed on one computer, in two separate browser windows).
* Secure Trading Window:
    * Initially hiding each player's items in the trade (represented by placeholders).
    * Players reveal their items deterministically at the time of trade confirmation by sharing VRF inputs.
    * Completing the trade upon mutual confirmation.



## Detailed Feature Breakdown

### 1. Inventory & Visual Representation

**Current state:**

* Loot is generated locally using VRF/blockhash.
* Loot is currently generated but not visually represented clearly to users.

**Improvement:**

* Each player sees their generated loot visually in their browser inventory interface.
* Inventory displays each item's attributes clearly (e.g., name, rarity, icon).

**Tasks:**

* Create UI inventory components (React recommended).
* Upon loot generation, update player inventory state to display items visually.


### 2. Local Inventory Isolation (Two Users)
**Current state:**

Single user context with loot stored locally.

**Improvement:**

* Support two separate users in separate browser tabs/windows.
* Inventories remain isolated and hidden from each other until explicitly shared.

**Tasks:**

* Implement a simple local-storage or IndexedDB setup to keep loot isolated per browser instance.
* Ensure loot data does not leak across tabs (user-specific identifiers or session isolation).

### 3. Initiating Trade & Trade Window Setup

**New functionality:**

* Players can initiate a trade, opening a shared trade window.
* Each player selects items to commit to the trade, represented initially as dummy placeholders (blank or hidden).

**Tasks:**

* Create a "Start Trade" button and event logic.
* Implement trade window UI with two sections (Player A / Player B).
* Allow each player to select items locally, with UI showing placeholder/dummy visuals initially.
* Securely prepare trade "commitments" using VRF input identifiers, without revealing actual details.

### 4. Commitment & Reveal Logic Using VRF
**Core Mechanic:**

* Players first commit VRF inputs to items without revealing outcomes.
* A mutual reveal occurs once both commitments are locked in.

**Mechanism:**

* **Commit Phase:**

    * Players submit cryptographic "commitments" (hashes) of their VRF inputs without revealing the inputs directly.
    * Display dummy placeholders representing hidden items.

* **Reveal Phase:**

    * Players exchange their VRF inputs upon hitting the reveal button.
    * Using received VRF inputs, each browser recalculates loot deterministically.
    * Real loot replaces placeholders visually upon recalculation.

**Tasks:**

* Implement hashing commitments (e.g., SHA-256) for VRF input secrecy during commit.
* Design a simple protocol for exchanging commitments & reveals (JSON message exchange over local storage, WebSockets, or a local messaging API).
* Implement deterministic recalculation function (VRF calculation already implemented).
* Replace placeholders with real loot visuals post-reveal.


### 5. Mutual Confirmation & Item Transfer
**Finalization:**

* Players confirm they're satisfied after items are revealed.
* Upon mutual confirmation, the items move between inventories securely.

**Tasks:**

* UI: Confirmation button states clearly indicating when both users have confirmed.
* Inventory logic: Update local storage/inventories after confirmations.
* Ensure deterministic and verifiable final state (logging for verification if desired).

**Technical Architecture (Suggestions)**

* Front-end Framework: React (as we are now).
* Data Storage: Browser localStorage or IndexedDB (for inventory persistence per user).
* Secure Commitments: Cryptographic hashing (SHA-256 or Blake2) for commitment secrecy.

**Messaging & Data Exchange:**

For simplicity (same machine scenario):

* Use local storage events for cross-tab communication (window.addEventListener('storage', callback)).
* Or, a simple WebRTC/WebSocket server locally if you prefer an expandable solution later.



