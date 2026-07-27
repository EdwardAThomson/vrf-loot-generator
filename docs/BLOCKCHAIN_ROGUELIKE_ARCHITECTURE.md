# Blockchain Roguelike: VRF Loot Architecture

## Overview

A roguelike where dungeon exploration is anchored to on-chain transactions. The dungeon layout is public and deterministic. The loot is private to the player until they choose to reveal it (e.g. to trade or sell).

### Design Principles

- **All verification happens off-chain.** The chain stores public keys and tx_hashes. Any party with that data can verify any revealed item independently — no on-chain crypto needed.
- **Players store their own data.** VRF outputs, proofs, and item data live on the player's machine. The chain is the anchor of truth, not the warehouse.
- **Items exist by default.** Once a player registers a segment, they generate all items for it. Those items are assumed to be in their inventory. The only on-chain events are registration (explore tx) and transfers (trades).

---

## Core Concepts

### Two Layers of Randomness

| Layer | Input | Function | Visibility |
|---|---|---|---|
| **Dungeon layout** | `SHA-256(tx_hash)` | Deterministic public derivation | Public — anyone can reconstruct |
| **Loot generation** | `VRF(player_sk, tx_hash \|\| index)` | Verifiable private derivation | Private — only the player knows until revealed |

The transaction hash serves double duty:

- **Freshness**: it didn't exist before the player committed, so they can't pre-compute favourable outcomes
- **Commitment**: once the transaction is on-chain, the player is bound to use that specific hash as input — they can't shop for a better one

---

## Lifecycle

```
  Player                          Chain
  ──────                          ─────

  1. Submit "explore" tx ───────► Tx included in block
                                  tx_hash assigned
                                  (player_address, vrf_pubkey, tx_hash) recorded
                          ◄─────── tx_hash returned

  2. Derive dungeon layout (locally)
     layout_seed = SHA-256(tx_hash)
     layout = DungeonGen(layout_seed)
     item_count = (layout_seed[31] % MAX_ITEMS) + 1

  3. Generate all loot (locally, privately)
     for i in 0..item_count:
       VRF(sk, tx_hash || i) → (O_i, π_i)
       item_i = LootMap(SHA-256(O_i))

     All items go into local inventory.
     Player stores (O_i, π_i) for each.

  4. Play the dungeon, use items, etc.
     No chain interaction needed.

  5. Trade or reveal (only when needed)
     To trade item_i to another player:
       reveal (O_i, π_i, tx_hash, i) to counterparty
       counterparty verifies off-chain
       if valid → trade tx on-chain records transfer of ownership
```

### Step 1: The "Commitment" Transaction

The player sends a transaction to enter a dungeon segment. The contract records:
- The player's address
- Their VRF public key (already registered, or included in this tx)
- The resulting tx_hash

The tx_hash is the anchor. The player is now committed to generating from this specific value.

> This is not a commitment in the hiding/binding cryptographic sense. The player doesn't commit to a secret. Instead, the chain commits *to them* — it assigns an unpredictable value that the player must use. The player cannot retry or choose a different hash without submitting (and paying for) another transaction.

### Step 2: Dungeon Layout (Public Derivation)

```
layout_seed = SHA-256(tx_hash)
```

The dungeon layout — room shapes, corridors, enemy placements, environmental features — is derived deterministically from `layout_seed`. Anyone who knows the tx_hash can reconstruct the exact same dungeon.

This is intentional: the dungeon structure is not a secret. Other players, spectators, or validators can verify that the player actually faced the dungeon they claim to have explored.

### Step 3: Loot Generation (All Items, Locally)

The player generates **all** items for the segment. There is no reason not to — the items are deterministic from the player's key and the tx_hash, so they'll always get the same result. Generating them all upfront is simply computing what already "exists."

#### Item Count

The number of loot slots is derived from the tx_hash so it is public and verifiable:

```
layout_seed = SHA-256(tx_hash)
item_count = (layout_seed[31] % MAX_ITEMS) + 1
```

