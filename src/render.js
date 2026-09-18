// @ts-check
/**
 * The plan view. Canvas only - it reads simulation state and draws it, and
 * never changes it.
 *
 * The static geometry is drawn once into an offscreen buffer and the agents
 * are written as raw pixels into a copy of it each frame. Fifty thousand
 * fillRect calls per frame would not survive; one typed-array copy plus fifty
 * thousand pixel writes will.
 */

import {
  OUTER, ARENA, WEDGES, WEDGE_ANGLE, TIERS, AXIAL_WEDGES, isAxial,
  ellipsePoint, wedgeAngle,
} from './geometry.js';
import { EXIT_T } from './crowd.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
/** @param {number} n */
function roman(n) {
  const M = ['', 'X', 'XX', 'XXX', 'XL', 'L', 'LX', 'LXX', 'LXXX'];
  return M[Math.floor(n / 10)] + ROMAN[n % 10];
}

const WORLD_R = 1.14; // a little past the wall, so exiting agents stay visible

/**
 * Trig lookup for the agent pass. Fifty thousand people times sixty frames is
 * three million sine calls a second; a 4096-entry table is exact enough to
 * place a two-pixel dot and costs nothing.
 */
const TRIG_N = 4096;
const COS = new Float32Array(TRIG_N);
const SIN = new Float32Array(TRIG_N);
for (let i = 0; i < TRIG_N; i++) {
  const a = (i / TRIG_N) * Math.PI * 2;
  COS[i] = Math.cos(a);
  SIN[i] = Math.sin(a);
}
const TRIG_SCALE = TRIG_N / (Math.PI * 2);

