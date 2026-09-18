// @ts-check
/**
 * Seeded pseudo-randomness.
 *
 * Every run is reproducible from its seed, which is not a nicety: the routed
 * and unrouted runs have to use the *same* crowd, or part of the difference
 * between them is just two different random draws. Same seed, one variable.
 *
 * mulberry32 - small, fast, good enough for seat assignment and exit choice.
 */

/**
 * @param {number} seed
 * @returns {() => number} uniform in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick an index from a weight array, in proportion to the weights.
 * @param {number[]|Float64Array} weights
 * @param {() => number} rand
 */
export function weightedPick(weights, rand) {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i];
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/**
 * A signed integer offset drawn from a discrete two-sided geometric
 * distribution: zero is most likely, larger offsets decay geometrically.
 *
 * Used for entry gates - most spectators came in near their own wedge, some
 * did not, and that spread is what lets familiarity pull across wedge
 * boundaries and create contention.
 *
 * @param {number} decay 0 = always zero offset, approaching 1 = very wide
 * @param {() => number} rand
 */
export function geometricOffset(decay, rand) {
  if (decay <= 0) return 0;
  let n = 0;
  while (rand() < decay) n++;
  return rand() < 0.5 ? -n : n;
}
