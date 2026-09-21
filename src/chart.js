// @ts-check
/**
 * The two charts. Canvas, no library - one line chart and one bar strip did
 * not justify a dependency, and hand-drawing them keeps the type and spacing
 * identical to the plan view beside them.
 *
 * Both are single-axis. Both keep grid and axes recessive and let the marks
 * carry the meaning.
 */

import { WEDGES, isAxial } from './geometry.js?v=b22';

const FONT = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = '11px ui-monospace, SFMono-Regular, Menlo, monospace';

/** @param {number} s */
export function mmss(s) {
  if (!Number.isFinite(s)) return '—';
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

class Base {
  /** @param {HTMLCanvasElement} canvas @param {any} theme */
  constructor(canvas, theme) {
    this.canvas = canvas;
    this.theme = theme;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.resize();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(200, Math.floor(r.width * this.dpr));
    this.h = Math.max(100, Math.floor(r.height * this.dpr));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }
  clear() {
    const g = this.ctx;
    g.fillStyle = this.theme.surface;
    g.fillRect(0, 0, this.w, this.h);
  }
}

/**
 * Percent cleared against time. Up to two runs are held at once so a routed
 * and an unrouted run can be compared after the fact - the comparison is the
 * argument, so it must not vanish when the second run starts.
 */
export class ClearanceChart extends Base {
  constructor(canvas, theme) {
    super(canvas, theme);
    /**
     * Each run carries its own crowd size. A single shared `n` meant a
     * retained run was rescaled by whatever the *next* run's crowd size was -
     * run 50,000, keep the curve, drop the slider to 10,000, and the old line
     * plotted to 500% and shot off the top of the chart.
     * @type {Record<string, {history: {time:number, evacuated:number}[], n: number, color: string, dash: boolean}>}
     */
    this.runs = {};
  }

  /**
   * @param {string} key
   * @param {{time:number,evacuated:number}[]} history
   * @param {number} n
   * @param {string} color
   * @param {boolean} [dash] secondary encoding, so two runs in one building are distinguishable
   */
  setRun(key, history, n, color, dash = false) {
    this.runs[key] = { history, n, color, dash };
  }

  clearRuns() { this.runs = {}; }

  draw() {
    const g = this.ctx;
    const T = this.theme;
    const D = this.dpr;
    this.clear();

    const padL = 34 * D, padR = 12 * D, padT = 10 * D, padB = 20 * D;
    const plotW = this.w - padL - padR;
    const plotH = this.h - padT - padB;

    let maxT = 60;
    for (const r of Object.values(this.runs)) {
      const last = r.history[r.history.length - 1];
      if (last) maxT = Math.max(maxT, last.time);
    }
    maxT = Math.ceil(maxT / 300) * 300;

    const X = (t) => padL + (t / maxT) * plotW;
    const Y = (frac) => padT + (1 - frac) * plotH;

    // Grid: hairlines, recessive.
    g.strokeStyle = T.grid;
    g.lineWidth = 1 * D;
    g.font = FONT;
    g.fillStyle = T.muted;
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      const y = Y(frac);
      g.beginPath();
      g.moveTo(padL, y);
      g.lineTo(padL + plotW, y);
      g.stroke();
      g.fillText(`${Math.round(frac * 100)}%`, padL - 6 * D, y);
    }
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (let t = 0; t <= maxT; t += 300) {
      g.fillText(mmss(t), X(t), padT + plotH + 5 * D);
    }

    // Series.
    for (const [key, run] of Object.entries(this.runs)) {
      const hist = run.history;
      if (!hist.length) continue;
      g.beginPath();
      g.moveTo(X(0), Y(0));
      for (const h of hist) g.lineTo(X(h.time), Y(h.evacuated / run.n));
      g.strokeStyle = run.color;
      g.lineWidth = 2 * D;
      g.lineJoin = 'round';
      g.setLineDash(run.dash ? [5 * D, 4 * D] : []);
      g.stroke();
      g.setLineDash([]);

      // Direct label at the head of the line - identity without a hunt.
      const last = hist[hist.length - 1];
      const lx = X(last.time), ly = Y(last.evacuated / run.n);
      g.fillStyle = run.color;
      g.beginPath();
      g.arc(lx, ly, 3 * D, 0, Math.PI * 2);
      g.fill();
      g.font = FONT;
      g.fillStyle = T.ink;
      g.textAlign = lx > this.w * 0.75 ? 'right' : 'left';
      g.textBaseline = 'bottom';
      g.fillText(key, lx + (lx > this.w * 0.75 ? -6 * D : 6 * D), ly - 5 * D);
    }
  }
}

