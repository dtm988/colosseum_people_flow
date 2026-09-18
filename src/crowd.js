// @ts-check
/**
 * The crowd. Pure simulation - no DOM, no canvas, no requestAnimationFrame.
 * The same module runs in the browser and in Node, which is how the model gets
 * checked against published figures without watching a 13-minute animation.
 *
 * WHAT IS IMPORTED FROM MEASUREMENT
 *   - speed as a function of local density (Kholshevnikov & Samoshin, ~35,000 counts)
 *   - the 71% familiar-exit bias, which fixes the exit-choice model's one free parameter
 *   - stair and gate widths
 *
 * WHAT IS EMERGENT
 *   - where queues form and how they interact
 *   - the specific flow the building achieves, which is therefore a genuine
 *     check against the published 1.14 person/s/m rather than an assumption
 *   - how clearance time responds to exit policy and to exit capacity
 *
 * Saying which is which is the point. A model that quietly imposes its own
 * headline result and then reports it as a finding is worthless.
 *
 * KNOWN SIMPLIFICATIONS, named rather than hidden:
 *
 *   1. Capacity is allocated in array-index order. Densities are binned once
 *      per step so everyone in a cell sees the same value, but the admission
 *      checks mutate the counts as the loop runs - so when a cell has one slot
 *      left, the lower array index takes it. Deterministic, and effectively
 *      random because the crowd is generated in random order, but it is a tie
 *      break the physics does not justify.
 *
 *   2. Speed and admission read different epochs. An agent's speed comes from
 *      the start-of-step counts while its admission check uses live ones. A
 *      standard approximation, and worth knowing about.
 *
 *   3. Entry spread is measured in gate-index space, so one step of spread is
 *      about 6 m in the Colosseum and about 63 m in a building with eight
 *      exits. Exit choice is distance-dominated so the effect is small, but
 *      the parameter is not strictly comparable between the two venues.
 *
 *   4. Exit choice is final. Nobody queued at a busy stair ever reroutes to an
 *      idle one. Defensible here because stairs are near-equally loaded in
 *      both venues; it would not be if one route were congested and another
 *      free.
 */

import { value } from './claims.js?v=b20';
import {
  OUTER, ARENA, WEDGES, WEDGE_ANGLE, TIERS, PUBLIC_WEDGES, AXIAL_WEDGES,
  ellipsePoint, wedgeAngle, descentLength,
} from './geometry.js?v=b20';
import { mulberry32, weightedPick, geometricOffset } from './rng.js?v=b20';

// ---------------------------------------------------------------------------
// Behavioural constants, all traceable to claims.js
// ---------------------------------------------------------------------------

const V_FREE = value('freeSpeed');        // 1.3 m/s below ~0.2 p/m^2
const V_JAM = value('jamSpeed');          // 0.27 m/s at 4.5 p/m^2
const D_FREE = 0.2;                       // density below which nobody is impeded
const D_JAM = 4.5;
const V_FLOOR = 0.05;                     // nothing deadlocks completely
const STAIR_W = value('stairWidth');      // per stair, in the real building
const GATE_W = value('gateWidth');        // per arch, in the real building
const STAIR_FREE = value('stairSpeed');   // 0.6 m/s descending, unimpeded

/**
 * Stairs are modelled as their own speed-density curve, not as a flat
 * multiplier on the level-ground one.
 *
 * The level curve peaks at about 1.4 person/s/m of specific flow (density
 * times speed, maximised around 3 p/m^2) which is where the published
 * literature puts level walking. Descending stairs carry less. This factor
 * places the stair peak near 1.1 p/s/m, inside the usual published range.
 *
 * It is chosen from the stair literature, NOT fitted to make this building's
 * clearance time match anybody's. Getting that backwards would make the
 * comparison in validate.js circular and worthless.
 */
const STAIR_DRAG = 0.8;

/**
 * Exponential fit through the two measured anchors. At 7.4 p/m^2 this gives
 * about 0.09 m/s - "some slow movement still possible", which is what the
 * source says, and a point the fit was not fitted to.
 */