The last byte of the layout seed, mod by a maximum, plus 1. Anyone can recompute this from the tx_hash. A player cannot claim items beyond this count because there is no valid VRF input for indices that exceed it — a verifier would reject any index >= item_count.

MAX_ITEMS should be kept small (e.g. 8–16) to keep the scheme practical. This bounds:
- The number of VRF evaluations per segment (cheap locally, but should be bounded)
- The number of items that can enter circulation from a single transaction
- The verification burden when auditing a player's inventory

#### Per-Item Generation

For each slot `i` in `0..item_count`:

```
message_i = tx_hash (32 bytes) || i (4 bytes, big-endian)
(O_i, π_i) = VRF.evaluate(player_sk, message_i)
item_i = LootMap(SHA-256(O_i))
```

The player stores all of `(O_i, π_i, item_i)` locally. These are their items. They exist in the player's inventory from this point forward.

Key properties:

- **Private**: only the player holds `sk`, so only they can compute `O_i`
- **Deterministic**: the same `(sk, tx_hash, i)` always produces the same item
- **Verifiable**: anyone with the player's public key can check `π_i` against `O_i` later
- **Independent**: each item has its own VRF proof, so items can be revealed or verified one at a time

### Step 4: Selective Reveal (Only When Needed)

Items stay private until the player needs to prove them to someone else:

- **Trade**: reveal the item to a counterparty who verifies off-chain before agreeing to the trade
- **Sell on a marketplace**: post `(O_i, π_i, tx_hash, i)` so buyers can verify before purchasing
- **PvP**: reveal equipped gear to an opponent or referee

A reveal consists of the player providing:
```
{
  tx_hash,        // which dungeon run (on-chain, anyone can look up)
  index,          // which loot slot (must be < item_count for this tx_hash)
  vrf_output,     // O_i (the raw curve point)
  proof,          // π_i
  public_key      // player's VRF public key (on-chain, anyone can look up)
}
```

The counterparty verifies entirely off-chain:

1. Looks up `tx_hash` on-chain — confirms it exists and is associated with `public_key`
2. Computes `item_count = (SHA-256(tx_hash)[31] % MAX_ITEMS) + 1` — confirms `index < item_count`
3. Reconstructs `message_i = tx_hash || encode_index(index)`
4. Calls `VRF.verify(public_key, message_i, proof)` — confirms the output is genuine
5. Calls `LootMap(SHA-256(vrf_output))` — re-derives the item
6. Checks that the claimed item properties match the re-derived ones

If any step fails, the item is fraudulent. All of this runs on the verifier's machine — no gas, no contract calls.

---

## What Goes On-Chain

The chain is deliberately thin. It records only what is needed for anchoring and ownership:

| Data | When | Purpose |
|---|---|---|
| `player_address → vrf_public_key` | Key registration (once) | Binds a player to their VRF key before any exploration |
| `tx_hash` (from explore tx) | Each dungeon segment | Anchors the randomness — proves when and what the player committed to |
| Trade records | Each trade | Transfers ownership of a specific `(tx_hash, index)` from one player to another |

Everything else — dungeon layout, item generation, item properties, VRF proofs, inventory — lives off-chain on the player's machine.

### What About Destroying Items?

Destruction is tricky. If a player destroys an item, should that be recorded on-chain? Options:

- **Don't record it.** The item simply stops being used. If the player later tries to trade it, the counterparty verifies it normally — destruction is just a local UI concern. The risk: a player could "destroy" an item and then trade it anyway, since nothing on-chain marks it as gone.
- **Record it on-chain.** A `destroy(tx_hash, index)` transaction. This definitively removes the item from circulation, but costs gas for every destruction. With small item counts per segment this might be acceptable, but it adds friction.
- **Soft destruction via trade-to-burn-address.** Trade the item to a known burn address. Reuses the trade mechanism, but is a bit contrived.

If items are few per segment (8–16) and the game doesn't incentivise destruction fraud, the simplest approach is: **don't record destruction on-chain.** Just let players discard items locally. If item count inflation matters later, add the on-chain destroy as a future feature.