/**
 * One bar per gate, all eighty.
 *
 * This is the view that makes "no cross-shard traffic" a shape rather than a
 * claim: eighty near-identical bars when every wedge drains through its own
 * stair, a few towers and a lot of idle lanes when it does not.
 */
export class GateStrip extends Base {
  constructor(canvas, theme) {
    super(canvas, theme);
    this.counts = new Uint32Array(WEDGES);
    this.color = '#888';
    this.exitCount = WEDGES - 4;
  }

  /** @param {Uint32Array} counts @param {string} color @param {number} exitCount how many gates this building has */
  set(counts, color, exitCount) {
    this.counts = counts;
    this.color = color;
    this.exitCount = exitCount;
  }

  draw() {
    const g = this.ctx;
    const T = this.theme;
    const D = this.dpr;
    this.clear();

    const padL = 8 * D, padR = 8 * D, padT = 8 * D, padB = 16 * D;
    const plotW = this.w - padL - padR;
    const plotH = this.h - padT - padB;
    const slot = plotW / WEDGES;
    const barW = Math.max(1.5 * D, slot - 2 * D); // 2px surface gap between bars

    let max = 1;
    for (const c of this.counts) if (c > max) max = c;

    // Baseline.
    g.strokeStyle = T.axis;
    g.lineWidth = 1 * D;
    g.beginPath();
    g.moveTo(padL, padT + plotH + 0.5);
    g.lineTo(padL + plotW, padT + plotH + 0.5);
    g.stroke();

    // Averaged over the gates this building actually has, not over all 76
    // public arches - in a building with eight exits the latter puts the mean
    // line on the floor and it stops meaning anything.
    let total = 0;
    for (let w = 0; w < WEDGES; w++) total += this.counts[w];
    const mean = total / Math.max(1, this.exitCount);

    for (let w = 0; w < WEDGES; w++) {
      const v = this.counts[w];
      const x = padL + w * slot + (slot - barW) / 2;
      const hgt = (v / max) * plotH;
      const y = padT + plotH - hgt;

      g.fillStyle = isAxial(w) ? T.structureDim : this.color;
      if (hgt < 1) {
        g.fillRect(x, padT + plotH - 1 * D, barW, 1 * D);
      } else {
        // 4px rounded data-end, square foot on the baseline.
        const r = Math.min(2 * D, barW / 2, hgt);
        g.beginPath();
        g.moveTo(x, padT + plotH);
        g.lineTo(x, y + r);
        g.quadraticCurveTo(x, y, x + r, y);
        g.lineTo(x + barW - r, y);
        g.quadraticCurveTo(x + barW, y, x + barW, y + r);
        g.lineTo(x + barW, padT + plotH);
        g.closePath();
        g.fill();
      }
    }

    // Mean line: the reference that makes imbalance legible.
    if (mean > 0) {
      const my = padT + plotH - (mean / max) * plotH;
      g.strokeStyle = T.muted;
      g.lineWidth = 1 * D;
      g.setLineDash([3 * D, 3 * D]);
      g.beginPath();
      g.moveTo(padL, my);
      g.lineTo(padL + plotW, my);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = T.muted;
      g.font = MONO;
      g.textAlign = 'left';
      g.textBaseline = 'bottom';
      g.fillText('mean', padL + 2 * D, my - 2 * D);
    }

    g.fillStyle = T.muted;
    g.font = FONT;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText('gate I', padL, padT + plotH + 3 * D);
    g.textAlign = 'right';
    g.fillText('gate LXXX', padL + plotW, padT + plotH + 3 * D);
  }
}
