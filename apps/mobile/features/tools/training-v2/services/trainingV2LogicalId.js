function randomHexDigit(random) {
  return Math.floor(random() * 16).toString(16);
}

// Logical keys (logicalUnitKey / logicalTargetExerciseKey / logicalTargetSetKey) must be
// valid UUIDs per the shared Zod contracts, so the fallback path below builds a real
// UUID v4 string instead of an arbitrary opaque id.
export function createTrainingV2LogicalKey({
  cryptoImpl = globalThis.crypto,
  random = Math.random,
} = {}) {
  if (typeof cryptoImpl?.randomUUID === 'function') {
    return cryptoImpl.randomUUID();
  }

  let uuid = '';
  for (let index = 0; index < 36; index += 1) {
    if (index === 8 || index === 13 || index === 18 || index === 23) {
      uuid += '-';
    } else if (index === 14) {
      uuid += '4';
    } else if (index === 19) {
      uuid += ((Math.floor(random() * 16) & 0x3) | 0x8).toString(16);
    } else {
      uuid += randomHexDigit(random);
    }
  }
  return uuid;
}