const DECAY = Math.log(V_FREE / V_JAM) / (D_JAM - D_FREE);

/** @param {number} density people per square metre */
export function speedAt(density) {
  if (density <= D_FREE) return V_FREE;
  return Math.max(V_FLOOR, V_FREE * Math.exp(-DECAY * (density - D_FREE)));
}

/**
 * Speed descending a stair at a given density: the same curve, dragged down,
 * and capped at the unimpeded descent speed.
 * @param {number} density people per square metre
 */
export function stairSpeedAt(density) {
  return Math.max(V_FLOOR, Math.min(STAIR_FREE, STAIR_DRAG * speedAt(density)));
}

/**
 * Log-odds of the familiar exit at equal distance: ln(0.71 / 0.29).
 * This is the whole of the exit-choice calibration. The familiarity penalty is
 * defined *relative* to beta, so changing how sharply people weigh distance
 * never disturbs the measured 71%.
 */
const FAMILIAR_LOGIT = Math.log(0.71 / 0.29);

// ---------------------------------------------------------------------------
// Lookup tables. The simulation never calls a trig function in its hot loop:
// agents live in (angle, depth) space and densities are binned there directly.
// ---------------------------------------------------------------------------

const THETA_BINS = 720;
const T_BINS = 64;
const D_THETA = (2 * Math.PI) / THETA_BINS;
const D_T = 1 / T_BINS;

/** Full radial run from arena wall to outer wall at each angle, metres. */
const RADIAL_FULL = new Float32Array(THETA_BINS);
/** Distance from centre at each (depth, angle), metres. */
const RADIUS = new Float32Array(T_BINS * THETA_BINS);

for (let i = 0; i < THETA_BINS; i++) {
  const th = i * D_THETA;
  const inner = ellipsePoint(th, 0);
  const outer = ellipsePoint(th, 1);
  RADIAL_FULL[i] = Math.hypot(outer.x - inner.x, outer.y - inner.y);
  for (let j = 0; j < T_BINS; j++) {
    const p = ellipsePoint(th, (j + 0.5) * D_T);
    RADIUS[j * THETA_BINS + i] = Math.hypot(p.x, p.y);
  }
}

/** Cell areas, precomputed so density is a division and nothing more. */
const CAVEA_AREA = new Float32Array(T_BINS * THETA_BINS);
for (let j = 0; j < T_BINS; j++) {
  for (let i = 0; i < THETA_BINS; i++) {
    CAVEA_AREA[j * THETA_BINS + i] = RADIUS[j * THETA_BINS + i] * D_THETA * D_T * RADIAL_FULL[i];
  }
}

/**
 * Stairs are binned by metres actually travelled, not by depth.
 *
 * Depth is a poor proxy once the vertical drop is in the model: a spectator in
 * the wooden gallery has almost no horizontal distance left but forty metres
 * to descend. Binning by real distance keeps every stair cell the same true
 * size, so density means the same thing everywhere and specific flow cannot
 * exceed what the speed-density curve allows.
 */
const S_CELL = 1.5;                      // metres of stair per cell
const S_BINS = 64;                       // covers 96 m of descent
const sBin = (/** @type {number} */ s) => Math.min(S_BINS - 1, Math.max(0, Math.floor(s / S_CELL)));

/**
 * The gate throat.
 *
 * Spectators from different tiers finish their descent after different
 * distances, so without this there is no single place they all pass through -
 * and a model with no common bottleneck will happily report a flow rate the
 * physics cannot deliver. The last few metres of every route are the arch
 * itself, 4.2 m wide, shared by everyone leaving through that gate.
 */
const THROAT_M = 3;

/**
 * Jam density - the point at which a cell is physically full.
 *
 * A speed-density rule alone slows people down but never stops them entering,
 * so without this the model will cheerfully pack hundreds of people into one
 * stair tread and then report a flow rate the physics cannot deliver. Cells
 * that are full refuse entry, and the queue backs up the stair on its own.
 *
 * That exclusion is where the congestion in this model actually comes from.
 * The speed curve is imported from measurement; the queues are emergent.
 */
