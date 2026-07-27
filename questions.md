# Questions about VRF Loot Generator

## 1. What Does the VRF Actually Output?

- What is the raw type of `O` — byte array, hex string, BigInt? We need raw bytes for hashing
- Is `O` (the VRF output) stored separately from the VRF index `H(O)`? The doc distinguishes them but the code may conflate them
- Is the proof `π` returned as a structured object or serialised bytes? We need it serialisable for on-chain posting

---

## 2. How Are Multiple Items Derived?

- Is the VRF called N times with `(k, blockhash || index)`, or called once and expanded?
- If called N times, is the index encoded consistently — fixed-width bytes, not a raw string?
- Is there currently any separation between the dungeon layout seed and the loot seed, or does everything come from the same single output?

---

## 3. Is There Anything Resembling a Commitment?

- Does any code currently hash `O` before using it?
- Is there any separation between "what gets shown publicly" vs "what stays private"?
- Is there a hash of the proof or output stored anywhere, even just for display?

---

## 4. What Does the Loot Mapping Look Like?

- How exactly are output bytes mapped to rarity/type/modifier — modulo, bit slicing, or re-hash?
- Is there enough output entropy for each property, or are properties derived from overlapping byte ranges?
- Could the mapping function be run in reverse given `O`? (It shouldn't need to be, but worth knowing)

---

## 5. Is Verification Actually Tested Against Rejection?

- Is there a test that verifies a valid proof correctly?
- Is there a test that rejects a proof with a tampered output?
- Is there a test that rejects a proof verified against the wrong public key?

---

## 6. What Would Need to Change for the Commitment Scheme?

This is the synthesis question to answer after the others:

- Can `O` be cleanly extracted as raw bytes before the loot mapping step? That's where `H(O)` and the HKDF derivation would hook in
- Is the per-item derivation currently structured in a way that could be replaced with `HKDF(O, "item:i")` without a large refactor?
- Is there any existing concept of "revealing" an item, or is everything computed and displayed immediately?

---

The last question is probably the most telling. If loot is generated and displayed immediately with no intermediate private state, that confirms the commitment layer is entirely absent and needs to be designed from scratch on top of what exists.