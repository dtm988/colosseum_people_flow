// @ts-check
/**
 * The guided tour.
 *
 * A simulation that a stranger cannot read is a screensaver. Each step here
 * sets the model up, points at one part of the building, and says what is about
 * to happen - so the argument arrives in the order it can be understood, and
 * the visitor watches it happen rather than being told the conclusion.
 *
 * Steps drive the same controls a visitor can drive themselves. There is no
 * scripted animation anywhere: everything on screen is the model running.
 */

/**
 * @typedef {Object} TourApi
 * @property {(v: 'colosseum'|'modern') => void} setVenue
 * @property {(m: 'routed'|'unrouted') => void} setMode
 * @property {() => void} reset
 * @property {(on: boolean) => void} run
 * @property {(x: number) => void} setSpeed
 * @property {(h: any) => void} highlight
 * @property {(open: boolean) => void} claims
 */

/**
 * @typedef {Object} Step
 * @property {string} title
 * @property {string} body
 * @property {string} [watch] what to look for while it runs
 * @property {(api: TourApi) => void} setup
 */

/** @type {Step[]} */
export const STEPS = [
  {
    title: 'A building for fifty thousand people',
    body: `This is the Flavian Amphitheatre from above — the Colosseum. The dark oval in the
           middle is the arena floor, about 87 by 55 metres. Everything around it is seating,
           rising as it recedes, with room for roughly 50,000 spectators.
           <br><br>The question this tool answers is a simple one that turns out not to be:
           <em>how did they all get out?</em>`,
    setup: (api) => {
      api.setVenue('colosseum');
      api.setMode('routed');
      api.reset();
      api.run(false);
      api.highlight({ type: 'arena' });
    },
  },
  {
    title: 'One shape, eighty times',
    body: `The building is a single unit repeated eighty times. Each wedge has its own block of
           seats, its own stairway, and its own arch onto the street.
           <br><br>Four of the eighty were reserved — the imperial box, the ceremonial gate, and
           the Porta Libitinaria, by which the dead left. That leaves <b>76 public arches</b>,
           and the Roman numerals identifying them are still carved above the surviving ones.
           <br><br>You can pick the reserved four out on the plan: they are the <b>hollow
           rings</b> at the compass points, numbered I, XXI, XLI and LXI. Watch them during the
           egress and nobody comes out of them at all. That is not the model failing — no
           ordinary spectator ever used those arches, and every capacity figure in this tool
           divides the crowd across the other seventy-six.`,
    setup: (api) => {
      api.reset();
      api.run(false);
      api.highlight({ type: 'wedge', wedge: 8 });
    },
  },
  {
    title: 'Rank decided where you sat — and which arch you left by',
    body: `Seating was stratified precisely. Senators and the Vestals sat at the arena's edge;
           knights above them; citizens above that; and at the very top a wooden gallery of
           standing room for the poor, for slaves, and for women.
           <br><br>And your place was not chosen on the day. It was <b>assigned</b> — rank fixed
           your tier, and your tier and block fixed which of the seventy-six arches you came in
           by and went out through. You did not pick an exit on the way out; the building had
           already picked it.
           <br><br><em>How firmly do we know that?</em> Guidebooks describe numbered tokens
           naming gate, tier, row and seat, and the evidence for those is thinner than they let
           on. The architecture is not in doubt though: the numerals are carved above the arches,
           and restoration found the original red paint still on them. Chit or no chit, the
           building told you where to go.
           <br><br>One more thing a plan view hides. The seating rises with the outer wall, so
           the cheapest seats were also <b>forty metres up</b>. Rank set your tier, tier set your
           height, and height was most of the journey home.`,
    setup: (api) => {
      api.reset();
      api.run(false);
      api.highlight({ type: 'tier', tier: 4 });
    },
  },
  {
    title: 'Now let them out',
    body: `Fifty thousand people, each choosing an exit and walking to it. Nothing here is
           animation — it is a model running, with walking speed taken from published
           measurements of how fast crowds actually move as they get denser.`,
    watch: 'Watch eighty separate queues form, one down each stairway.',
    setup: (api) => {
      api.reset();
      api.highlight(null);
      api.setSpeed(30);
      api.run(true);
    },
  },
  {
    title: 'Eighty queues that never meet',
    body: `That is the whole trick. Your route from seat to street stays inside your own wedge,
           so it never joins anyone else's until you are outside the building. There is no
           corridor where flows merge, because there is no corridor.
           <br><br>Look at the bar chart below: eighty near-identical bars. Every stairway is
           doing the same amount of work as every other one.
           <br><br>So what did that assignment from the last step actually buy? Not speed.
           Let people choose freely instead and the median spectator gets out
           <em>sooner</em> — but the last few leave later. Assignment does not improve the
           median. It improves the tail.`,
    watch: 'The busiest gate handles about 1.1× the average. Nothing is a bottleneck.',
    setup: (api) => {
      api.highlight({ type: 'exits' });
      api.run(true);
    },
  },
  {
    title: 'The same crowd, in a modern arena',
    body: `Now the comparison. Same 50,000 people, same seats, and — this matters — the
           <b>same total width of doorway</b>. The only change is that it is gathered into eight
           grand exits instead of spread across seventy-six small ones.
           <br><br>Three quarters of the perimeter is now wall.`,
    watch: 'Watch where people go, and how quickly the building stops looking evenly emptied.',
    setup: (api) => {
      api.setVenue('modern');
      api.reset();
      api.highlight(null);
      api.setSpeed(30);
      api.run(true);
    },
  },
  {
    title: 'Everyone converges',
    body: `Eight thick rivers instead of eighty thin ones. People now walk around the bowl to
           reach an exit, and the streams merge before they get there — which is exactly what a
           concourse does in a real stadium.
           <br><br>The bar chart is the same story: eight towers and seventy-two empty lanes.`,
    watch: 'The queues are visibly denser than the Roman ones, at the same moment in the run.',
    setup: (api) => {
      api.highlight({ type: 'exits' });
      api.run(true);
    },
  },
  {
    title: 'What it costs — and this is measured, not assumed',
    body: `A published study simulated both an ancient and a modern arena and measured how much
           flow each stair actually carries. The Colosseum came out at <b>1.14 people per second
           per metre</b>; the modern arena at <b>0.80</b> on a wider stair.
           <br><br>So 2.8 m of Roman stair carries 3.19 people a second, and 4.0 m of modern
           stair carries 3.20. <b>A stair thirty percent narrower does the same work.</b>
           Merging, turning, retail, and the general furniture of a commercial arena mean only
           about 70% of a modern opening carries flow at all.
           <br><br>Across a whole building that compounds. Turn it round and it is the claim
           this tool exists to make: <b>the Colosseum empties as fast as a modern arena on about
           thirty percent less total stair width</b> — and the reason is everything you watched in the
           first half, that no two routes share a corridor, so every metre of stair runs at
           close to its theoretical maximum.`,
    setup: (api) => {
      api.highlight(null);
      api.run(false);
    },
  },
  {
    title: 'The famous claim, and what we actually found',
    body: `You have probably read that the Colosseum emptied in fifteen minutes and that modern
           stadiums cannot match it. We went looking for the source of that figure and there
           isn't one — it is repeated everywhere, also as five minutes and as ten, with no study
           behind any version.
           <br><br>What is true is stranger and better. The Colosseum gets by on about
           <b>4.3 mm of working stair per spectator</b> where a modern building code asks for
           7.6 mm. It would fail a contemporary egress code, and it clears the building anyway —
           because every metre it has runs at nearly its theoretical maximum.
           <br><br>Open the drawer at the right to see every figure in this tool with its
           evidence: attested, inferred, contested, or — for that fifteen minutes — unsourced.`,
    setup: (api) => {
      api.setVenue('colosseum');
      api.reset();
      api.highlight(null);
      api.run(false);
      api.claims(true);
    },
  },
];

