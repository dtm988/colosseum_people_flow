// @ts-check
/**
 * Wiring. Everything stateful about the page lives here; everything true about
 * the building lives in the modules this imports.
 */

import { createCrowd, step, sample, metrics, EXIT_T } from './crowd.js';
import { PlanView } from './render.js';
import { ClearanceChart, GateStrip, mmss } from './chart.js';
import { CLAIMS, format, value } from './claims.js';
import { TIERS, WEDGES, PUBLIC_WEDGES, isAxial, heightAt } from './geometry.js';

/**
 * Palette. Two categorical slots for the two exit policies, validated for
 * colour-vision deficiency against this surface (worst pair ΔE 26.8, well
 * clear of the floor). Everything else is chrome and ink - text never wears a
 * series colour.
 */
const THEME = {
  surface: '#14110e',
  structure: '#6b6153',
  structureDim: '#2a251f',
  ink: '#efe7db',
  muted: '#9a8f80',
  grid: '#241f1a',
  axis: '#3a332b',
  agent: '#efe7db',
  gate: '#d8a657',
  gateShut: '#8c4a3f',
  series: { colosseum: '#3987e5', modern: '#d95926' },
};

const SPEEDS = [1, 5, 15, 30, 60, 120];

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

const plan = new PlanView(/** @type {HTMLCanvasElement} */ ($('plan')), THEME);
const curve = new ClearanceChart(/** @type {HTMLCanvasElement} */ ($('curve')), THEME);
const strip = new GateStrip(/** @type {HTMLCanvasElement} */ ($('strip')), THEME);

const DT = 0.2;

const state = {
  /** @type {'colosseum'|'modern'} */ venue: 'colosseum',
  /** @type {'routed'|'unrouted'} */ mode: 'routed',
  n: 50000,
  closedCount: 0,
  speed: 30,
  running: false,
  /** @type {ReturnType<typeof createCrowd>|null} */ crowd: null,
  seed: 12345,
  sinceSample: 0,
  /** @type {number|null} */ selectedWedge: null,
};

/**
 * Gates are shut as a contiguous arc rather than at random: a blocked sector
 * is what actually happens, and it is the case that hurts a static routing
 * table most - your gate is shut and an assignment has no fallback.
 */
function closedSet(count) {
  const s = new Set();
  let placed = 0;
  for (let i = 0; placed < count && i < WEDGES; i++) {
    const w = (12 + i) % WEDGES;
    if (isAxial(w)) continue;
    s.add(w);
    placed++;
  }
  return s;
}

function build() {
  const closed = closedSet(state.closedCount);
  const c = createCrowd({
    n: state.n,
    seed: state.seed,
    mode: state.mode,
    venue: state.venue,
    closedGates: [...closed],
  });
  state.crowd = c;
  state.sinceSample = 0;
  plan.setClosedGates(closed, new Set(c.venue.exits), c.venue.nominalStairW / value('stairWidth'));
  strip.set(c.gateExits, closed, state.venue);
  curve.setRun(state.venue, c.history, state.n);
  redraw();
}

function redraw() {
  if (state.crowd) plan.draw(state.crowd);
  curve.draw();
  strip.draw();
  renderMetrics();
}

// --- metrics ---------------------------------------------------------------

function tile(label, val, sub = '') {
  return `<div class="tile"><span class="tl">${label}</span><span class="tv">${val}</span>${sub ? `<span class="ts">${sub}</span>` : ''}</div>`;
}

function renderMetrics() {
  const c = state.crowd;
  if (!c) return;
  const m = metrics(c);
  const pct = ((c.evacuated / c.n) * 100).toFixed(0);
  const published = Number(CLAIMS.egressPublished.value);
  const flowPub = Number(CLAIMS.specificFlowColosseum.value);

  const done = c.evacuated >= c.n;
  const gapTxt = done && Number.isFinite(m.t100)
    ? `${m.t100 > published ? '+' : ''}${Math.round(m.t100 - published)}s vs published`
    : `published ${mmss(published)}`;

  const effWidth = c.openGates.length * c.venue.stairW;
  const perPerson = (effWidth / c.n) * 1000;

  $('metrics').innerHTML =
    tile('elapsed', mmss(c.time), `${pct}% out`) +
    tile('last out', done ? mmss(m.t100) : '—', gapTxt) +
    tile('95% out', Number.isFinite(m.t95) ? mmss(m.t95) : '—', 'robust to stragglers') +
    tile('peak stair flow', m.peakSpecificFlow ? m.peakSpecificFlow.toFixed(2) : '—',
      `p/s/m · published ${flowPub}`) +
    tile('stair that works', `${perPerson.toFixed(1)} mm`,
      `per person · code asks 7.6`);
}

