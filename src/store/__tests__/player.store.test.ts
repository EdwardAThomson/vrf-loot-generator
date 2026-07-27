import { usePlayerStore } from '../player.store';
import { VRFService } from '../../services/vrf/vrf.service';

const STORAGE_KEY = 'vrf-player-session';

// Deterministic, well-formed keypair for the current ed25519 VRF.
const validKeyPair = VRFService.keyPairFromSeed(new Uint8Array(32).fill(7));

// Shape written by the old P-256 construction: 64-hex scalar private key,
// 130-hex uncompressed public key (0x04 prefix plus two 32-byte coordinates).
const legacyP256KeyPair = {
  privateKey: 'c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721',
  publicKey:
    '04' +
    '60fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb6' +
    '7903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299'
};

function seedPersistedState(state: Record<string, unknown>, version = 0): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version }));
}

describe('player store rehydration keypair guard', () => {
  beforeEach(() => {
    localStorage.clear();
    usePlayerStore.getState().clearSession();
    // Also drop any extraneous keyPair field merged in by a previous test's
    // rehydration; clearSession only resets the fields the store declares.
    usePlayerStore.setState({ keyPair: null } as any);
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('valid ed25519 keypair survives rehydration', async () => {
    seedPersistedState({
      playerName: 'alice',
      isLoggedIn: true,
      keyPair: validKeyPair
    });

    await usePlayerStore.persist.rehydrate();

    const state = usePlayerStore.getState() as unknown as Record<string, unknown>;
    expect(state.playerName).toBe('alice');
    expect(state.isLoggedIn).toBe(true);
    expect(state.keyPair).toEqual(validKeyPair);
  });

  test('old-format P-256 keypair is dropped on rehydration', async () => {
    seedPersistedState({
      playerName: 'bob',
      isLoggedIn: true,
      keyPair: legacyP256KeyPair
    });

    await usePlayerStore.persist.rehydrate();

    const state = usePlayerStore.getState() as unknown as Record<string, unknown>;
    // The stale keypair is nulled out so the UI prompts regeneration
    // instead of throwing when the ed25519 VRF rejects the old format.
    expect(state.keyPair).toBeNull();
    // The rest of the session is preserved.
    expect(state.playerName).toBe('bob');
    expect(state.isLoggedIn).toBe(true);
  });

  test('session without any stored keypair rehydrates unchanged', async () => {
    seedPersistedState({ playerName: 'carol', isLoggedIn: false });

    await usePlayerStore.persist.rehydrate();

    const state = usePlayerStore.getState() as unknown as Record<string, unknown>;
    expect(state.playerName).toBe('carol');
    expect(state.isLoggedIn).toBe(false);
    expect(state.keyPair ?? null).toBeNull();
  });
});

describe('VRFService.isValidKeyPair', () => {
  test('accepts a freshly derived ed25519 keypair', () => {
    expect(VRFService.isValidKeyPair(validKeyPair)).toBe(true);
  });

  test('rejects legacy P-256 keypairs and malformed values', () => {
    expect(VRFService.isValidKeyPair(legacyP256KeyPair)).toBe(false);
    expect(VRFService.isValidKeyPair(null)).toBe(false);
    expect(VRFService.isValidKeyPair({ privateKey: '', publicKey: '' })).toBe(false);
    // Correct lengths but mismatched pair: public key not derived from the
    // private key.
    expect(
      VRFService.isValidKeyPair({
        privateKey: validKeyPair.privateKey,
        publicKey: '0'.repeat(64)
      })
    ).toBe(false);
  });
});