export class Tour {
  /**
   * @param {HTMLElement} el
   * @param {TourApi} api
   */
  constructor(el, api) {
    this.el = el;
    this.api = api;
    this.i = -1;

    // The card is built ONCE and its text swapped per step.
    //
    // It used to rebuild its own innerHTML on every render, which destroys and
    // recreates the buttons. A button that is replaced between mousedown and
    // mouseup never fires a click at all - so the control looked present and
    // did nothing, while a synthetic click in a console worked fine. Keeping
    // the nodes alive makes that impossible by construction.
    el.innerHTML = `
      <div class="tour-head">
        <span class="tour-count"></span>
        <button class="tour-skip" data-tour="stop">Skip tour</button>
      </div>
      <h2></h2>
      <div class="tour-body"></div>
      <p class="tour-watch" hidden></p>
      <div class="tour-nav">
        <button data-tour="prev">Back</button>
        <button class="primary" data-tour="next">Next</button>
      </div>`;

    this.$count = /** @type {HTMLElement} */ (el.querySelector('.tour-count'));
    this.$title = /** @type {HTMLElement} */ (el.querySelector('h2'));
    this.$body = /** @type {HTMLElement} */ (el.querySelector('.tour-body'));
    this.$watch = /** @type {HTMLElement} */ (el.querySelector('.tour-watch'));
    this.$prev = /** @type {HTMLButtonElement} */ (el.querySelector('[data-tour="prev"]'));
    this.$next = /** @type {HTMLButtonElement} */ (el.querySelector('[data-tour="next"]'));

    // Bound directly to nodes that now outlive every step, so navigation does
    // not depend on event delegation reaching a moving target.
    this.$next.addEventListener('click', () => this.next());
    this.$prev.addEventListener('click', () => this.prev());
    /** @type {HTMLElement} */ (el.querySelector('[data-tour="stop"]')).addEventListener('click', () => this.stop());

    el.hidden = true;
  }

  get active() { return this.i >= 0; }

  start() { this.go(0); }

  stop() {
    this.i = -1;
    this.api.highlight(null);
    this.el.hidden = true;
  }

  next() { this.i + 1 < STEPS.length ? this.go(this.i + 1) : this.stop(); }
  prev() { if (this.i > 0) this.go(this.i - 1); }

  /** @param {number} i */
  go(i) {
    if (i === this.i) return;
    this.i = i;
    const s = STEPS[i];
    s.setup(this.api);
    this.render();
  }

  render() {
    const s = STEPS[this.i];
    if (!s) return;
    this.el.hidden = false;
    this.$count.textContent = `${this.i + 1} / ${STEPS.length}`;
    this.$title.textContent = s.title;
    this.$body.innerHTML = s.body;
    this.$watch.hidden = !s.watch;
    if (s.watch) this.$watch.textContent = s.watch;
    this.$prev.disabled = this.i === 0;
    this.$next.textContent = this.i === STEPS.length - 1 ? 'Explore it yourself' : 'Next';
  }
}
