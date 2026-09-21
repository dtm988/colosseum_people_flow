// @ts-check
/**
 * Headless check of the model. Run with `node validate.js`.
 *
 * This exists because a simulation that cannot be compared with anything is
 * just an animation. It prints what the model produces next to the published
 * figures, and it is allowed to disagree with them - the numbers are reported,
 * not tuned. What it does hard-fail on are the invariants: conservation,
 * monotonicity, and determinism.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { createCrowd, runToCompletion, speedAt, venueOf } from './src/crowd.js';
import { CLAIMS } from './src/claims.js';

const mmss = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s` : '—');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

// --- the speed law, at the anchors it was fitted to and one it was not ------

console.log('\nSpeed–density law (Kholshevnikov & Samoshin)');
check('free speed below 0.2 p/m²', Math.abs(speedAt(0.1) - 1.3) < 1e-9, `${f2(speedAt(0.1))} m/s`);
check('0.27 m/s at 4.5 p/m²', Math.abs(speedAt(4.5) - 0.27) < 1e-6, `${f2(speedAt(4.5))} m/s`);
check('still moving at 7.4 p/m² (not fitted)', speedAt(7.4) > 0.05 && speedAt(7.4) < 0.3, `${f2(speedAt(7.4))} m/s`);

// --- the two runs -----------------------------------------------------------

const N = Number(process.env.N ?? 50000);
const runs = {};

for (const mode of /** @type {const} */ (['routed', 'unrouted'])) {
  const c = createCrowd({ n: N, seed: 12345, mode });
  const t0 = Date.now();
  runs[mode] = runToCompletion(c);
  runs[mode].wall = (Date.now() - t0) / 1000;
  runs[mode].crowd = c;
}

console.log('\nClearance');
console.log('  mode        t50        t95        t100       gates used   busiest/mean   peak flow');
for (const [mode, r] of Object.entries(runs)) {
  console.log(
    `  ${mode.padEnd(10)}  ${mmss(r.t50).padEnd(9)}  ${mmss(r.t95).padEnd(9)}  ${mmss(r.t100).padEnd(9)}  ` +
    `${String(r.gatesUsed).padEnd(11)}  ${f2(r.gateImbalance).padEnd(13)}  ${f2(r.peakSpecificFlow)} p/s/m`
  );
}

console.log('\nAgainst the literature');
const published = Number(CLAIMS.egressPublished.value);
const publishedFlow = Number(CLAIMS.specificFlowColosseum.value);
const gap = runs.routed.t100 - published;
console.log(`  published last-person-out   ${mmss(published)}   (${CLAIMS.egressPublished.src})`);
console.log(`  this model, routed          ${mmss(runs.routed.t100)}   (${gap >= 0 ? '+' : ''}${Math.round(gap)}s)`);
console.log(`  published specific flow     ${publishedFlow} p/s/m  (on stairs)`);
console.log(`  this model, peak on stairs  ${f2(runs.routed.peakSpecificFlow)} p/s/m`);
console.log(`  the famous claim            ${CLAIMS.egressFolk.value} ${CLAIMS.egressFolk.unit}  [${CLAIMS.egressFolk.tier}]`);

// --- the comparison the paper actually makes -------------------------------

console.log('\nRoman stair vs modern stair (the paper\'s claim, checked)');
const fC = Number(CLAIMS.specificFlowColosseum.value);
const fM = Number(CLAIMS.specificFlowModern4m.value);
console.log(`  2.8 m at ${fC} p/s/m = ${f2(2.8 * fC)} people/s`);
console.log(`  4.0 m at ${fM} p/s/m = ${f2(4.0 * fM)} people/s`);
check('a 30% narrower Roman stair carries the same flow', Math.abs(2.8 * fC - 4.0 * fM) < 0.05,
  `${f2(2.8 * fC)} vs ${f2(4.0 * fM)} p/s`);

const modern = runToCompletion(createCrowd({ n: N, seed: 12345, venue: 'modern' }));
const vC = venueOf('colosseum'), vM = venueOf('modern');
console.log('\nWhole building, same nominal exit width');
console.log(`  Colosseum   ${vC.exits.length} stairs x ${f2(vC.stairW)} m effective  ->  ${mmss(runs.routed.t100)}`);
console.log(`  Modern      ${vM.exits.length} stairs x ${f2(vM.nominalStairW)} m nominal, ${f2(vM.stairW)} m effective  ->  ${mmss(modern.t100)}`);
console.log(`  To match the Colosseum it needs ${Math.round(100 / vM.efficiency - 100)}% more TOTAL STAIR WIDTH`);
console.log(`  (both buildings are given the same ${f2(vC.exits.length * vC.stairW)} m of nominal stair; only ${Math.round(100 * vM.efficiency)}% of the modern building's carries flow)`);
console.log(`  Colosseum egress width: ${f2(vC.exits.length * vC.stairW / N * 1000)} mm per spectator; a modern code asks 7.6 mm.`);

