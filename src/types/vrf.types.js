// VRF Type definitions
// Using JSDoc for type hints until we fully migrate to TypeScript

/**
 * @typedef {Object} KeyPair
 * @property {string} privateKey - Private key as hex string
 * @property {string} publicKey - Public key as hex string
 */

/**
 * @typedef {Object} VRFResult
 * @property {string} vrfOutput - VRF output hash
 * @property {Object|string} proof - VRF proof
 * @property {number} index - Numeric index derived from VRF output
 */

/**
 * @typedef {Object} VRFProof
 * @property {string} gamma - Gamma point as hex string
 * @property {string} c - Challenge as hex string
 * @property {string} s - Response as hex string
 */

/**
 * @typedef {Object} VRFVerificationParams
 * @property {string} publicKey - Public key as hex string
 * @property {string|Object} proof - VRF proof
 * @property {Uint8Array} message - Original message
 * @property {string} vrfOutput - Expected VRF output
 */

export const VRFTypes = {
  // Export types for JSDoc usage
};
