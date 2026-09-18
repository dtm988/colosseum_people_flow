// @ts-check
/**
 * Every number this tool displays lives here, with the evidence tier behind it.
 *
 * Nothing renders a figure without going through `format()`, so presenting a
 * contested claim as settled fact is structurally impossible rather than a
 * discipline someone has to remember. This file is the reason the water
 * simulation was cut: its channel topology had no tier to put it in.
 *
 * Tiers:
 *   attested  - physical/archaeological evidence, or an unambiguous ancient source
 *   inferred  - scholarly estimate from evidence; ranges shown, not hidden
 *   contested - specialists actively disagree
 *   unsourced - widely repeated, no traceable origin
 *   modeled   - this tool's own output, not a historical claim
 */

/**
 * @typedef {'attested'|'inferred'|'contested'|'unsourced'|'modeled'} Tier
 * @typedef {Object} Claim
 * @property {number|string} value
 * @property {string} [unit]
 * @property {Tier} tier
 * @property {string} note
 * @property {string} src
 */

/** @type {Record<string, Claim>} */
export const CLAIMS = {
  // ---- structure -------------------------------------------------------
  outerLength: {
    value: 189, unit: 'm', tier: 'attested',
    note: 'Overall footprint 189 x 156 m; outer wall 48 m; perimeter 545 m.',
    src: 'Wikipedia, Colosseum',
  },
  outerWidth: {
    value: 156, unit: 'm', tier: 'attested',
    note: 'Overall footprint 189 x 156 m.',
    src: 'Wikipedia, Colosseum',
  },
  arenaLength: {
    value: 87, unit: 'm', tier: 'inferred',
    note: 'Sources differ: 87 x 55 m (Wikipedia), 86 x 54 m (Encyclopaedia Romana), 80 x 45 m (Crapper).',
    src: 'multiple',
  },
  arenaWidth: {
    value: 55, unit: 'm', tier: 'inferred',
    note: 'Sources differ: 87 x 55 m, 86 x 54 m, 80 x 45 m.',
    src: 'multiple',
  },
  arches: {
    value: 80, unit: 'ground-level arches', tier: 'attested',
    note: '80 arches at ground level, each 4.2 m wide and 7.05 m tall.',
    src: 'Wikipedia; Brewminate',
  },
  publicGates: {
    value: 76, tier: 'attested',
    note: '76 of the 80 arches served ordinary spectators. The four axial entrances were reserved for the Emperor and elite.',
    src: 'Wikipedia, Colosseum',
  },
  numerals: {
    value: 'XXIII-LIIII', tier: 'attested',
    note: 'Surviving carved entrance numerals. Restoration also recovered the original red paint - iron oxide and clay, roughly 13 in tall.',
    src: 'Wikipedia; Smithsonian',
  },
  prefabricated: {
    value: 'standardised parts', tier: 'inferred',
    note: 'Interchangeable stairs and seats built in workshops and brought to site - the same modularity that speeds egress also sped construction.',
    src: 'Brewminate',
  },

  // ---- people ----------------------------------------------------------
  capacity: {
    value: 50000, unit: 'spectators', tier: 'inferred',
    note: 'Modern estimate ~50,000. The Codex-Calendar of 354 claims 87,000; an average audience of ~65,000 is also cited.',
    src: 'Wikipedia, Colosseum',
  },
  tesserae: {
    value: 'gate, tier, wedge, row', tier: 'contested',
    note: 'Tourism sources describe numbered tokens in confident detail. What is directly evidenced is the numbering on the gates themselves - so the routing argument rests on the architecture, not the tokens.',
    src: 'disputed',
  },

  // ---- egress ----------------------------------------------------------
  egressFolk: {
    value: 15, unit: 'min', tier: 'unsourced',
    note: 'The famous figure. Repeated everywhere - also as 5 minutes and as 10 - with no traceable originating study, engineer, or calculation behind any version.',
    src: 'no origin found',
  },
  egressPublished: {
    value: 764, unit: 's', tier: 'inferred',
    note: 'Last person out at 12 min 44 s in a peer-reviewed evacuation simulation comparing the Colosseum with a modern stadium.',
    src: 'Fire (MDPI) 2022',
  },
  specificFlowColosseum: {
    value: 1.14, unit: 'person/s/m', tier: 'inferred',
    note: 'Modelled specific flow in the Colosseum, against 0.65-0.8 for the modern comparison - on stairs 2.8 m wide versus 4.0 m.',
    src: 'Fire (MDPI) 2022',
  },
  specificFlowModern: {
    value: 0.65, unit: 'person/s/m', tier: 'inferred',
    note: 'Modern stadium (Gazprom Arena) at 2.6 m march width; 0.8 at 4 m. Density accumulates there while it falls in the Colosseum.',
    src: 'Fire (MDPI) 2022',
  },
  freeSpeed: {
    value: 1.3, unit: 'm/s', tier: 'attested',
    note: 'Free walking speed below ~0.2 p/m^2. From roughly 35,000 counts across 100 series of observations.',
    src: 'Kholshevnikov & Samoshin',
  },
  jamSpeed: {
    value: 0.27, unit: 'm/s', tier: 'attested',
    note: 'Speed at 4.5 p/m^2. Stagnation sets in around 4 p/m^2; some movement remains possible even at 7.4 p/m^2.',
    src: 'Kholshevnikov & Samoshin',
  },

  // ---- water (epilogue card only - no simulation) -----------------------
  floodVolume: {
    value: 5600, unit: 'm^3', tier: 'inferred',
    note: 'Arena area x 1.5 m depth. Crapper computes 4,241 m^3 using 80 x 45 m dimensions.',
    src: 'Crapper via Encyclopaedia Romana',
  },
  aqueductFlow: {
    value: 1.06, unit: 'm^3/s', tier: 'inferred',
    note: 'Aqua Claudia ran 2.12 m^3/s at source, about half that at the Caelian distribution point - and perhaps 0.84 delivered, given what Frontinus says about water theft.',
    src: 'Crapper via Encyclopaedia Romana',
  },
  drainRate: {
    value: 0.75, unit: 'm^3/s', tier: 'inferred',
    note: 'Hypogeal channel capacity during heavy rainfall. Drain time after a flooding is not established anywhere in the literature; at this rate it would take about two hours.',
    src: 'Encyclopaedia Romana',
  },
  naumachiaWindow: {
    value: '80-85 AD', tier: 'inferred',
    note: 'Cassius Dio has Titus fill "this same theatre" with water; Suetonius has Domitian do it too. Then Domitian built the hypogeum, and no naumachia is recorded afterwards.',
    src: 'Encyclopaedia Romana; Bad Ancient',
  },
  floodTopology: {
    value: 'unknown', tier: 'contested',
    note: 'Where the water entered, how it was distributed, how it drained. No archaeological evidence survives for the link from the Caelian, and no pipes have been found inside the building. This is why the water act was cut rather than animated.',
    src: 'Encyclopaedia Romana; Science Friday',
  },
};

/** Human-readable labels for each tier, for chips and legends. */
export const TIER_LABEL = {
  attested: 'attested',
  inferred: 'inferred',
  contested: 'contested',
  unsourced: 'unsourced',
  modeled: 'this model',
};

/**
 * Look up a claim, failing loudly rather than rendering a bare number.
 * @param {string} key
 * @returns {Claim}
 */
export function claim(key) {
  const c = CLAIMS[key];
  if (!c) throw new Error(`No claim registered for "${key}" - every displayed figure needs a source.`);
  return c;
}

/**
 * The only way a figure reaches the screen.
 * @param {string} key
 * @returns {{text: string, tier: string, note: string, src: string}}
 */
export function format(key) {
  const c = claim(key);
  const text = c.unit ? `${c.value} ${c.unit}` : `${c.value}`;
  return { text, tier: c.tier, note: c.note, src: c.src };
}

/** Numeric value, for use in the model itself. @param {string} key */
export function value(key) {
  const v = claim(key).value;
  if (typeof v !== 'number') throw new Error(`Claim "${key}" is not numeric.`);
  return v;
}