// The 42% is imported from two published flow figures. Does the model itself
// agree? Hand the modern building that much extra nominal width and its
// clearance time should land on the Colosseum's.
{
  const c = createCrowd({ n: N, seed: 12345, venue: 'modern' });
  const scale = 1 / vM.efficiency;
  c.venue = { ...c.venue, stairW: c.venue.stairW * scale, gateW: c.venue.gateW * scale };
  c.stairCellArea = c.venue.stairW * 1.5;
  c.stairCap = Math.max(1, Math.floor(6 * c.stairCellArea));
  c.throatArea = c.venue.gateW * 3;
  c.throatCap = Math.max(1, Math.floor(6 * c.throatArea));
  const widened = runToCompletion(c);
  const delta = Math.abs(widened.t100 - runs.routed.t100);
  console.log(`  modern + ${Math.round(100 * scale - 100)}% nominal width -> ${mmss(widened.t100)} (Colosseum ${mmss(runs.routed.t100)})`);
  check('the width penalty the literature implies is the one the model measures', delta <= 15,
    `${Math.round(delta)}s apart`);
}

// Capacity is not the whole clearance time, which is why the two buildings sit
// only 6% apart on the clock while differing 30% in working width.
{
  const PEAK = 1.1;
  const floorC = N / (vC.exits.length * vC.stairW * PEAK);
  const floorM = N / (vM.exits.length * vM.stairW * PEAK);
  console.log(`  queueing is ${Math.round(100 * floorC / runs.routed.t100)}% of the Colosseum run, ` +
    `${Math.round(100 * floorM / modern.t100)}% of the modern one - the rest is walking and descending, ` +
    `which stair width does not touch.`);
}

// --- the cache-busting version has to agree everywhere ---------------------
//
// Module specifiers must be literal strings, so the build version is repeated
// across every file. That is exactly the kind of manual step that goes wrong -
// it already has once - so it is checked rather than trusted.
console.log('\nBuild version');
{
  const files = ['index.html', ...readdirSync('src').map((f) => `src/${f}`)];
  const found = new Map();
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\?v=([a-z0-9]+)/g)) {
      found.set(m[1], [...(found.get(m[1]) ?? []), f]);
    }
  }
  const declared = readFileSync('src/ui.js', 'utf8').match(/BUILD = '([a-z0-9]+)'/)?.[1];
  const versions = [...found.keys()];
  console.log(`  BUILD = ${declared}; specifiers use ${versions.join(', ')}`);
  check('every module specifier uses one version', versions.length === 1,
    versions.length === 1 ? versions[0] : versions.map((v) => `${v}: ${found.get(v).length} file(s)`).join(' | '));
  check('specifier version matches BUILD', versions[0] === declared, `${versions[0]} vs ${declared}`);
}

console.log('\nInvariants');
for (const [mode, r] of Object.entries(runs)) {
  check(`${mode}: everyone got out`, r.evacuated === N, `${r.evacuated}/${N}`);
  const h = r.crowd.history;
  let monotone = true;
  for (let i = 1; i < h.length; i++) if (h[i].evacuated < h[i - 1].evacuated) monotone = false;
  check(`${mode}: clearance curve never goes backwards`, monotone);
  check(`${mode}: no NaN in final positions`, [...r.crowd.t].every(Number.isFinite));
}

const repeat = runToCompletion(createCrowd({ n: N, seed: 12345, mode: 'routed' }));
check('same seed reproduces the same run', repeat.t100 === runs.routed.t100, `${f2(repeat.t100)}s vs ${f2(runs.routed.t100)}s`);

const other = runToCompletion(createCrowd({ n: N, seed: 999, mode: 'routed' }));
check('a different seed gives a different run', other.t100 !== runs.routed.t100, `${f2(other.t100)}s vs ${f2(runs.routed.t100)}s`);

console.log(`\n${failures === 0 ? 'All invariants hold.' : `${failures} FAILED`}`);
console.log(`(sim wall time: routed ${f2(runs.routed.wall)}s, unrouted ${f2(runs.unrouted.wall)}s)\n`);
process.exit(failures === 0 ? 0 : 1);
