// @ts-check
/**
 * The building, as geometry. Pure maths - no DOM, no canvas, no globals.
 *
 * Everything here is metres, with the origin at the centre of the arena and
 * the positive x axis running along the major axis. Dimensions come from
 * `claims.js` so that the drawing and the stated figures cannot drift apart.
 *
 * The cavea is modelled as a family of nested ellipses: a seat is addressed by
 * an angle and a radial parameter `t`, where t = 0 is the arena wall and t = 1
 * is the outer wall. That is a projection of a real amphitheatre, not a
 * simplification of one - the tiers genuinely do rise as they recede.
 */

import { value } from './claims.js?v=b12';

/** Half-dimensions of the outer wall, metres. */
export const OUTER = { a: value('outerLength') / 2, b: value('outerWidth') / 2 };

/** Half-dimensions of the arena floor, metres. */
export const ARENA = { a: value('arenaLength') / 2, b: value('arenaWidth') / 2 };

/** Radial wedges - the repeated unit cell of the whole structure. */
export const WEDGES = 80;

/** Angular width of one wedge, radians. */
export const WEDGE_ANGLE = (2 * Math.PI) / WEDGES;

/**
 * Wedges aligned with the two axes. These are the four unnumbered entrances:
 * the imperial box, the ceremonial gate, and the Porta Libitinaria - the gate
 * the dead left by. They carry no ordinary spectators.
 * @type {number[]}
 */
export const AXIAL_WEDGES = [0, WEDGES / 4, WEDGES / 2, (3 * WEDGES) / 4];

/** @param {number} w wedge index */
export const isAxial = (w) => AXIAL_WEDGES.includes(w);

/** The 76 wedges that seated the public. */
export const PUBLIC_WEDGES = Array.from({ length: WEDGES }, (_, i) => i).filter((w) => !isAxial(w));

/**
 * Seating tiers, innermost first, as bands in the radial parameter t.
 *
 * `share` is the fraction of the crowd seated in each band. The upper tiers
 * held far more people than their share of the floor area suggests: the
 * wooden gallery was standing room, packed, while the podium held a few
 * hundred senators on marked seats.
 *
 * @type {{key: string, name: string, t0: number, t1: number, occupants: string, share: number}[]}
 */
export const TIERS = [
  {
    key: 'podium',
    name: 'Podium',
    t0: 0.0, t1: 0.12,
    occupants: 'Emperor, Vestal Virgins, senators',
    share: 0.03,
  },
  {
    key: 'primum',
    name: 'Maenianum primum',
    t0: 0.12, t1: 0.35,
    occupants: 'Equites - the knightly class',
    share: 0.17,
  },
  {
    key: 'secundum_imum',
    name: 'Maenianum secundum imum',
    t0: 0.35, t1: 0.58,
    occupants: 'Wealthy plebeians',
    share: 0.24,
  },
  {
    key: 'secundum_summum',
    name: 'Maenianum secundum summum',
    t0: 0.58, t1: 0.8,
    occupants: 'Poor citizens',
    share: 0.28,
  },
  {
    key: 'in_ligneis',
    name: 'Maenianum secundum in ligneis',
    t0: 0.8, t1: 1.0,
    occupants: 'Standing room: the poor, slaves, and women',
    share: 0.28,
  },
];

/**
 * Centre-line angle of a wedge, radians. Wedge 0 sits on the positive x axis.
 * @param {number} w wedge index
 */
export function wedgeAngle(w) {
  return w * WEDGE_ANGLE;
}

/**
 * The gate serving a wedge is at that wedge's angle, on the outer wall.
 * @param {number} w wedge index
 */
export function gatePoint(w) {
  return ellipsePoint(wedgeAngle(w), 1);
}

/**
 * A point in the cavea.
 * @param {number} theta radians
 * @param {number} t 0 at the arena wall, 1 at the outer wall
 * @returns {{x: number, y: number}}
 */
export function ellipsePoint(theta, t) {
  const a = ARENA.a + (OUTER.a - ARENA.a) * t;
  const b = ARENA.b + (OUTER.b - ARENA.b) * t;
  return { x: a * Math.cos(theta), y: b * Math.sin(theta) };
}

/**
 * Local radius at an angle and depth - useful for turning an angular offset
 * into a walking distance along a curved row.
 * @param {number} theta
 * @param {number} t
 */
export function radiusAt(theta, t) {
  const p = ellipsePoint(theta, t);
  return Math.hypot(p.x, p.y);
}

/**
 * Walking distance from a seat to a gate, following the only routes the
 * building actually offers: around the row to a stairway, then down and out.
 *
 * Angular travel is along a curved row, so it is scaled by the local radius;
 * radial travel is down a raked stair, so it is longer than the plan distance
 * suggests. The stair factor is a modelling choice, not an attested figure.
 *
 * @param {number} theta seat angle
 * @param {number} t seat depth
 * @param {number} gateWedge which gate they are walking to
 * @returns {number} metres
 */
export function walkDistance(theta, t, gateWedge) {
  const target = wedgeAngle(gateWedge);
  let d = Math.abs(theta - target);
  if (d > Math.PI) d = 2 * Math.PI - d; // the short way round
  const angular = d * radiusAt(theta, t);
  const radial = (1 - t) * Math.hypot(OUTER.a - ARENA.a, OUTER.b - ARENA.b) * 0.5;
  return angular + radial;
}

/**
 * The gate a spectator would reach soonest, among those still open.
 *
 * With 80 evenly spaced gates this is almost always the spectator's own wedge -
 * which is the point. The Roman assignment encodes the choice a perfectly
 * informed crowd would make anyway; its value is that it does not require
 * anyone to make it. The interesting cases are when gates close, or when
 * people head for an exit they know rather than the one that is nearest.
 *
 * @param {number} theta
 * @param {number} t
 * @param {Set<number>} openWedges
 * @returns {number} wedge index of the chosen gate
 */
export function nearestOpenGate(theta, t, openWedges) {
  let best = -1;
  let bestD = Infinity;
  for (const w of openWedges) {
    const d = walkDistance(theta, t, w);
    if (d < bestD) { bestD = d; best = w; }
  }
  if (best < 0) throw new Error('No open gates - the building cannot be evacuated.');
  return best;
}

/**
 * Which tier a radial depth falls in.
 * @param {number} t
 */
export function tierAt(t) {
  for (const tier of TIERS) if (t >= tier.t0 && t <= tier.t1) return tier;
  return TIERS[TIERS.length - 1];
}

/**
 * Height of the seating above the arena floor, metres.
 *
 * This is the dimension a plan view hides, and hiding it inverts the story:
 * from directly overhead the wooden gallery looks *closest* to the outer wall
 * and therefore closest to the street. In fact it sat some forty metres up.
 * Rank set your tier, tier set your height, and height was most of your
 * journey home.
 *
 * @param {number} t
 */
export function heightAt(t) {
  const podium = value('podiumHeight');
  return podium + (value('outerHeight') - podium) * t;
}

/**
 * Length of the descent from a seat at depth `t` to the street: the
 * horizontal run out to the wall and the vertical drop, together.
 * @param {number} t
 * @param {number} radialRun horizontal distance from t to the outer wall
 */
export function descentLength(t, radialRun) {
  return Math.hypot(radialRun, heightAt(t));
}

/** Bounding box of the whole structure, for fitting the view. */
export const BOUNDS = { minX: -OUTER.a, maxX: OUTER.a, minY: -OUTER.b, maxY: OUTER.b };