export class PlanView {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{surface: string, structure: string, structureDim: string, ink: string, muted: string, agent: string, gate: string, gateShut: string}} theme
   */
  constructor(canvas, theme) {
    this.canvas = canvas;
    this.theme = theme;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { alpha: false }));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    /** @type {Set<number>} */ this.closed = new Set();
    /** @type {Set<number>} */ this.exits = new Set();
    this.gateScale = 1;
    this.showHeat = false;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width * this.dpr));
    const h = Math.max(240, Math.floor(rect.height * this.dpr));
    this.canvas.width = w;
    this.canvas.height = h;
    this.w = w;
    this.h = h;

    // Fit the whole ellipse with room for labels.
    const pad = 14 * this.dpr;
    this.scale = Math.min((w - pad * 2) / (OUTER.a * 2 * WORLD_R), (h - pad * 2) / (OUTER.b * 2 * WORLD_R));
    this.cx = w / 2;
    this.cy = h / 2;

    this.buildStatic();
  }

  /** World metres to device pixels. */
  px(x, y) {
    return [this.cx + x * this.scale, this.cy + y * this.scale];
  }

  /** Draw the building once; everything after this is a memcpy. */
  buildStatic() {
    const off = document.createElement('canvas');
    off.width = this.w;
    off.height = this.h;
    const g = /** @type {CanvasRenderingContext2D} */ (off.getContext('2d'));
    const T = this.theme;

    g.fillStyle = T.surface;
    g.fillRect(0, 0, this.w, this.h);

    const ring = (t, style, width) => {
      g.beginPath();
      for (let i = 0; i <= 240; i++) {
        const p = ellipsePoint((i / 240) * Math.PI * 2, t);
        const [x, y] = this.px(p.x, p.y);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
      g.strokeStyle = style;
      g.lineWidth = width * this.dpr;
      g.stroke();
    };

    // Arena floor - the one part of the plan that is not seating.
    g.beginPath();
    for (let i = 0; i <= 240; i++) {
      const p = ellipsePoint((i / 240) * Math.PI * 2, 0);
      const [x, y] = this.px(p.x, p.y);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.fillStyle = T.structureDim;
    g.fill();

    // Tier boundaries, faint - the drill-in panel carries the detail.
    for (const tier of TIERS) ring(tier.t1, T.structureDim, 1);
    ring(0, T.structure, 1.5);
    ring(1, T.structure, 2);

    // Radial wedge walls. 80 of them: the repeated unit cell.
    for (let w = 0; w < WEDGES; w++) {
      const th = wedgeAngle(w) - WEDGE_ANGLE / 2;
      const a = ellipsePoint(th, 0);
      const b = ellipsePoint(th, 1);
      g.beginPath();
      g.moveTo(...this.px(a.x, a.y));
      g.lineTo(...this.px(b.x, b.y));
      g.strokeStyle = T.structureDim;
      g.lineWidth = 1 * this.dpr;
      g.stroke();
    }

    // Gates. Marker area tracks the width of the opening, so a building with
    // a few grand exits looks like one.
    for (let w = 0; w < WEDGES; w++) {
      const p = ellipsePoint(wedgeAngle(w), 1);
      const [x, y] = this.px(p.x, p.y);
      const axial = isAxial(w);
      const isExit = this.exits.size === 0 ? !axial : this.exits.has(w);
      const shut = this.closed.has(w);
      let r = 1.1;
      let fill = T.structureDim;
      if (isExit) { r = 2.6 * Math.sqrt(this.gateScale); fill = shut ? T.gateShut : T.gate; }
      else if (axial) { r = 3.0; fill = T.muted; }
      g.beginPath();
      g.arc(x, y, r * this.dpr, 0, Math.PI * 2);
      g.fillStyle = fill;
      g.fill();
    }

    // A few numerals, so the numbering is visible without 80 labels of clutter.
    g.fillStyle = T.muted;
    g.font = `${10 * this.dpr}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let w = 0; w < WEDGES; w += 10) {
      const p = ellipsePoint(wedgeAngle(w), WORLD_R - 0.06);
      const [x, y] = this.px(p.x, p.y);
      g.fillText(roman(w + 1), x, y);
    }

    this.staticCanvas = off;
    this.staticData = g.getImageData(0, 0, this.w, this.h);
    this.frame = this.ctx.createImageData(this.w, this.h);
    this.counts = new Uint16Array(this.w * this.h);
    this.touched = new Int32Array(this.w * this.h); // pixels to clear next frame

  }

  /**
   * @param {Set<number>} closed
   * @param {Set<number>} [exits] which wedges are exits at all
   * @param {number} [gateScale] width of each opening relative to a Roman arch
   */
  setClosedGates(closed, exits, gateScale) {
    this.closed = closed;
    if (exits) this.exits = exits;
    if (gateScale) this.gateScale = gateScale;
    this.buildStatic();
  }

  /**
   * @param {import('./crowd.js').Crowd} crowd
   */
  draw(crowd) {
    const data = this.frame.data;
    data.set(this.staticData.data);

    const counts = this.counts;
    const touched = this.touched;
    let nTouched = 0;

    const { theta, t, phase, n } = crowd;
    const scale = this.scale;
    const cx = this.cx;
    const cy = this.cy;
    const W = this.w;
    const H = this.h;

    // Spread people across the real width of a stairway rather than stacking
    // them on its centre line. Deterministic per person, so frames are stable.
    const jitter = (k) => (((Math.imul(k, 2654435761) >>> 8) & 1023) / 1023 - 0.5);

    for (let k = 0; k < n; k++) {
      if (phase[k] === 2) continue;
      const tt = t[k];
      const th = theta[k] + jitter(k) * WEDGE_ANGLE * (phase[k] === 1 ? 0.22 : 0.9);

      const a = ARENA.a + (OUTER.a - ARENA.a) * tt;
      const b = ARENA.b + (OUTER.b - ARENA.b) * tt;
      const ti = (th * TRIG_SCALE) & (TRIG_N - 1);
      const x = cx + a * COS[ti] * scale;
      const y = cy + b * SIN[ti] * scale;

      const ix = x | 0;
      const iy = y | 0;
      if (ix < 1 || iy < 1 || ix >= W - 1 || iy >= H - 1) continue;

      // Accumulate rather than paint. Fifty thousand opaque dots render as a
      // sheet of white and hide both the building and the thing worth seeing;
      // counting arrivals per pixel and shading by the count turns the crowd
      // into a density field, where a queue is visibly a queue.
      const p = iy * W + ix;
      if (counts[p] === 0) touched[nTouched++] = p;
      counts[p]++;
    }

    // One hue, dim to bright, with magnitude on a compressed scale so a single
    // person is still visible and a jam still reads as a jam.
    const [ar, ag, ab] = hexToRgb(this.theme.agent);
    for (let i = 0; i < nTouched; i++) {
      const p = touched[i];
      const c = counts[p];
      counts[p] = 0;
      const k = Math.min(1, 0.56 + 0.44 * (Math.log(1 + c) / Math.log(6)));
      const o = p * 4;
      data[o] = ar * k;
      data[o + 1] = ag * k;
      data[o + 2] = ab * k;
      data[o + 3] = 255;
    }

    this.ctx.putImageData(this.frame, 0, 0);
  }

  /**
   * Which wedge a click landed in, or -1.
   * @param {number} clientX @param {number} clientY
   */
  wedgeAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) * this.dpr - this.cx) / this.scale;
    const y = ((clientY - rect.top) * this.dpr - this.cy) / this.scale;
    const norm = (x / OUTER.a) ** 2 + (y / OUTER.b) ** 2;
    if (norm > WORLD_R * WORLD_R) return -1;
    const th = Math.atan2(y, x);
    const w = Math.round(th / WEDGE_ANGLE);
    return ((w % WEDGES) + WEDGES) % WEDGES;
  }
}

/** @param {string} hex */
function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
