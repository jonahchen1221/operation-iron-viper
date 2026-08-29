// Serializable xorshift32. The pure simulation never calls Math.random().
export function nextRandom(seed: number): { seed: number; value: number } {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const next = x >>> 0 || 0x6d2b79f5;
  return { seed: next, value: next / 0x1_0000_0000 };
}

export function randomRange(seed: number, min: number, max: number): { seed: number; value: number } {
  const next = nextRandom(seed);
  return { seed: next.seed, value: min + (max - min) * next.value };
}
