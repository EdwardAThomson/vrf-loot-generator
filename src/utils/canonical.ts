// Canonical deterministic serialization for commitment hashing.
//
// JSON.stringify is not canonical: key insertion order changes the output,
// Uint8Array serializes as an index-keyed object, and undefined-vs-missing
// fields differ. Two honest parties holding semantically identical data can
// therefore produce different hashes. This encoder produces one unique byte
// string per semantic value:
//
//   - null            -> `null`
//   - boolean         -> `true` / `false`
//   - number          -> JSON number (finite only; NaN/Infinity rejected, -0
//                        normalized to 0)
//   - string          -> JSON string (standard JSON escaping)
//   - Uint8Array      -> type-tagged object `{"$bytes":"<lowercase hex>"}`
//   - Array           -> `[...]`, elements in the given (significant) order
//   - plain object    -> `{...}` with keys sorted by UTF-16 code unit;
//                        `undefined` values are REJECTED (not skipped), so
//                        "field absent" is the only way to omit data
//
// Anything else (undefined, functions, symbols, bigint, Date, Map, class
// instances, ...) is rejected with an error rather than silently coerced.
// Plain objects may not use the reserved "$bytes" key, which keeps the
// Uint8Array tagging injective.

const BYTES_TAG = '$bytes';

const toLowerHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');

const isPlainObject = (value: object): boolean => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Deterministically serialize a value for hashing.
 * Output is valid JSON, but with a single canonical form per semantic value.
 * Throws on values that have no canonical encoding.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number': {
      if (!Number.isFinite(value)) {
        throw new Error(`canonicalize: non-finite number (${value}) has no canonical form`);
      }
      // Normalize -0 to 0; JSON.stringify already does this.
      return JSON.stringify(value);
    }
    case 'string':
      return JSON.stringify(value);
    case 'undefined':
      throw new Error('canonicalize: undefined has no canonical form (omit the field instead)');
    case 'function':
      throw new Error('canonicalize: functions cannot be canonicalized');
    case 'symbol':
      throw new Error('canonicalize: symbols cannot be canonicalized');
    case 'bigint':
      throw new Error('canonicalize: bigint cannot be canonicalized (encode as string)');
  }

  if (value instanceof Uint8Array) {
    return `{"${BYTES_TAG}":"${toLowerHex(value)}"}`;
  }

  if (Array.isArray(value)) {
    return `[${value.map((element) => canonicalize(element)).join(',')}]`;
  }

  if (typeof value === 'object' && isPlainObject(value)) {
    const record = value as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(record, BYTES_TAG)) {
      throw new Error(`canonicalize: "${BYTES_TAG}" is a reserved key (Uint8Array type tag)`);
    }
    const keys = Object.keys(record).sort();
    const parts = keys.map((key) => {
      const encoded = canonicalize(record[key]); // throws on undefined values
      return `${JSON.stringify(key)}:${encoded}`;
    });
    return `{${parts.join(',')}}`;
  }

  throw new Error(
    `canonicalize: unsupported value type (${Object.prototype.toString.call(value)})`
  );
}
