/**
 * RFC 9381 Appendix B.3 test vectors for ECVRF-EDWARDS25519-SHA512-TAI
 * (Examples 16, 17, 18; secret keys and messages from RFC 8032 Section 7.1).
 *
 * Asserts byte-exact pi and beta for all three vectors, verify() acceptance,
 * and rejection of each vector under single-bit tampering.
 */

import { getPublicKey, prove, proofToHash, verify } from '../ecvrf';

const hex = (s: string): Uint8Array => {
  if (s.length % 2 !== 0) throw new Error('odd hex length');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(s.substr(i * 2, 2), 16);
  }
  return out;
};
const toHex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

interface Vector {
  name: string;
  sk: string;
  pk: string;
  alpha: string;
  pi: string;
  beta: string;
}

// Hex strings are transcribed verbatim from RFC 9381 Appendix B.3.
const VECTORS: Vector[] = [
  {
    name: 'Example 16 (empty alpha)',
    sk: '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
    pk: 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
    alpha: '',
    pi:
      '8657106690b5526245a92b003bb079ccd1a92130477671f6fc01ad16f26f7' +
      '23f26f8a57ccaed74ee1b190bed1f479d9727d2d0f9b005a6e456a35d4fb0daab1' +
      '268a1b0db10836d9826a528ca76567805',
    beta:
      '90cf1df3b703cce59e2a35b925d411164068269d7b2d29f3301c03dd757' +
      '876ff66b71dda49d2de59d03450451af026798e8f81cd2e333de5cdf4f3e140fdd' +
      '8ae',
  },
  {
    name: 'Example 17 (alpha = 0x72)',
    sk: '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb',
    pk: '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c',
    alpha: '72',
    pi:
      'f3141cd382dc42909d19ec5110469e4feae18300e94f304590abdced48aed' +
      '5933bf0864a62558b3ed7f2fea45c92a465301b3bbf5e3e54ddf2d935be3b67926' +
      'da3ef39226bbc355bdc9850112c8f4b02',
    beta:
      'eb4440665d3891d668e7e0fcaf587f1b4bd7fbfe99d0eb2211ccec90496' +
      '310eb5e33821bc613efb94db5e5b54c70a848a0bef4553a41befc57663b56373a5' +
      '031',
  },
  {
    name: 'Example 18 (alpha = 0xaf82)',
    sk: 'c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7',
    pk: 'fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025',
    alpha: 'af82',
    pi:
      '9bc0f79119cc5604bf02d23b4caede71393cedfbb191434dd016d30177ccb' +
      'f8096bb474e53895c362d8628ee9f9ea3c0e52c7a5c691b6c18c9979866568add7' +
      'a2d41b00b05081ed0f58ee5e31b3a970e',
    beta:
      '645427e5d00c62a23fb703732fa5d892940935942101e456ecca7bb217c' +
      '61c452118fec1219202a0edcf038bb6373241578be7217ba85a2687f7a0310b2df' +
      '19f',
  },
];

describe('RFC 9381 B.3 ECVRF-EDWARDS25519-SHA512-TAI test vectors', () => {
  test('vector hex strings have the expected lengths', () => {
    for (const v of VECTORS) {
      expect(v.sk.length).toBe(64); // 32-byte SK
      expect(v.pk.length).toBe(64); // 32-byte PK
      expect(v.pi.length).toBe(160); // 80-byte pi
      expect(v.beta.length).toBe(128); // 64-byte beta
    }
  });

  describe.each(VECTORS)('$name', (v) => {
    test('public key derives from secret key', () => {
      expect(toHex(getPublicKey(hex(v.sk)))).toBe(v.pk);
    });

    test('prove() produces the exact RFC pi', () => {
      expect(toHex(prove(hex(v.sk), hex(v.alpha)))).toBe(v.pi);
    });

    test('proof_to_hash(pi) produces the exact RFC beta', () => {
      expect(toHex(proofToHash(hex(v.pi)))).toBe(v.beta);
    });

    test('verify() accepts and returns the exact RFC beta', () => {
      expect(toHex(verify(hex(v.pk), hex(v.alpha), hex(v.pi)))).toBe(v.beta);
    });

    test('verify() rejects the proof with a flipped bit', () => {
      const pi = hex(v.pi);
      // One flipped bit in each proof component: Gamma, c, and s.
      for (const offset of [0, 17, 35, 47, 55, 79]) {
        const tampered = new Uint8Array(pi);
        tampered[offset] ^= 0x01;
        expect(() => verify(hex(v.pk), hex(v.alpha), tampered)).toThrow();
      }
    });

    test('verify() rejects under a wrong public key and wrong alpha', () => {
      const otherPk = VECTORS.find((o) => o !== v)!.pk;
      expect(() => verify(hex(otherPk), hex(v.alpha), hex(v.pi))).toThrow();
      const otherAlpha = new Uint8Array([...hex(v.alpha), 0x01]);
      expect(() => verify(hex(v.pk), otherAlpha, hex(v.pi))).toThrow();
    });
  });
});
