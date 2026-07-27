# Deterministic Trade Demo - Code Explanation

This document provides a comprehensive explanation of the Deterministic Trade Demo code, detailing how functions are called, how data flows through the system, and how the commit-reveal protocol is implemented with real VRF cryptography.

---

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Data Generation (`generateDemoData.ts`)](#data-generation)
4. [Component State & Initialization](#component-state--initialization)
5. [The Commit-Reveal Protocol](#the-commit-reveal-protocol)
6. [Function-by-Function Breakdown](#function-by-function-breakdown)
7. [Data Flow Diagram](#data-flow-diagram)
8. [Cryptographic Operations](#cryptographic-operations)
9. [React State Management](#react-state-management)
10. [Security Guarantees](#security-guarantees)

---

## Overview

The Deterministic Trade Demo simulates a secure peer-to-peer item trade between two players (Alice and Bob) using:

1. **Real VRF (Verifiable Random Function)** - Items are generated using actual elliptic curve cryptography
2. **Commit-Reveal Protocol** - Prevents cheating by requiring both parties to commit before revealing
3. **Deterministic Data** - Fixed private keys and blockhashes ensure the same items every time (for debugging)

### Why Deterministic?

In production, keys and blockhashes would be random. For this demo, we use fixed values so:
- The same items appear every time you run the demo
- You can trace exact values through the protocol
- Debugging is reproducible

---

## File Structure

```
src/components/features/deterministic-trade/
├── DeterministicTradeDemo.tsx      # Main React component
├── DeterministicTradeDemo.module.css  # Styles
└── generateDemoData.ts             # VRF data generation
```

---

## Data Generation

### File: `generateDemoData.ts`

This file generates cryptographically valid items using real VRF operations.

### Fixed Inputs (Deterministic)

```typescript
// Real elliptic curve private keys (ed25519, RFC 9381 ECVRF)
const ALICE_PRIVATE_KEY = '5d0247d9e4e1ece46a703365875d4c80355781f4ea632e0e703fc7537ceab0cb';
const BOB_PRIVATE_KEY = 'df9a386c02ebc0df405cc256057b8886fdfa0fcd55b04409870fa6aa3b56a3ad';

// Fixed blockhashes (input to VRF)
const ALICE_BLOCKHASH = 'alice-demo-blockhash-fixed-12345';
const BOB_BLOCKHASH = 'bob-demo-blockhash-fixed-67890';
```

### `generateAliceData()` Function

**Purpose:** Generate Alice's player data and 2 items using VRF.

**Flow:**
```
ALICE_PRIVATE_KEY
        │
        ▼
┌───────────────────────────────────┐
│ VRFService.getPublicKeyFromPrivate │
└───────────────────────────────────┘
        │
        ▼
   ALICE_PUBLIC_KEY (derived)
        │
        ▼
┌───────────────────────────────────┐
│ LootService.generateMultipleItems │
│   - privateKey: ALICE_PRIVATE_KEY │
│   - blockhash: ALICE_BLOCKHASH    │
│   - count: 2                      │
└───────────────────────────────────┘
        │
        ▼
   2 LootItems with VRF proofs
        │
        ▼
┌───────────────────────────────────┐
│ Convert to DemoItem format        │
│   - Uint8Array → hex strings      │
└───────────────────────────────────┘
        │
        ▼
   { player: DemoPlayer, items: DemoItem[] }
```

**Code Walkthrough:**

```typescript
export function generateAliceData(): { player: DemoPlayer; items: DemoItem[] } {
  // Step 1: Derive public key from private key
  const publicKey = VRFService.getPublicKeyFromPrivate(ALICE_PRIVATE_KEY);
  
  // Step 2: Create player object
  const player: DemoPlayer = {
    id: 'alice',
    name: 'Alice',
    publicKey,
    privateKey: ALICE_PRIVATE_KEY
  };
  
  // Step 3: Generate items using VRF
  // This calls VRFService.evaluate() internally for each item
  const lootItems = LootService.generateMultipleItems(
    ALICE_PRIVATE_KEY,
    ALICE_BLOCKHASH,
    2  // Generate 2 items
  );
  
  // Step 4: Convert binary data to hex strings for display
  const items: DemoItem[] = lootItems.map(item => {
    // Convert Uint8Array proof to hex string
    let proofString = '';
    if (item.vrfData?.proof) {
      if (typeof item.vrfData.proof === 'string') {
        proofString = item.vrfData.proof;
      } else {
        proofString = Array.from(item.vrfData.proof)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    }
    
    // Convert Uint8Array vrfOutput to hex string
    let vrfOutputString = '';
    if (item.vrfData?.vrfOutput) {
      // ... similar conversion
    }
    
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      modifier: item.modifier,
      vrfProof: {
        publicKey: item.vrfData?.publicKey || publicKey,
        proof: proofString,
        message: item.vrfData?.message || '',
        hash: vrfOutputString
      }
    };
  });
  
  return { player, items };
}
```

### `generateBobData()` Function

Identical to `generateAliceData()` but uses Bob's private key and blockhash.

### `verifyDemoItem()` Function

**Purpose:** Verify that an item's VRF proof is valid.

**Flow:**
```
DemoItem + publicKey
        │
        ▼
┌───────────────────────────────────┐
│ Convert DemoItem → LootItem       │
│   - hex strings → vrfData format  │
└───────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│ LootService.verifyItem()          │
│   1. Verify VRF proof             │
│   2. Regenerate item from output  │
│   3. Compare properties           │
└───────────────────────────────────┘
        │
        ▼
   true/false
```

---

## Component State & Initialization

### File: `DeterministicTradeDemo.tsx`

### State Variables

```typescript
// Trade protocol state
const [currentStep, setCurrentStep] = useState<TradeStep>('SETUP');
const [tradeId, setTradeId] = useState<string | null>(null);
const [logs, setLogs] = useState<string[]>([]);

// Player data (generated once, cached with useMemo)
const aliceData = useMemo(() => generateAliceData(), []);
const bobData = useMemo(() => generateBobData(), []);

// Inventory tracking
const [aliceInventory, setAliceInventory] = useState<DemoItem[]>(aliceItems);
const [bobInventory, setBobInventory] = useState<DemoItem[]>(bobItems);

// Commitment data (for commit-reveal protocol)
const [aliceCommitment, setAliceCommitment] = useState<string>('');
const [aliceNonce, setAliceNonce] = useState<string>('');
const [bobCommitment, setBobCommitment] = useState<string>('');
const [bobNonce, setBobNonce] = useState<string>('');

// Refs for auto-run (avoid React state timing issues)
const tradeIdRef = useRef<string | null>(null);
const aliceNonceRef = useRef<string>('');
const aliceCommitmentRef = useRef<string>('');
const bobNonceRef = useRef<string>('');
const bobCommitmentRef = useRef<string>('');
```

### Why `useMemo` for Player Data?

```typescript
const aliceData = useMemo(() => generateAliceData(), []);
```

**Problem without `useMemo`:**
- `generateAliceData()` would be called on every render
- Each call generates items with new IDs (timestamp-based)
- Commitment hash of items at Step 2 ≠ hash at Step 4
- Commitment verification fails!

**Solution with `useMemo`:**
- `generateAliceData()` called only once
- Same items used throughout entire session
- Commitment hashes match

### Why `useRef` for Auto-Run?

React's `setState` is asynchronous. When auto-run calls functions in sequence with `setTimeout`:

```typescript
setTimeout(() => handleAliceCommit(), 1600);  // Sets aliceNonce via setState
setTimeout(() => handleAliceReveal(), 3200);  // Needs aliceNonce
```

The state might not have updated by the time `handleAliceReveal` runs.

**Solution:** Store values in both state AND refs:
```typescript
setAliceNonce(nonce);           // For React re-renders
aliceNonceRef.current = nonce;  // Immediate access

// In handleAliceReveal:
const nonce = aliceNonce || aliceNonceRef.current;  // Use whichever is available
```

---

## The Commit-Reveal Protocol

### Why Commit-Reveal?

Without commit-reveal, a malicious player could:
1. See what items the other player is offering
2. Decide to cancel if they don't like the trade
3. Or swap in different items at the last moment

### Protocol Steps

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMMIT-REVEAL PROTOCOL                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STEP 1: INITIATE                                               │
│  ┌─────────┐                              ┌─────────┐           │
│  │  Alice  │ ──── "I want to trade" ────▶ │   Bob   │           │
│  └─────────┘                              └─────────┘           │
│                                                                 │
│  STEP 2: ALICE COMMITS                                          │
│  ┌─────────┐                                                    │
│  │  Alice  │ ──── commitment = SHA256(items + nonce) ────▶      │
│  └─────────┘      (keeps items and nonce SECRET)                │
│                                                                 │
│  STEP 3: BOB COMMITS                                            │
│  ┌─────────┐                                                    │
│  │   Bob   │ ──── commitment = SHA256(items + nonce) ────▶      │
│  └─────────┘      (keeps items and nonce SECRET)                │
│                                                                 │
│  ═══════════════════════════════════════════════════════════    │
│  At this point, BOTH players are locked in. They cannot         │
│  change their items without the commitment hash changing.       │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  STEP 4: ALICE REVEALS                                          │
│  ┌─────────┐                                                    │
│  │  Alice  │ ──── reveals items + nonce ────▶                   │
│  └─────────┘      Bob verifies: SHA256(items + nonce) == commit │
│                                                                 │
│  STEP 5: BOB REVEALS                                            │
│  ┌─────────┐                                                    │
│  │   Bob   │ ──── reveals items + nonce ────▶                   │
│  └─────────┘      Alice verifies: SHA256(items + nonce) == commit│
│                                                                 │
│  STEP 6: COMPLETE                                               │
│  ┌─────────┐                              ┌─────────┐           │
│  │  Alice  │ ◀──── items exchanged ─────▶ │   Bob   │           │
│  └─────────┘      (VRF proofs verified)   └─────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Function-by-Function Breakdown

### `handleSetup()`

**Purpose:** Display initial player and item information.

**Called by:** Auto-run, or when user wants to see setup info.

**Actions:**
1. Log player names and public keys
2. Log each item with its VRF hash
3. Initialize inventories
4. Set step to 'SETUP'

```typescript
const handleSetup = () => {
  addLog('🔧 Setting up deterministic trade demo with REAL VRF...');
  addLog(`👤 Player 1: ${alice.name} (${alice.id})`);
  addLog(`  Public Key: ${alice.publicKey.substring(0, 20)}...`);
  // ... log Bob's info
  
  addLog('📦 Generating Alice\'s items with VRF...');
  aliceItems.forEach((item, i) => {
    addLog(`  ${i + 1}. ${item.name} (${item.rarity})`);
    addLog(`     VRF Hash: ${item.vrfProof.hash.substring(0, 20)}...`);
  });
  // ... log Bob's items
  
  setAliceInventory([...aliceItems]);
  setBobInventory([...bobItems]);
  setCurrentStep('SETUP');
};
```

---

### `handleInitiateTrade()`

**Purpose:** Start a new trade session.

**Called by:** Button click or auto-run.

**Actions:**
1. Generate unique trade ID
2. Log the trade initiation
3. Set step to 'INITIATED'

```typescript
const handleInitiateTrade = () => {
  addLog('📤 STEP 1: Alice initiates trade');
  addLog(`  Offering: ${aliceItems.map(i => i.name).join(', ')}`);
  
  const newTradeId = `trade-${Date.now()}`;
  setTradeId(newTradeId);
  
  addLog(`  Trade ID: ${newTradeId}`);
  setCurrentStep('INITIATED');
};
```

---

### `handleAliceCommit()`

**Purpose:** Alice creates a cryptographic commitment to her items.

**Called by:** Button click (when step is 'INITIATED') or auto-run.

**Cryptographic Operation:**
```
commitment = SHA256(canonicalize({ v: 1, items: committedItemFields, nonce }))
```

The hash uses a canonical (deterministic) serialization and binds item identity fields only (id, name, type, rarity, modifier, and the VRF identity data), so key ordering and display-only fields cannot change the hash. See `CommitRevealService.computeCommitmentHash`.

**Actions:**
1. Check trade exists (via state or ref)
2. Create fixed nonce: `'alice-nonce-fixed-12345'`
3. Compute the canonical commitment hash over (items, nonce)
4. Store nonce and commitment in state AND refs
5. Set step to 'ALICE_COMMITTED'

```typescript
const handleAliceCommit = () => {
  // Check both state and ref for tradeId (ref is for auto-run)
  if (!tradeId && !tradeIdRef.current) return;

  // Create canonical commitment (binds item identity + nonce)
  const nonce = 'alice-nonce-fixed-12345';
  const commitment = CommitRevealService.computeCommitmentHash(aliceItems, nonce);

  setAliceNonce(nonce);
  setAliceCommitment(commitment);
  aliceNonceRef.current = nonce;
  aliceCommitmentRef.current = commitment;

  addLog(`  Commitment: ${commitment.substring(0, 20)}...`);
  setCurrentStep('ALICE_COMMITTED');
};
```

**Security Note:** In production, the nonce would be randomly generated. Here it's fixed for reproducibility.

---

### `handleBobCommit()`

**Purpose:** Bob creates a cryptographic commitment to his items.

**Called by:** Button click (when step is 'ALICE_COMMITTED') or auto-run.

**Identical to Alice's commit, but with Bob's data:**
- Nonce: `'bob-nonce-fixed-67890'`
- Items: `bobItems`

---

### `handleAliceReveal()`

**Purpose:** Alice reveals her items and nonce; Bob verifies the commitment.

**Called by:** Button click (when step is 'BOB_COMMITTED') or auto-run.

**Verification Process:**
```
recomputed = SHA256(canonicalize({ v: 1, items: revealed_item_fields, nonce }))
valid = (recomputed === original_commitment)
```

Verification uses `CommitRevealService.verifyCommitmentHash`, which recomputes the same canonical hash from the revealed items and nonce.

**Actions:**
1. Check trade exists
2. Get nonce from state or ref (for auto-run compatibility)
3. Get commitment from state or ref
4. Log revealed items and nonce
5. Recompute commitment hash
6. Compare with stored commitment
7. Log verification result
8. Set step to 'ALICE_REVEALED'

```typescript
const handleAliceReveal = () => {
  if (!tradeId && !tradeIdRef.current) return;
  
  // Use ref values if state hasn't updated yet (auto-run)
  const nonce = aliceNonce || aliceNonceRef.current;
  const commitment = aliceCommitment || aliceCommitmentRef.current;
  
  addLog('🔓 STEP 4: Alice reveals her items');
  addLog(`  Nonce: ${nonce}`);
  addLog(`  Items: ${aliceItems.map(i => i.name).join(', ')}`);
  
  // Verify commitment
  const CryptoJS = require('crypto-js');
  const itemsString = JSON.stringify(aliceItems);
  const recomputedCommitment = CryptoJS.SHA256(itemsString + nonce).toString();
  
  if (recomputedCommitment === commitment) {
    addLog('  ✅ Commitment verified!');
  } else {
    addLog('  ❌ Commitment mismatch!');
  }
  
  setCurrentStep('ALICE_REVEALED');
};
```

---

### `handleBobReveal()`

**Purpose:** Bob reveals his items and nonce; Alice verifies the commitment.

**Called by:** Button click (when step is 'ALICE_REVEALED') or auto-run.

**Identical to Alice's reveal, but with Bob's data.**

---

### `handleCompleteTrade()`

**Purpose:** Verify VRF proofs and exchange items.

**Called by:** Button click (when step is 'BOB_REVEALED') or auto-run.

**VRF Verification Process:**
```
For each item:
  1. Extract VRF proof from item
  2. Verify proof against player's public key
  3. Regenerate item properties from VRF output
  4. Compare regenerated properties with claimed properties
  5. If all match → item is valid
```

**Actions:**
1. Check trade exists
2. Verify all of Alice's items using `verifyDemoItem()`
3. Verify all of Bob's items using `verifyDemoItem()`
4. If any item fails → abort trade
5. If all valid → exchange inventories
6. Log final inventory state
7. Set step to 'COMPLETED'

```typescript
const handleCompleteTrade = () => {
  if (!tradeId && !tradeIdRef.current) return;
  
  addLog('✅ STEP 6: Completing trade');
  addLog('  Verifying items with REAL VRF proofs...');
  
  let allValid = true;
  
  // Verify Alice's items
  aliceItems.forEach(item => {
    const isValid = verifyDemoItem(item, alice.publicKey);
    if (isValid) {
      addLog(`    ✅ ${item.name}: VRF proof VALID`);
    } else {
      addLog(`    ❌ ${item.name}: VRF proof INVALID`);
      allValid = false;
    }
  });
  
  // Verify Bob's items
  bobItems.forEach(item => {
    const isValid = verifyDemoItem(item, bob.publicKey);
    // ... same logic
  });
  
  if (!allValid) {
    addLog('❌ Trade FAILED: Some items failed VRF verification!');
    setCurrentStep('SETUP');
    return;
  }
  
  // Exchange inventories
  setAliceInventory([...bobItems]);
  setBobInventory([...aliceItems]);
  
  addLog('🎉 Trade completed successfully!');
  setCurrentStep('COMPLETED');
};
```

---

### `handleReset()`

**Purpose:** Reset the demo to initial state.

**Actions:**
1. Reset step to 'SETUP'
2. Clear trade ID (state and ref)
3. Clear all nonces and commitments (state and refs)
4. Clear logs
5. Reset inventories to original items

---

### `handleAutoRun()`

**Purpose:** Run all steps automatically with delays.

**Timing:**
```
0ms:    Reset state, run setup
0ms:    Create tradeId (state + ref)
800ms:  Step 1 - Initiate trade
1600ms: Step 2 - Alice commits
2400ms: Step 3 - Bob commits
3200ms: Step 4 - Alice reveals
4000ms: Step 5 - Bob reveals
4800ms: Step 6 - Complete trade
```

**Key Implementation Detail:**
```typescript
// Create trade ID immediately and store in BOTH state and ref
const newTradeId = `trade-${Date.now()}`;
setTradeId(newTradeId);
tradeIdRef.current = newTradeId;  // Ref updates immediately!
```

This ensures subsequent steps can access `tradeId` via the ref even if React hasn't processed the state update yet.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW OVERVIEW                                │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────┐
                    │     generateDemoData.ts          │
                    │                                  │
                    │  ALICE_PRIVATE_KEY ─────┐        │
                    │  ALICE_BLOCKHASH ───────┼──▶ VRF │
                    │                         │        │
                    │  BOB_PRIVATE_KEY ───────┤        │
                    │  BOB_BLOCKHASH ─────────┘        │
                    └──────────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────┐
                    │  generateAliceData()             │
                    │  generateBobData()               │
                    │                                  │
                    │  Returns:                        │
                    │  - player: { id, name, keys }    │
                    │  - items: [ DemoItem, ... ]      │
                    └──────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DeterministicTradeDemo.tsx                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ useMemo(() => generateAliceData(), [])  ◀── Called ONCE             │   │
│  │ useMemo(() => generateBobData(), [])                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         STATE                                       │   │
│  │                                                                     │   │
│  │  aliceItems ────────────────────────────────────────────────────┐   │   │
│  │  bobItems ──────────────────────────────────────────────────────┤   │   │
│  │                                                                 │   │   │
│  │  aliceInventory ◀───────────────────────────────────────────────┤   │   │
│  │  bobInventory ◀─────────────────────────────────────────────────┤   │   │
│  │                                                                 │   │   │
│  │  aliceCommitment ◀── SHA256(items + nonce)                      │   │   │
│  │  aliceNonce ◀─────── 'alice-nonce-fixed-12345'                  │   │   │
│  │  bobCommitment ◀──── SHA256(items + nonce)                      │   │   │
│  │  bobNonce ◀───────── 'bob-nonce-fixed-67890'                    │   │   │
│  │                                                                 │   │   │
│  │  currentStep ◀────── SETUP → INITIATED → ALICE_COMMITTED → ... │   │   │
│  │  tradeId ◀────────── 'trade-1703600000000'                      │   │   │
│  └─────────────────────────────────────────────────────────────────┘   │   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       FUNCTIONS                                     │   │
│  │                                                                     │   │
│  │  handleSetup() ──────────▶ Logs player/item info                    │   │
│  │  handleInitiateTrade() ──▶ Creates tradeId                          │   │
│  │  handleAliceCommit() ────▶ Creates commitment hash                  │   │
│  │  handleBobCommit() ──────▶ Creates commitment hash                  │   │
│  │  handleAliceReveal() ────▶ Verifies Alice's commitment              │   │
│  │  handleBobReveal() ──────▶ Verifies Bob's commitment                │   │
│  │  handleCompleteTrade() ──▶ Verifies VRF proofs, exchanges items     │   │
│  │  handleReset() ──────────▶ Resets all state                         │   │
│  │  handleAutoRun() ────────▶ Runs all steps with delays               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cryptographic Operations

### 1. VRF Key Generation

```typescript
// In generateDemoData.ts
const publicKey = VRFService.getPublicKeyFromPrivate(ALICE_PRIVATE_KEY);
```

**What happens:**
- Private key (32-byte seed) → Public key (32-byte ed25519 point, per RFC 9381 ECVRF)
- Public key is used for verification
- Private key is used for generating the VRF output and proof

### 2. VRF Item Generation

```typescript
// In LootService.generateMultipleItems()
const vrfResult = VRFService.evaluate(privateKey, messageBuffer);
```

**What happens:**
1. Message = `blockhash_bytes || uint32_be(index)` (fixed-width binary encoding, no ambiguity between blockhash and index)
2. VRF evaluates: `output = VRF(privateKey, message)` (80-byte proof, 64-byte output)
3. Returns: `{ vrfOutput, proof, index }`
4. Item properties derived from `SHA-256(vrfOutput)` bytes

### 3. Commitment Hash

```typescript
// In handleAliceCommit()
const commitment = CryptoJS.SHA256(itemsString + nonce).toString();
```

**What happens:**
1. Items serialized to JSON: `'[{"id":"...","name":"Icy Dagger",...}]'`
2. Nonce appended: `'[...]alice-nonce-fixed-12345'`
3. SHA256 hash computed: `'a3f5e8c9d2b1f4e7...'`
4. Hash is the commitment (64 hex characters)

### 4. Commitment Verification

```typescript
// In handleAliceReveal()
const recomputedCommitment = CryptoJS.SHA256(itemsString + nonce).toString();
if (recomputedCommitment === commitment) { /* valid */ }
```

**What happens:**
1. Same computation as commit step
2. If items or nonce changed → different hash
3. Hash match proves items weren't modified

### 5. VRF Verification

```typescript
// In handleCompleteTrade()
const isValid = verifyDemoItem(item, alice.publicKey);
```

**What happens (inside LootService.verifyItem):**
1. Extract VRF proof from item
2. Verify proof: `VRFService.proofToHash(publicKey, message, proof)`
3. Regenerate item from VRF output
4. Compare: `item.rarity === regenerated.rarity` etc.
5. All match → item is cryptographically valid

---

## React State Management

### State vs Refs

| Aspect | useState | useRef |
|--------|----------|--------|
| Updates | Async (batched) | Sync (immediate) |
| Triggers re-render | Yes | No |
| Access timing | After render | Immediate |
| Use case | UI display | Auto-run timing |

### Why Both?

```typescript
// Setting a value
setAliceNonce(nonce);           // For UI updates
aliceNonceRef.current = nonce;  // For immediate access

// Reading a value
const nonce = aliceNonce || aliceNonceRef.current;  // Fallback to ref
```

**Manual clicks:** State is already updated from previous render → use state
**Auto-run:** State might not be updated yet → use ref as fallback

---

## Security Guarantees

### 1. Items Cannot Be Forged

**Guarantee:** An item's properties (type, rarity, modifier) are cryptographically bound to its VRF proof.

**How:**
- VRF output is deterministic for a given (privateKey, message) pair
- Item properties are derived from VRF output bytes
- Changing properties without changing VRF output is computationally infeasible
- Verification regenerates properties and compares

### 2. Commitments Cannot Be Changed

**Guarantee:** Once committed, a player cannot change their items without detection.

**How:**
- Commitment = SHA256(items + nonce)
- SHA256 is collision-resistant
- Finding different items with same hash is computationally infeasible
- Reveal phase recomputes hash and compares

### 3. Items Cannot Be Swapped Mid-Trade

**Guarantee:** The items revealed must match the items committed.

**How:**
- Commit phase: hash stored
- Reveal phase: hash recomputed from revealed items
- Mismatch → trade fails

### 4. VRF Proofs Are Unforgeable

**Guarantee:** Only the private key holder can generate valid VRF proofs.

**How:**
- VRF proof requires knowledge of private key
- Public key verification confirms proof validity
- Forging a proof without private key is computationally infeasible

---

## Summary

The Deterministic Trade Demo implements a secure trading protocol with:

1. **Real VRF cryptography** - Items are generated using elliptic curve operations
2. **Commit-reveal protocol** - Prevents cheating by locking in items before reveal
3. **Deterministic data** - Fixed keys and blockhashes for reproducible debugging
4. **Proper React state management** - useMemo for caching, useRef for timing

The code ensures that:
- Items are cryptographically verifiable
- Commitments prevent mid-trade modifications
- VRF proofs prove item authenticity
- The protocol completes atomically (all-or-nothing)

This demo accurately represents how a production trading system would work, just with fixed inputs for debugging purposes.
