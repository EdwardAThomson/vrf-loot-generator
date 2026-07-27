// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Environment polyfills for the jsdom test environment.
//
// The VRF/loot services depend on Web APIs that the bundled jsdom (jest 27 via
// react-scripts) does not provide:
//   - TextEncoder/TextDecoder (used to encode VRF messages)
//   - crypto.getRandomValues (used by elliptic's RNG, brorand, for keygen and
//     by crypto-js for nonce generation)
// Provide them from Node's built-ins. This file runs before any test module is
// loaded, so brorand's load-time environment detection sees getRandomValues.
//
// NOTE: this is the single blessed setup file. The standalone jest.config.js
// was deleted (it had a moduleNameMapper typo and a jest-environment-jsdom
// version mismatch); the one blessed way to run tests is `npm test`
// (react-scripts), which picks this file up automatically.
// ---------------------------------------------------------------------------

if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  (globalThis as any).TextEncoder = TextEncoder;
  (globalThis as any).TextDecoder = TextDecoder;
}

if (
  typeof globalThis.crypto === 'undefined' ||
  typeof (globalThis.crypto as any).getRandomValues !== 'function'
) {
  const { webcrypto } = require('crypto');
  if (typeof globalThis.crypto === 'undefined') {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
  } else {
    (globalThis.crypto as any).getRandomValues =
      webcrypto.getRandomValues.bind(webcrypto);
  }
}
