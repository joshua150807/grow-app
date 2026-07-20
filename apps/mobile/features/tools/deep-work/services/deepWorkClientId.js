let fallbackCounter = 0;

function randomSegment(random) {
  return Math.floor(random() * Number.MAX_SAFE_INTEGER).toString(36);
}

export function createDeepWorkClientSessionId({
  cryptoImpl = globalThis.crypto,
  now = Date.now,
  random = Math.random,
  nextCounter,
} = {}) {
  if (typeof cryptoImpl?.randomUUID === 'function') {
    const runtimeId = String(cryptoImpl.randomUUID()).trim();

    if (runtimeId && runtimeId.length <= 128) {
      return runtimeId;
    }
  }

  const counter = nextCounter
    ? nextCounter()
    : ++fallbackCounter;
  const id = [
    'dw',
    Math.max(0, Number(now()) || 0).toString(36),
    Math.max(0, Number(counter) || 0).toString(36),
    randomSegment(random),
    randomSegment(random),
    randomSegment(random),
  ].join('-');

  return id.slice(0, 128);
}
