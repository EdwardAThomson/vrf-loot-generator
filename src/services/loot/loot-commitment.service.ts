// Loot Commitment Service - sealed loot with per-item commitments and
// selective reveal (docs/BLOCKCHAIN_ROGUELIKE_ARCHITECTURE.md, "Selective
// Reveal" and "Lifecycle").
//
// Commitment preimage (LOOT_COMMITMENT_VERSION = 1):
//
//   C_i = sha256( canonicalize({
//     domain: 'vrf-loot/sealed-item-commitment',
//     v: 1,
//     blockhash,                          // as supplied (string)
//     itemIndex: i,                       // number, the uint32 VRF index
//     publicKey,                          // lowercase hex, 64 chars
//     outputHash: sha256hex(vrfOutput)    // lowercase hex of sha256(beta)
//   }) )
//
// where `canonicalize` is the deterministic encoder in src/utils/canonical.ts
// (sorted keys, one canonical byte string per semantic value). Design notes:
//
// - `domain` separates these hashes from every other sha256-of-canonical-JSON
//   in the system (notably the trading commitment payloads), so a hash can
//   never be replayed across protocols.
// - `v` is a schema version: a reveal or manifest with an unknown version
//   fails verification (fail closed) instead of silently verifying under the
//   wrong preimage rules.
// - `blockhash`, `itemIndex` and `publicKey` bind the commitment to one loot
//   slot of one dungeon run of one player. The same VRF output committed by a
//   different key, for a different run, or in a different slot yields a
//   different C_i, so commitments cannot be transplanted between manifests or
//   swapped between indices.
// - `outputHash = sha256(vrfOutput)` commits to beta without revealing it.
//   Hiding needs no extra salt: beta is 64 bytes of VRF output, unpredictable
//   to anyone without the private key, so the hash cannot be brute-forced by
//   enumerating candidate preimages. Committing to sha256(beta) instead of
//   beta itself also keeps the preimage fixed-width and cheap to audit.
// - Item properties are deliberately NOT part of the preimage: they are a
//   deterministic function of beta (LootService.generateItem), so committing
//   to beta commits to them. At reveal time the verifier re-derives the
//   properties from the revealed beta and compares them to the claim.
//
// IMPORTANT: with RFC 9381 ECVRF, beta = proof_to_hash(pi), so the proof
// alone reveals the output. A sealed item therefore withholds BOTH vrfOutput
// and proof; the public manifest carries only { v, blockhash, publicKey,
// count, commitments }.

import * as sha256 from 'js-sha256';
import { LootService } from './loot.service';
import { VRFService } from '../vrf/vrf.service';
import { canonicalize } from '../../utils/canonical';
import { toHexString, fromHexString } from '../../utils/format.utils';
import {
  LootItem,
  SealedLootManifest,
  SealedPrivateRecord,
  LootRevealPackage,
  RevealedItemProperties,
} from '../../types/loot.types';

/** Version of the commitment preimage format. Bump on any format change. */
export const LOOT_COMMITMENT_VERSION = 1;

/** Domain separation tag for sealed-item commitments. */
export const LOOT_COMMITMENT_DOMAIN = 'vrf-loot/sealed-item-commitment';

export interface SealedLootResult {
  /** Public manifest: safe to publish or send over the wire at generation time. */
  manifest: SealedLootManifest;
  /** Private per-item records: keep local until the player chooses to reveal. */
  privateRecords: SealedPrivateRecord[];
}

