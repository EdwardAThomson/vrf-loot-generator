# VRF Loot Trading System

This document explains the trading system added to the VRF Loot Generator application. The system allows players to securely trade items using a commit-reveal protocol based on Verifiable Random Functions (VRFs).

## Table of Contents

1. [System Overview](#system-overview)
2. [Key Components](#key-components)
3. [Trading Flow](#trading-flow)
4. [Security Considerations](#security-considerations)
5. [Future Improvements](#future-improvements)

## System Overview

The VRF Loot Trading System enables two players to securely trade items with each other, while maintaining the cryptographic guarantees provided by VRFs. This ensures that:

- Items remain hidden until both players commit to the trade
- Items can be verified as authentic using VRF cryptography
- The trade process is transparent and tamper-proof

The system uses a **commit-reveal** protocol, where players first commit to their items (without revealing them), then mutually reveal them, verify their authenticity, and finally confirm the trade.

## Key Components

### 1. TradeContext.js

The core state management system that handles:
- Player identification
- Inventory tracking
- Cross-tab communication
- Trade state (commit, reveal, confirm)
- VRF data exchange

```javascript
// Key functions
initiateTradeRequest() // Start a trade with another player
offerItems() // Select items to trade
commitItems() // Create and share cryptographic commitments
revealItems() // Reveal VRF data for verification
confirmTrade() // Finalize the trade after verification
```

### 2. TradeVRF.js

The cryptographic layer that handles:
- VRF item commitments
- Verification of item authenticity
- Item property generation from VRF outputs

```javascript
// Creates a commitment for an item without revealing it
createItemCommitment(privateKey, blockhash, index, nonce)

// Creates a commitment from existing VRF data
createItemCommitmentFromData(vrfOutput, nonce)

// Verifies a commitment matches the revealed data
verifyItemCommitment(commitment, revealedData)

// Regenerates an item from VRF data, optionally verifying it
regenerateLootItem(vrfData, privateKey, publicKey)

// Generates item properties (rarity, type, etc.) from VRF output
determineItemProperties(vrfOutput)
```

### 3. InventoryDisplay.js

UI component for displaying and selecting items:
- Grid display of inventory items
- Visual representation of item properties
- Item selection interface for trading

### 4. TradeWindow.js

UI component for the trading interface:
- Display of offered items from both players
- Placeholder items during commit phase
- Trade progression controls (commit, reveal, confirm)
- Status indicators for trade progress

### 5. TradingDashboard.js

Main component that ties everything together:
- Item generation
- Trade initiation
- Player identification
- Inventory management

## Trading Flow

The trading process follows these steps:

### 1. Trade Initiation

- Player A initiates a trade, sending their public key
- Player B receives notification and the trade window opens
- Both players can now select items to offer

### 2. Commitment Phase

- Players select items to offer in the trade
- When ready, each player creates cryptographic "commitments" for their items
  - These commitments hide the actual items but prove their properties
  - Each commitment includes a nonce to prevent replay attacks
- Players exchange these commitments

### 3. Reveal Phase

- Once both players have committed, they can reveal their items
- Each player sends the actual VRF data that corresponds to their commitments
- The receiving player verifies:
  1. The VRF data matches the commitments
  2. The VRF outputs are cryptographically valid (using the sender's public key)
- Items are displayed with their true properties

### 4. Confirmation Phase

- Players review the revealed items
- If satisfied, players confirm the trade
- When both players confirm, items are exchanged between inventories

## Security Considerations

### Cryptographic Verification

- **VRF Proof Validation**: Each item's authenticity is verified using the VRF proof and the other player's public key
- **Commitment Verification**: Commitments ensure players can't change their offered items after both have committed
- **Nonce Usage**: Prevents replay attacks by making each commitment unique

### Data Isolation

- **Session-Based IDs**: Each browser tab gets a unique player ID
- **In-Memory Storage**: Item data is kept in memory rather than localStorage to prevent cross-tab leakage

### Communication Security

- **BroadcastChannel API**: Enables secure cross-tab communication
- **Trade Protocol**: Follows a strict commit-reveal-confirm pattern to prevent cheating

## Future Improvements

Potential enhancements for the trading system:

1. **Network Support**: Extend beyond browser tabs to support players on different machines
2. **Enhanced Visualization**: Add more detailed item visuals with sprites/images
3. **Trade History**: Add logging of past trades and their outcomes
4. **Multi-Item Verification**: Optimize batch verification of multiple items
5. **Escrow Mechanism**: Add support for conditional trades or time-locked trades

---

## Technical Implementation Details

### Cross-Tab Communication

The system uses the BroadcastChannel API to enable communication between different browser tabs:

```javascript
// Initialize a broadcast channel
const tradeChannel = new BroadcastChannel('trade_channel');

// Send a message
tradeChannel.postMessage({
  type: 'trade_request',
  data: { publicKey },
  sender: playerId,
  timestamp: Date.now()
});

// Receive messages
tradeChannel.addEventListener('message', handleMessage);
```

### VRF Commitment Creation

When a player commits to trading an item, a cryptographic commitment is created:

```javascript
// Create a commitment from VRF output
const commitment = sha256(toHexString(vrfOutput) + nonce.toString());
```

### Item Verification Process

During the reveal phase, items are verified using the following process:

1. The receiving player uses the sender's public key to verify the VRF proof
2. The VRF output is checked against the earlier commitment
3. The item properties are regenerated from the VRF output
4. Only items that pass verification are added to the trade

## Running Multiple Players

To test the trading system:

1. Open the application in two browser tabs
2. In each tab:
   - Generate a key pair in the VRF Testing tab
   - Set a blockhash (must be the same in both tabs)
   - Go to the Trading tab
   - Generate some items
3. In one tab, click "Start Trade"
4. Follow the commit, reveal, and confirm steps in both tabs

Note that each tab represents a different player with a separate inventory.