---

## Key Registration

The player's VRF public key must be known before the explore transaction, otherwise they could generate a key after seeing tx_hash and pick one that gives good loot.

Options:

- **Derive from wallet key**: if the chain uses the same curve (e.g. secp256k1 or P-256), the player's existing keypair could double as their VRF keypair. Simplest UX but ties VRF security to wallet security.
- **Separate registration**: player registers a VRF public key in a contract. Must happen before (or in a different transaction from) the explore transaction. Adds a setup step but decouples VRF from wallet.
- **Derived sub-key**: player signs a domain-separated message with their wallet key to deterministically derive a VRF keypair. Best of both — no extra registration, but the VRF key is independent.

The critical invariant: **the public key must be on-chain before the tx_hash is known.**

---

## Index Encoding

The current demo encodes the item index as a string (`"blockhash-0"`, `"blockhash-1"`). For the chain implementation, this must be fixed-width binary:

```
message_i = tx_hash (32 bytes) || i (4 bytes, big-endian)
```

This avoids ambiguity (e.g. tx_hash `"abc-1"` with index `0` vs tx_hash `"abc"` with index `10`) and is straightforward for any verifier to reconstruct.

---

## What Exists vs What's Needed

### Already built (in this repo)

| Component | Status | Notes |
|---|---|---|
| VRF evaluate / verify | Working | P-256 curve, correct math, tested |
| VRF output → loot mapping | Working | SHA-256 re-hash, non-overlapping byte ranges |
| Per-item VRF with index | Working | `VRF(sk, blockhash \|\| i)` pattern |
| Item verification from proof | Working | Re-derives item and compares properties |
| Commit-reveal for trading | Working | Separate concern, useful for trade fairness |

### Needs to be built

| Component | Complexity | Notes |
|---|---|---|
| Dungeon layout generator | Medium | `DungeonGen(SHA-256(tx_hash))` — procedural generation from a seed. Game design problem more than crypto. |
| On-chain key registration | Low | Contract stores `player_address → vrf_public_key`. |
| Explore transaction + tx_hash extraction | Low | Contract method + client reads receipt. |
| Item count derivation from tx_hash | Low | Byte extraction from layout seed. |
| Fixed-width index encoding | Low | Replace string concatenation with binary encoding. |
| Local item persistence | Low–Medium | Player stores `(O_i, π_i)` per item across sessions. Could be localStorage, IndexedDB, or a local file. |
| Trade protocol (on-chain ownership transfer) | Medium | Contract records `(tx_hash, index)` ownership changes. Off-chain verification before on-chain settlement. |
| Off-chain verification library | Low | Package the verify logic so any client can run it. Most of this exists already. |

---

## Open Design Questions

1. **What chain?** The curve choice and tx_hash format depend on this. The VRF itself runs entirely off-chain so curve precompile support is irrelevant — but the wallet key / VRF key relationship may matter if you want to derive one from the other.

2. **Item persistence model for trades**: When an item is traded, the on-chain record needs to track `(original_tx_hash, index, current_owner)`. Is this a mapping in a contract? An NFT mint? A simple event log? The lighter the better, since the actual item data lives off-chain.

3. **Dungeon gameplay**: Is the dungeon purely loot generation, or does the player make choices (which rooms to enter, which enemies to fight) that affect which loot slots activate? If so, the item indices need to correspond to specific in-dungeon events, not just a flat 0..N range.

4. **Multi-segment runs**: Does each segment get its own transaction? Or does one transaction seed the entire run, with segment indices as an additional domain separator? (`tx_hash || segment (4 bytes) || item_index (4 bytes)`)

5. **Loot-gating by dungeon difficulty**: Should harder dungeons have better rarity distributions? If so, the `LootMap` function needs a difficulty parameter that shifts the rarity thresholds — and that parameter must be publicly derivable (e.g. from the contract state at the time of the explore transaction).