// --- claims drawer ---------------------------------------------------------

function renderClaims() {
  const order = ['egressFolk', 'egressPublished', 'specificFlowColosseum', 'specificFlowModern4m',
    'capacity', 'publicGates', 'numerals', 'gateWidth', 'stairWidth', 'outerHeight',
    'freeSpeed', 'jamSpeed', 'stairCapacity', 'stairSpeed',
    'familiarExitBias', 'familiarityIsEmergency', 'tesserae', 'modernExits', 'concourseWidth'];
  $('claimList').innerHTML = order.map((k) => {
    const f = format(k);
    return `<div class="claim"><div class="claim-h"><b>${f.text}</b><span class="chip t-${f.tier}">${f.tier}</span></div>
      <p>${f.note}</p><cite>${f.src}</cite></div>`;
  }).join('');
}

// --- wedge drill-in --------------------------------------------------------

/**
 * The plan view hides the dimension that carries the point: from overhead the
 * cheapest seats look closest to the street, when in fact they sat forty
 * metres up. This panel is the correction.
 */
function renderDrill(w) {
  const el = $('drill');
  if (w == null || w < 0) { el.hidden = true; return; }
  el.hidden = false;

  if (isAxial(w)) {
    el.innerHTML = `<h3>Wedge ${w + 1} — reserved</h3>
      <p>One of the four axial entrances, kept for the Emperor and the elite, ceremonial
      processions, and the dead. No ordinary spectator used it, which is why 80 arches
      served 76 wedges of public seating.</p>`;
    return;
  }

  const rows = TIERS.map((t) => {
    const mid = (t.t0 + t.t1) / 2;
    const h = heightAt(mid);
    return `<tr><td>${t.name}</td><td>${t.occupants}</td><td class="num">${h.toFixed(0)} m</td></tr>`;
  }).join('');

  const c = state.crowd;
  const exits = c ? c.gateExits[w] : 0;
  const isExit = c ? c.venue.exits.includes(w) : true;
  const blurb = !isExit
    ? `No exit here. In this building the openings are gathered into ${c.venue.exits.length} grand
       exits, so everyone seated in this wedge walks round to one of them.`
    : `Its own stair, its own arch, its own share of the crowd. ${exits.toLocaleString()} people
       have left through this gate.`;
  el.innerHTML = `<h3>Wedge ${w + 1}</h3>
    <p>${blurb}</p>
    <table><thead><tr><th>Tier</th><th>Who sat here</th><th class="num">Height</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="fine">Rank set your tier and tier set your height — and height was most of the
    journey home. The best seats were also the shortest walk.</p>`;
}

// --- loop ------------------------------------------------------------------

let last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const c = state.crowd;
  if (!c) return;

  if (state.running && c.evacuated < c.n) {
    const dtWall = Math.min(0.1, (ts - last) / 1000 || 1 / 60);
    const simSeconds = dtWall * state.speed;
    const steps = Math.min(40, Math.max(1, Math.round(simSeconds / DT)));
    for (let i = 0; i < steps; i++) {
      step(c, DT);
      state.sinceSample += DT;
      if (state.sinceSample >= 5) { sample(c); state.sinceSample = 0; }
    }
    if (c.evacuated >= c.n) {
      sample(c);
      state.running = false;
      $('run').textContent = 'Run egress';
    }
  }
  last = ts;

  if (state.crowd) plan.draw(state.crowd);
  curve.draw();
  strip.draw();
  renderMetrics();
}

// --- controls --------------------------------------------------------------

$('run').addEventListener('click', () => {
  const c = state.crowd;
  if (!c) return;
  if (c.evacuated >= c.n) build();
  state.running = !state.running;
  $('run').textContent = state.running ? 'Pause' : 'Run egress';
});

$('reset').addEventListener('click', () => {
  state.running = false;
  $('run').textContent = 'Run egress';
  curve.clearRuns();
  build();
});

for (const r of document.querySelectorAll('input[name=venue]')) {
  r.addEventListener('change', (e) => {
    state.venue = /** @type {any} */ (e.target).value;
    state.running = false;
    $('run').textContent = 'Run egress';
    build();
    renderLegend();
  });
}

