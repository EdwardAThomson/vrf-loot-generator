// Format utility functions
// Consolidated formatting helpers

/**
 * Convert byte array to hex string
 * @param {Uint8Array|Array} byteArray - Byte array to convert
 * @returns {string} Hex string representation
 */
export const toHexString = (byteArray) => {
  if (!byteArray) return 'undefined';
  return Array.from(byteArray, byte => ('0' + (byte & 0xff).toString(16)).slice(-2)).join('');
};

/**
 * Convert hex string to byte array
 * @param {string} hexString - Hex string to convert
 * @returns {Uint8Array} Byte array
 */
export const fromHexString = (hexString) => {
  if (!hexString || hexString === 'undefined') return new Uint8Array();
  const matches = hexString.match(/.{1,2}/g);
  return new Uint8Array(matches ? matches.map(byte => parseInt(byte, 16)) : []);
};

/**
 * Truncate string for display
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length
 * @returns {string} Truncated string with ellipsis
 */
export const truncateString = (str, length = 16) => {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
};

/**
 * Format timestamp for display
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString();
};
