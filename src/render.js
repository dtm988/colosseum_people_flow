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
} from './geometry.js?v=b16';
import { EXIT_T } from './crowd.js?v=b16';

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
   * @param {{surface: string, structure: string, structureDim: string, ink: string, muted: string, agent: string, gate: string}} theme
   */
  constructor(canvas, theme) {
    this.canvas = canvas;
    this.theme = theme;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { alpha: false }));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    /** @type {Set<number>} */ this.exits = new Set();
    this.gateScale = 1;
    this.showHeat = false;
    /** @type {null | {type: string, wedge?: number, tier?: number, label?: string}} */
    this.highlight = null;
    this.resize();

    // The canvas is sized from its own box, and that box is not final when the
    // module first runs - a grid cell settles after layout. Without this the
    // backing store keeps a stale aspect ratio and the browser stretches it,
    // which quietly turns a 189 x 156 m ellipse into something near circular.
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(canvas);
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width * this.dpr));
    const h = Math.max(240, Math.floor(rect.height * this.dpr));
    if (w === this.w && h === this.h) return;
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
      if (axial) {
        // The four reserved arches: the imperial box, the ceremonial gate, and
        // the Porta Libitinaria. Drawn hollow, because nobody ordinary ever
        // came out of them - and a reader who notices they stay empty should
        // be able to see that is the design rather than a fault.
        g.beginPath();
        g.arc(x, y, 3.6 * this.dpr, 0, Math.PI * 2);
        g.strokeStyle = T.muted;
        g.lineWidth = 1.4 * this.dpr;
        g.stroke();
        continue;
      }
      const r = isExit ? 2.6 * Math.sqrt(this.gateScale) : 1.1;
      g.beginPath();
      g.arc(x, y, r * this.dpr, 0, Math.PI * 2);
      g.fillStyle = isExit ? T.gate : T.structureDim;
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
   * @param {Set<number>} [exits] which wedges are exits at all
   * @param {number} [gateScale] width of each opening relative to a Roman arch
   */
  setVenue(exits, gateScale) {
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
    if (this.highlight) this.drawHighlight(crowd);
  }

  /**
   * The guided tour's pointing finger. Drawn over the finished frame with
   * ordinary vector calls, so it can dim the rest of the building and outline
   * the part being talked about.
   * @param {import('./crowd.js').Crowd} crowd
   */
  drawHighlight(crowd) {
    const g = this.ctx;
    const T = this.theme;
    const D = this.dpr;
    const h = this.highlight;
    if (!h) return;

    const sector = (w, t0, t1) => {
      const half = WEDGE_ANGLE / 2;
      const a0 = wedgeAngle(w) - half;
      const a1 = wedgeAngle(w) + half;
      g.beginPath();
      for (let i = 0; i <= 12; i++) {
        const p = ellipsePoint(a0 + ((a1 - a0) * i) / 12, t0);
        const [x, y] = this.px(p.x, p.y);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      for (let i = 12; i >= 0; i--) {
        const p = ellipsePoint(a0 + ((a1 - a0) * i) / 12, t1);
        g.lineTo(...this.px(p.x, p.y));
      }
      g.closePath();
    };

    const band = (t0, t1) => {
      g.beginPath();
      for (let i = 0; i <= 240; i++) {
        const p = ellipsePoint((i / 240) * Math.PI * 2, t1);
        const [x, y] = this.px(p.x, p.y);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      for (let i = 240; i >= 0; i--) {
        const p = ellipsePoint((i / 240) * Math.PI * 2, t0);
        g.lineTo(...this.px(p.x, p.y));
      }
      g.closePath();
    };

    g.save();

    if (h.type === 'wedge' && h.wedge != null) {
      // Dim everything, then punch the wedge back through.
      g.fillStyle = 'rgba(13,11,9,0.72)';
      g.fillRect(0, 0, this.w, this.h);
      g.globalCompositeOperation = 'destination-out';
      sector(h.wedge, 0, WORLD_R);
      g.fill();
      g.globalCompositeOperation = 'source-over';
      sector(h.wedge, 0, 1);
      g.strokeStyle = T.gate;
      g.lineWidth = 1.5 * D;
      g.stroke();
    } else if (h.type === 'tier' && h.tier != null) {
      const tier = TIERS[h.tier];
      g.fillStyle = 'rgba(13,11,9,0.7)';
      g.fillRect(0, 0, this.w, this.h);
      g.globalCompositeOperation = 'destination-out';
      band(tier.t0, tier.t1);
      g.fill();
      g.globalCompositeOperation = 'source-over';
      band(tier.t0, tier.t1);
      g.strokeStyle = T.gate;
      g.lineWidth = 1.5 * D;
      g.stroke();
    } else if (h.type === 'exits') {
      for (const w of crowd.venue.exits) {
        const p = ellipsePoint(wedgeAngle(w), 1);
        const [x, y] = this.px(p.x, p.y);
        g.beginPath();
        g.arc(x, y, 9 * D * Math.sqrt(this.gateScale), 0, Math.PI * 2);
        g.strokeStyle = T.gate;
        g.lineWidth = 1.5 * D;
        g.stroke();
      }
    } else if (h.type === 'arena') {
      // The arena is already the darkest thing on screen, so dimming around it
      // would just make a black hole. Outline it instead.
      g.beginPath();
      for (let i = 0; i <= 240; i++) {
        const p = ellipsePoint((i / 240) * Math.PI * 2, 0);
        const [x, y] = this.px(p.x, p.y);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
      g.strokeStyle = T.gate;
      g.lineWidth = 2 * D;
      g.stroke();

      g.font = `${12 * D}px system-ui, -apple-system, sans-serif`;
      g.fillStyle = T.gate;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('the arena — 87 × 55 m', this.cx, this.cy);
    }

    g.restore();
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