const JAM_DENSITY = 6;

/**
 * A venue differs in two ways: how its exit capacity is arranged, and how much
 * of each metre of it actually works.
 *
 * The second is the one that matters, and it is measured rather than invented.
 * The published comparison puts the Colosseum at 1.14 person/s/m and a modern
 * arena at 0.80 on a 4 m stair - so 2.8 m of Roman stair (3.19 p/s) does the
 * work of 4.0 m of modern stair (3.20 p/s). A stair thirty percent narrower,
 * carrying the same people per second.
 *
 * That loss is modelled the standard way, as EFFECTIVE WIDTH: obstructions,
 * turns, merging streams and the general furniture of a commercial arena mean
 * only part of a nominal width carries flow. The ratio comes straight from the
 * two published figures, 0.80 / 1.14 = 0.70, and nothing else in the model is
 * touched - the speed-density curve stays exactly as measured.
 *
 * Importing a measured parameter and reporting its consequence is not the same
 * as assuming the answer. The consequence - what that costs across a whole
 * building - is what this tool computes.
 *
 * @param {'colosseum'|'modern'} kind
 */
export function venueOf(kind) {
  const totalStair = PUBLIC_WEDGES.length * STAIR_W;
  const totalGate = PUBLIC_WEDGES.length * GATE_W;
  const EFFICIENCY = value('specificFlowModern4m') / value('specificFlowColosseum');

  // The real difference between the two buildings is not how much exit
  // capacity they have - held equal here - but whether people share a corridor
  // on the way to it.
  //
  // In the Colosseum a spectator goes from seat to stair to arch inside one
  // wedge. There is no shared horizontal circulation at all: paths from
  // different wedges never meet until they are outside the building. A modern
  // arena gathers everyone into a concourse ring first, and that ring is where
  // flows merge and density accumulates.
  //
  // This is modelled, not measured, and the width is an assumption the tool
  // shows rather than hides.
  if (kind === 'modern') {
    const count = value('modernExits');
    const stride = WEDGES / count;
    // Offset by half a stride so the grand exits do not land on the four axial
    // arches, which were never public in the first place.
    const exits = Array.from({ length: count }, (_, i) => Math.round(i * stride + stride / 2) % WEDGES);
    return {
      kind, exits,
      nominalStairW: totalStair / exits.length,
      efficiency: EFFICIENCY,
      // Effective width: the part of the nominal width that actually carries flow.
      stairW: (totalStair / exits.length) * EFFICIENCY,
      gateW: (totalGate / exits.length) * EFFICIENCY,
      label: `${exits.length} grand exits, ${Math.round(100 * EFFICIENCY)}% effective`,
    };
  }
  return {
    kind, exits: PUBLIC_WEDGES.slice(),
    nominalStairW: STAIR_W,
    efficiency: 1,
    stairW: STAIR_W,
    gateW: GATE_W,
    label: `${PUBLIC_WEDGES.length} numbered gates`,
  };
}

const thetaBin = (/** @type {number} */ th) => {
  let i = Math.floor(th / D_THETA) % THETA_BINS;
  return i < 0 ? i + THETA_BINS : i;
};
const tBin = (/** @type {number} */ t) => Math.min(T_BINS - 1, Math.max(0, Math.floor(t / D_T)));