for (const r of document.querySelectorAll('input[name=mode]')) {
  r.addEventListener('change', (e) => {
    state.mode = /** @type {any} */ (e.target).value;
    state.running = false;
    $('run').textContent = 'Run egress';
    build();
    renderLegend();
  });
}

$('closed').addEventListener('input', (e) => {
  state.closedCount = Number(/** @type {any} */(e.target).value);
  $('closedOut').textContent = String(state.closedCount);
  state.running = false;
  $('run').textContent = 'Run egress';
  build();
});

$('crowd').addEventListener('input', (e) => {
  state.n = Number(/** @type {any} */(e.target).value);
  $('crowdOut').textContent = state.n.toLocaleString();
  state.running = false;
  $('run').textContent = 'Run egress';
  build();
});

$('speed').addEventListener('input', (e) => {
  state.speed = SPEEDS[Number(/** @type {any} */(e.target).value) - 1];
  $('speedOut').textContent = `${state.speed}×`;
});

$('plan').addEventListener('click', (e) => {
  const w = plan.wedgeAt(/** @type {MouseEvent} */(e).clientX, /** @type {MouseEvent} */(e).clientY);
  state.selectedWedge = w >= 0 ? w : null;
  renderDrill(state.selectedWedge);
});

for (const b of document.querySelectorAll('.scenario')) {
  b.addEventListener('click', () => {
    const p = /** @type {HTMLElement} */ (b).dataset.preset;
    curve.clearRuns();
    if (p === 'games') { state.venue = 'colosseum'; state.mode = 'routed'; state.closedCount = 0; }
    if (p === 'modern') { state.venue = 'modern'; state.mode = 'unrouted'; state.closedCount = 0; }
    if (p === 'unrouted') { state.venue = 'colosseum'; state.mode = 'unrouted'; state.closedCount = 0; }
    /** @type {HTMLInputElement} */ (document.querySelector(`input[name=mode][value=${state.mode}]`)).checked = true;
    /** @type {HTMLInputElement} */ (document.querySelector(`input[name=venue][value=${state.venue}]`)).checked = true;
    /** @type {HTMLInputElement} */ ($('closed')).value = String(state.closedCount);
    $('closedOut').textContent = String(state.closedCount);
    build();
    renderLegend();
    state.running = true;
    $('run').textContent = 'Pause';
  });
}

function renderLegend() {
  $('legend').innerHTML = Object.keys(curve.runs).map((k) =>
    `<span class="key"><i style="background:${THEME.series[k]}"></i>${k}</span>`).join('');
}

addEventListener('resize', () => {
  plan.resize();
  if (state.crowd) plan.setClosedGates(closedSet(state.closedCount), new Set(state.crowd.venue.exits));
  curve.resize();
  strip.resize();
  redraw();
});

/**
 * Automation hook.
 *
 * Browsers suspend requestAnimationFrame in a background tab, so a script that
 * wants to drive the model - for a screenshot, a check, or a recorded demo -
 * cannot rely on the animation loop. This exposes the same operations the
 * controls use, nothing more, and touches no state the UI does not already own.
 */
window.colosseum = {
  state,
  build,
  redraw,
  /** Advance the model by `seconds` of simulated time, then repaint. */
  advance(seconds) {
    const c = state.crowd;
    if (!c) return;
    for (let s = 0; s < seconds && c.evacuated < c.n; s += DT) {
      step(c, DT);
      state.sinceSample += DT;
      if (state.sinceSample >= 5) { sample(c); state.sinceSample = 0; }
    }
    sample(c);
    redraw();
    return metrics(c);
  },
  /** @param {'colosseum'|'modern'} venue */
  setVenue(venue) {
    state.venue = venue;
    /** @type {HTMLInputElement} */ (document.querySelector(`input[name=venue][value=${venue}]`)).checked = true;
    build();
    renderLegend();
  },
  /** @param {'routed'|'unrouted'} mode */
  setMode(mode) {
    state.mode = mode;
    /** @type {HTMLInputElement} */ (document.querySelector(`input[name=mode][value=${mode}]`)).checked = true;
    build();
    renderLegend();
  },
};

renderClaims();
build();
renderLegend();
$('speedOut').textContent = `${state.speed}×`;
requestAnimationFrame(frame);
