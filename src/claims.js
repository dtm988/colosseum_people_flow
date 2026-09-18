// @ts-check
/**
 * Every number this tool displays lives here, with the evidence tier behind it.
 *
 * Nothing renders a figure without going through `format()`, so presenting a
 * contested claim as settled fact is structurally impossible rather than a
 * discipline someone has to remember. It is also what caught the planned water
 * simulation: the arena flooding has sourced volumes and flow rates, but its
 * channel topology had no tier to put it in, so the act was cut rather than
 * invented. Every entry below is one the tool actually displays.
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
  gateWidth: {
    value: 4.2, unit: 'm', tier: 'attested',
    note: 'Each ground-level arch is 4.2 m wide and 7.05 m tall.',
    src: 'Brewminate',
  },
  outerHeight: {
    value: 48, unit: 'm', tier: 'attested',
    note: 'Height of the outer wall. The cavea rises with it, so the cheapest seats were also the highest - and the furthest from the street.',
    src: 'Wikipedia, Colosseum',
  },
  podiumHeight: {
    value: 5, unit: 'm', tier: 'inferred',
    note: 'Height of the podium above the arena floor, where the senators sat. Sources give figures around 4-5 m for the arena wall.',
    src: 'multiple',
  },
  stairCapacity: {
    value: 1.1, unit: 'person/s/m', tier: 'inferred',
    note: 'Maximum specific flow on descending stairs. The level-ground curve peaks near 1.4 p/s/m; stairs run lower. This model uses a stair factor placing the peak near 1.1, within the usual published range - chosen from the stair literature, not fitted to this building\'s clearance time.',
    src: 'pedestrian flow literature',
  },
  modernExits: {
    value: 8, unit: 'grand exits', tier: 'modeled',
    note: 'A thought experiment, not a real stadium: the same total exit width the Colosseum has, gathered into eight grand exits instead of spread across seventy-six small ones. It isolates how capacity is DISTRIBUTED from how much of it there is - the two buildings can move the same number of people per second, and only the shape of the route differs.',
    src: 'this model',
  },
  stairWidth: {
    value: 2.8, unit: 'm', tier: 'inferred',
    note: 'Colosseum stairs modelled at 2.8 m, against 4.0 m for the modern stadium compared with it - narrower, and still the faster of the two.',
    src: 'Fire (MDPI) 2022',
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
  specificFlowModern4m: {
    value: 0.8, unit: 'person/s/m', tier: 'inferred',
    note: 'Modern arena specific flow on a 4 m stair. The comparison the paper actually makes: 2.8 m of Roman stair at 1.14 p/s/m carries 3.19 people per second, and 4.0 m of modern stair at 0.80 carries 3.20. A stair 30% narrower does the same work.',
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
  stairSpeed: {
    value: 0.6, unit: 'm/s', tier: 'inferred',
    note: 'Free descent speed on stairs, against 1.3 m/s on the level. A modelling choice within the usual range, not a measurement of this building.',
    src: 'pedestrian flow literature',
  },
  familiarExitBias: {
    value: 71, unit: '%', tier: 'attested',
    note: 'Offered two exits at equal distance, about 71% of people chose the one they had entered by. A separate study of lecture theatre evacuations found 72% leaving by the familiar main entrance. The effect strengthens when neighbours do the same - and familiar-group participants were measurably less likely to even notice the alternative.',
    src: 'Exit familiarity & neighbour behaviour (2016); IAFSS lecture theatres',
  },
  familiarityIsEmergency: {
    value: 'emergency studies', tier: 'contested',
    note: 'The familiarity findings come from emergency evacuations. This model is of ordinary end-of-show dispersal. The bias should hold or strengthen when nobody is hurrying, but that is inference rather than evidence.',
    src: '-',
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