/** Shortest signed angular difference, target minus current. */
function angleDelta(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

export const PHASE_ROW = 0;    // along the row and round the cavea to a stairway
export const PHASE_STAIR = 1;  // down the stair and out through the gate
export const PHASE_DONE = 2;

export const EXIT_T = 1.05; // past the outer wall

// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CrowdOptions
 * @property {number} [n] how many spectators
 * @property {number} [seed]
 * @property {'routed'|'unrouted'} [mode]
 * @property {number} [beta] how sharply distance is weighed, per metre
 * @property {number} [entrySpread] 0 = everyone entered at their own wedge
 */

/**
 * Build a crowd. Deterministic given the seed.
 * @param {CrowdOptions} [opts]
 */
export function createCrowd(opts = {}) {
  const n = opts.n ?? value('capacity');
  const seed = opts.seed ?? 1;
  const mode = opts.mode ?? 'routed';
  const beta = opts.beta ?? 0.05;
  const entrySpread = opts.entrySpread ?? (mode === 'routed' ? 0.35 : 0.2);
  const rand = mulberry32(seed);
  const venue = venueOf(opts.venue ?? 'colosseum');

  const openGates = venue.exits.slice();

  const stairCellArea = venue.stairW * S_CELL;
  const stairCap = Math.max(1, Math.floor(JAM_DENSITY * stairCellArea));
  const throatArea = venue.gateW * THROAT_M;
  const throatCap = Math.max(1, Math.floor(JAM_DENSITY * throatArea));

  // Nearest open exit to each wedge, precomputed once.
  const nearestExit = new Uint16Array(WEDGES);
  for (let w = 0; w < WEDGES; w++) {
    let best = openGates[0];
    let bestD = Infinity;
    for (const g of openGates) {
      const raw = (((g - w) % WEDGES) + WEDGES) % WEDGES;
      const d = Math.min(raw, WEDGES - raw);
      if (d < bestD) { bestD = d; best = g; }
    }
    nearestExit[w] = best;
  }

  /**
   * Where people came in.
   *   routed   - at their own wedge, with a tail: latecomers, groups meeting
   *              up, people arriving from the wrong side of the city.
   *   unrouted - funnelled through a handful of grand entrances, the way a
   *              modern venue works. Seats are unchanged; only arrival differs.
   */
  const mainEntrances = venue.kind === 'modern'
    ? openGates.slice()                                  // the grand exits are the way in, too
    : AXIAL_WEDGES.map((w) => (w + 1) % WEDGES);         // flanking the reserved axial arches

  const theta = new Float32Array(n);
  const t = new Float32Array(n);
  const tierIdx = new Uint8Array(n);
  const seatWedge = new Uint16Array(n);
  const entryWedge = new Uint16Array(n);
  const exitWedge = new Uint16Array(n);
  const targetTheta = new Float32Array(n);
  const phase = new Uint8Array(n);
  const tStart = new Float32Array(n);      // depth at which the descent began
  const descentLen = new Float32Array(n);  // metres of stair, horizontal and vertical together
  const travelled = new Float32Array(n);   // metres down that stair so far

  const tierShares = TIERS.map((x) => x.share);

  for (let k = 0; k < n; k++) {
    const ti = weightedPick(tierShares, rand);
    const tier = TIERS[ti];
    const w = PUBLIC_WEDGES[Math.floor(rand() * PUBLIC_WEDGES.length)];

    tierIdx[k] = ti;
    seatWedge[k] = w;
    theta[k] = wedgeAngle(w) + (rand() - 0.5) * WEDGE_ANGLE;
    t[k] = tier.t0 + rand() * (tier.t1 - tier.t0);

    let entry;
    if (mode === 'routed') {
      // They came in where their seat says they came in - give or take the
      // latecomers, the groups meeting up, and the ones who arrived from the
      // wrong side of the city.
      const base = nearestExit[w];
      const idx = openGates.indexOf(base) + geometricOffset(entrySpread, rand);
      entry = openGates[((idx % openGates.length) + openGates.length) % openGates.length];
    } else {
      // Drawn from the gates that actually exist. Letting the offset wander
      // onto a reserved axial arch used to leave that spectator with an entry
      // gate no one can leave by, so `g === entry` never matched in
      // chooseExit and they lost the familiarity bias entirely - silently, for
      // about 8% of the unrouted crowd.
      const base = mainEntrances[Math.floor(rand() * mainEntrances.length)];
      const bi = openGates.indexOf(nearestExit[base]) + geometricOffset(entrySpread, rand);
      entry = openGates[((bi % openGates.length) + openGates.length) % openGates.length];
    }
    entryWedge[k] = entry;
    exitWedge[k] = chooseExit(theta[k], t[k], entry, openGates, beta, rand);
    targetTheta[k] = wedgeAngle(exitWedge[k]);
    phase[k] = PHASE_ROW;
  }

  return {
    n, seed, mode, beta, entrySpread, openGates,
    venue, stairCellArea, stairCap, throatArea, throatCap,
    theta, t, tierIdx, seatWedge, entryWedge, exitWedge, targetTheta, phase,
    tStart, descentLen, travelled,
    time: 0,
    evacuated: 0,
    walkedInCavea: 0,   // total metres walked round the bowl before reaching a stair
    gateExits: new Uint32Array(WEDGES),
    _prevGateExits: new Uint32Array(WEDGES),
    caveaCount: new Uint16Array(T_BINS * THETA_BINS),
    stairCount: new Uint16Array(S_BINS * WEDGES),
    throatCount: new Uint16Array(WEDGES),
    /** @type {{time: number, evacuated: number, rate: number, specificFlow: number}[]} */
    history: [],
    _lastSampleTime: 0,
    _lastSampleEvac: 0,
  };
}

/** @typedef {ReturnType<typeof createCrowd>} Crowd */

/**
 * Multinomial logit over the open gates.
 *
 * Disutility is walking distance plus, for any gate that is not the one they
 * came in by, a familiarity penalty sized so that two equidistant exits split
 * 71/29 in favour of the familiar one - the measured figure.
 *
 * Only gates within a window are considered: beyond it the logit weight is
 * negligible and the arithmetic is wasted. The entry gate is always a
 * candidate however far away it is, because that is the entire phenomenon.
 */
function chooseExit(th, tt, entry, openGates, beta, rand) {
  const j = tBin(tt);
  const i = thetaBin(th);
  const radius = RADIUS[j * THETA_BINS + i];

  const seatWedgeApprox = Math.round(th / WEDGE_ANGLE);
  const WINDOW = 12;

  /** @type {number[]} */ const cand = [];
  /** @type {number[]} */ const score = [];
  let best = -Infinity;

  for (const g of openGates) {
    // Wedge-distance the short way round.
    const raw = (((g - seatWedgeApprox) % WEDGES) + WEDGES) % WEDGES;
    const d = Math.min(raw, WEDGES - raw);
    if (d > WINDOW && g !== entry) continue;

    const walk = Math.abs(angleDelta(th, wedgeAngle(g))) * radius;
    const s = -(beta * walk + (g === entry ? 0 : FAMILIAR_LOGIT));
    cand.push(g);
    score.push(s);
    if (s > best) best = s;
  }

  if (cand.length === 0) {
    // Nothing nearby and they did not come in by one of these gates:
    // fall back to the genuinely nearest.
    let bestG = openGates[0];
    let bestD = Infinity;
    for (const g of openGates) {
      const d = Math.abs(angleDelta(th, wedgeAngle(g)));
      if (d < bestD) { bestD = d; bestG = g; }
    }
    return bestG;
  }

  let total = 0;
  for (let k = 0; k < score.length; k++) {
    score[k] = Math.exp(score[k] - best);
    total += score[k];
  }
  let r = rand() * total;
  for (let k = 0; k < cand.length; k++) {
    r -= score[k];
    if (r <= 0) return cand[k];
  }
  return cand[cand.length - 1];
}

/**
 * Advance the simulation by dt seconds of sim time.
 * @param {Crowd} c
 * @param {number} dt
 */
export function step(c, dt) {
  const { theta, t, phase, targetTheta, exitWedge, caveaCount, stairCount, throatCount } = c;

  caveaCount.fill(0);
  stairCount.fill(0);
  throatCount.fill(0);

  // Bin everyone first: speed depends on how crowded their own cell is, and
  // that has to be the same for everyone in it regardless of update order.
  for (let k = 0; k < c.n; k++) {
    if (phase[k] === PHASE_DONE) continue;
    if (phase[k] === PHASE_ROW) caveaCount[tBin(t[k]) * THETA_BINS + thetaBin(theta[k])]++;
    else if (c.descentLen[k] - c.travelled[k] < THROAT_M) throatCount[exitWedge[k]]++;
    else stairCount[sBin(c.travelled[k]) * WEDGES + exitWedge[k]]++;
  }

  let exited = 0;

  for (let k = 0; k < c.n; k++) {
    if (phase[k] === PHASE_DONE) continue;

    const j = tBin(t[k]);
    const i = thetaBin(theta[k]);

    if (phase[k] === PHASE_ROW) {
      const cell = j * THETA_BINS + i;
      const v = speedAt(caveaCount[cell] / CAVEA_AREA[cell]);
      const radius = RADIUS[cell];
      const delta = angleDelta(theta[k], targetTheta[k]);
      const stepAngle = (v * dt) / radius;

      c.walkedInCavea += Math.min(Math.abs(delta), stepAngle) * radius;

      if (Math.abs(delta) <= stepAngle) {
        theta[k] = targetTheta[k];
        // They have reached the head of the stair - but only get on it if
        // there is room. If not they wait here, and the queue backs up into
        // the seating bowl, which is exactly what it did.
        const head = 0 * WEDGES + exitWedge[k];
        if (stairCount[head] < c.stairCap) {
          phase[k] = PHASE_STAIR;
          // Fix the descent now: horizontal run to the wall, plus the drop.
          c.tStart[k] = t[k];
          c.descentLen[k] = descentLength(t[k], (1 - t[k]) * RADIAL_FULL[thetaBin(theta[k])]);
          c.travelled[k] = 0;
          stairCount[head]++;   // keep the cap arithmetic honest mid-step
        }
      } else {
        theta[k] += Math.sign(delta) * stepAngle;
      }
    } else {
      const w = exitWedge[k];
      const s = c.travelled[k];
      const curBin = sBin(s);
      const inThroat = c.descentLen[k] - s < THROAT_M;

      // Under the arch the ground is level again, so the level-walking curve
      // applies there rather than the stair one.
      const v = inThroat
        ? speedAt(throatCount[w] / c.throatArea)
        : stairSpeedAt(stairCount[curBin * WEDGES + w] / c.stairCellArea);

      let next = s + v * dt;

      // Can they get into the space ahead, or is it already full?
      if (!inThroat) {
        const entersThroat = c.descentLen[k] - next < THROAT_M;
        if (entersThroat) {
          if (throatCount[w] >= c.throatCap) {
            next = c.descentLen[k] - THROAT_M - 1e-4;  // wait at the arch
          } else {
            throatCount[w]++;
            stairCount[curBin * WEDGES + w]--;
          }
        } else {
          const nextBin = sBin(next);
          if (nextBin !== curBin) {
            if (stairCount[nextBin * WEDGES + w] >= c.stairCap) {
              next = (curBin + 1) * S_CELL - 1e-4;     // wait at the cell edge
            } else {
              stairCount[nextBin * WEDGES + w]++;
              stairCount[curBin * WEDGES + w]--;
            }
          }
        }
      }

      c.travelled[k] = Math.max(s, next);

      // Depth is derived from progress, purely so the renderer knows where to
      // draw them. Measured against EXIT_T rather than 1, or anyone seated at
      // the very top of the cavea would have no depth left to travel.
      const frac = Math.min(1, c.travelled[k] / c.descentLen[k]);
      t[k] = c.tStart[k] + frac * (EXIT_T - c.tStart[k]);

      if (c.travelled[k] >= c.descentLen[k]) {
        phase[k] = PHASE_DONE;
        if (throatCount[w] > 0) throatCount[w]--;   // they are out; the arch frees up
        c.gateExits[w]++;
        exited++;
      }
    }
  }

  c.evacuated += exited;
  c.time += dt;
  return exited;
}

/**
 * Record a point on the clearance curve. Specific flow is measured, not set:
 * people per second leaving, per metre of stair width in use.
 * @param {Crowd} c
 */
export function sample(c) {
  const dt = c.time - c._lastSampleTime;
  if (dt <= 0) return;
  const d = c.evacuated - c._lastSampleEvac;
  const rate = d / dt;

  // Specific flow is measured ON THE STAIRS, which is what the published
  // figure refers to. Measuring it at the gate and dividing by stair width
  // would mix the 4.2 m arch with the 2.8 m stair and inflate the result.
  //
  // For each occupied stair cell: J = density x speed, in person/s/m. This is
  // a local, instantaneous measurement of the same quantity the literature
  // reports - and it is an output of the model, never an input to it.
  let peakJ = 0;
  let sumJ = 0;
  let occupied = 0;
  for (let i = 0; i < c.stairCount.length; i++) {
    const count = c.stairCount[i];
    if (count === 0) continue;
    const rho = count / c.stairCellArea;
    const J = rho * stairSpeedAt(rho);
    if (J > peakJ) peakJ = J;
    sumJ += J;
    occupied++;
  }

  let busiestGate = 0;
  for (let w = 0; w < WEDGES; w++) {
    const g = (c.gateExits[w] - c._prevGateExits[w]) / dt;
    if (g > busiestGate) busiestGate = g;
    c._prevGateExits[w] = c.gateExits[w];
  }

  c.history.push({
    time: c.time,
    evacuated: c.evacuated,
    rate,
    specificFlow: peakJ,
    meanStairFlow: occupied ? sumJ / occupied : 0,
    busiestGateRate: busiestGate,
  });
  c._lastSampleTime = c.time;
  c._lastSampleEvac = c.evacuated;
}

/**
 * Run to completion with no rendering.
 * @param {Crowd} c
 * @param {{dt?: number, sampleEvery?: number, maxTime?: number}} [opts]
 */
export function runToCompletion(c, opts = {}) {
  const dt = opts.dt ?? 0.2;
  const sampleEvery = opts.sampleEvery ?? 10;
  const maxTime = opts.maxTime ?? 3 * 3600;
  let sinceSample = 0;

  while (c.evacuated < c.n && c.time < maxTime) {
    step(c, dt);
    sinceSample += dt;
    if (sinceSample >= sampleEvery) { sample(c); sinceSample = 0; }
  }
  sample(c);
  return metrics(c);
}

/**
 * @param {Crowd} c
 */
export function metrics(c) {
  const at = (frac) => {
    const target = c.n * frac;
    for (const h of c.history) if (h.evacuated >= target) return h.time;
    return NaN;
  };
  const peakFlow = c.history.reduce((m, h) => Math.max(m, h.specificFlow), 0);
  const active = c.history.filter((h) => h.rate > 0);
  const meanFlow = active.length
    ? active.reduce((s, h) => s + h.specificFlow, 0) / active.length
    : 0;

  const used = [...c.gateExits].filter((x) => x > 0).length;
  let busiest = 0;
  for (let w = 0; w < WEDGES; w++) if (c.gateExits[w] > busiest) busiest = c.gateExits[w];
  const perGate = [...c.gateExits].filter((x) => x > 0);
  const meanGate = perGate.reduce((s, x) => s + x, 0) / (perGate.length || 1);

  return {
    venue: c.venue.kind,
    exits: c.openGates.length,
    widthPerExit: c.venue.stairW,
    meanWalkToStair: c.walkedInCavea / c.n,
    mode: c.mode,
    seed: c.seed,
    n: c.n,
    evacuated: c.evacuated,
    t50: at(0.5),
    t95: at(0.95),
    t100: c.evacuated >= c.n ? c.time : NaN,
    peakSpecificFlow: peakFlow,
    meanSpecificFlow: meanFlow,
    gatesUsed: used,
    busiestGate: busiest,
    gateImbalance: busiest / (meanGate || 1),
  };
}
