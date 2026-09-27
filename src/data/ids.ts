// UUID v4 generation. The app injects expo-crypto at startup; Node tests use the built-in Web Crypto.
let generator: () => string = () => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  throw new Error('No UUID generator configured');
};

export function setUuidGenerator(fn: () => string) {
  generator = fn;
}

export function uuid(): string {
  return generator();
}
