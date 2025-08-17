// Format utility functions
// Consolidated formatting helpers

/**
 * Convert byte array to hex string
 */
export const toHexString = (byteArray: Uint8Array | number[]): string => {
  if (!byteArray) return 'undefined';
  return Array.from(byteArray, (byte: number) => ('0' + (byte & 0xff).toString(16)).slice(-2)).join('');
};

/**
 * Convert hex string to byte array
 */
export const fromHexString = (hexString: string): Uint8Array => {
  if (!hexString || hexString === 'undefined') return new Uint8Array();
  const matches = hexString.match(/.{1,2}/g);
  return new Uint8Array(matches ? matches.map((byte: string) => parseInt(byte, 16)) : []);
};

/**
 * Truncate string for display
 */
export const truncateString = (str: string, length: number = 16): string => {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
};

/**
 * Format timestamp for display
 */
export const formatTimestamp = (timestamp: number): string => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString();
};