export class LootCommitmentService {
  /**
   * Compute the per-item commitment C_i. See the file header for the exact
   * preimage and the rationale for each field.
   */
  static computeCommitment(
    blockhash: string,
    itemIndex: number,
    publicKey: string,
    vrfOutput: Uint8Array,
    version: number = LOOT_COMMITMENT_VERSION
  ): string {
    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex > 0xffffffff) {
      throw new Error(`Item index must be an integer in [0, 2^32): got ${itemIndex}`);
    }
    const preimage = canonicalize({
      domain: LOOT_COMMITMENT_DOMAIN,
      v: version,
      blockhash,
      itemIndex,
      publicKey: publicKey.toLowerCase(),
      outputHash: sha256.sha256(vrfOutput),
    });
    return sha256.sha256(preimage);
  }

  /**
   * Generate `count` loot items in the SEALED state.
   *
   * Returns a public manifest (commitments only, no VRF outputs, no proofs,
   * no item properties) and the private per-item records the player keeps
   * locally until reveal. Reuses LootService for all generation crypto.
   */
  static generateSealedLoot(
    privateKey: string,
    blockhash: string,
    count: number
  ): SealedLootResult {
    const publicKey = VRFService.getPublicKeyFromPrivate(privateKey).toLowerCase();
    const items = LootService.generateMultipleItems(privateKey, blockhash, count);

    const commitments: string[] = [];
    const privateRecords: SealedPrivateRecord[] = [];

    items.forEach((item, i) => {
      const vrfData = item.vrfData;
      if (!vrfData || !vrfData.vrfOutput || !vrfData.proof) {
        throw new Error(`Generated item ${i} is missing VRF data`);
      }
      const vrfOutput =
        typeof vrfData.vrfOutput === 'string'
          ? fromHexString(vrfData.vrfOutput)
          : vrfData.vrfOutput;
      const proof =
        typeof vrfData.proof === 'string' ? fromHexString(vrfData.proof) : vrfData.proof;

      commitments.push(this.computeCommitment(blockhash, i, publicKey, vrfOutput));
      privateRecords.push({
        itemIndex: i,
        blockhash,
        publicKey,
        vrfOutput,
        proof,
        item,
      });
    });

    const manifest: SealedLootManifest = {
      v: LOOT_COMMITMENT_VERSION,
      blockhash,
      publicKey,
      count,
      commitments,
    };

    return { manifest, privateRecords };
  }

  /**
   * Build the reveal package for one sealed item. This is the ONLY structure
   * that carries the VRF output and proof across the wire, and only when the
   * player explicitly reveals.
   */
  static revealItem(record: SealedPrivateRecord): LootRevealPackage {
    return {
      v: LOOT_COMMITMENT_VERSION,
      blockhash: record.blockhash,
      itemIndex: record.itemIndex,
      publicKey: record.publicKey,
      vrfOutput: toHexString(record.vrfOutput),
      proof: toHexString(record.proof),
      claimedProperties: {
        name: record.item.name,
        type: record.item.type,
        rarity: record.item.rarity,
        modifier: record.item.modifier,
      },
    };
  }

  /**
   * Verify a revealed item against a public manifest. Fail closed: any
   * missing field, version mismatch, context mismatch, commitment mismatch,
   * invalid proof, unbound output, or property mismatch returns false.
   *
   * Chain:
   *  1. version check (package and manifest)
   *  2. context binding: blockhash and publicKey must match the manifest
   *  3. index bounds: 0 <= itemIndex < manifest.count
   *  4. commitment check: recompute C_i and compare to the manifest entry
   *  5. full VRF item verification via LootService.verifyItem (RFC 9381
   *     verify over the reconstructed message, beta binding, property
   *     re-derivation from beta)
   */
  static verifyRevealedItem(pkg: LootRevealPackage, manifest: SealedLootManifest): boolean {
    try {
      if (!pkg || !manifest) return false;
      if (pkg.v !== LOOT_COMMITMENT_VERSION || manifest.v !== LOOT_COMMITMENT_VERSION) {
        return false;
      }
      if (pkg.blockhash !== manifest.blockhash) return false;
      if (
        typeof pkg.publicKey !== 'string' ||
        pkg.publicKey.toLowerCase() !== manifest.publicKey.toLowerCase()
      ) {
        return false;
      }
      if (
        !Number.isInteger(pkg.itemIndex) ||
        pkg.itemIndex < 0 ||
        pkg.itemIndex >= manifest.count ||
        pkg.itemIndex >= manifest.commitments.length
      ) {
        return false;
      }

      const vrfOutput = fromHexString(pkg.vrfOutput);
      const proof = fromHexString(pkg.proof);
      if (vrfOutput.length === 0 || proof.length === 0) return false;

      const expected = manifest.commitments[pkg.itemIndex];
      const recomputed = this.computeCommitment(
        pkg.blockhash,
        pkg.itemIndex,
        pkg.publicKey,
        vrfOutput,
        pkg.v
      );
      if (recomputed !== expected) return false;

      // Reassemble a LootItem carrying the claimed properties and the
      // revealed VRF data, then run the existing full verification chain.
      const props: RevealedItemProperties = pkg.claimedProperties;
      const candidate: LootItem = {
        id: `reveal-${pkg.itemIndex}`,
        name: props.name,
        type: props.type,
        icon: '',
        rarity: props.rarity,
        modifier: props.modifier,
        createdAt: new Date().toISOString(),
        vrfData: {
          publicKey: pkg.publicKey,
          proof,
          message: '',
          blockhash: pkg.blockhash,
          itemIndex: pkg.itemIndex,
          vrfOutput,
        },
      };
      return LootService.verifyItem(candidate, pkg.publicKey);
    } catch {
      return false;
    }
  }
}
