# Design rationale

**Colosseum People Flow** — [live tool](https://dtm988.github.io/colosseum_people_flow/) · [repo](https://github.com/dtm988/colosseum_people_flow)

---

## The idea

I was in Rome a week before starting this, standing in the Colosseum. The guide repeated the line everybody repeats: fifty thousand people, out in fifteen minutes, better than a modern stadium.

I tried to find out whether that was true. It is not quite, and what is true instead turned out to be more interesting: the building has *less* egress width per person than a modern code would permit, and clears in a comparable time anyway, because of how the routes are arranged. That became the tool.

## Theme 1, and why this approach

Theme 1 asks for something that builds deep understanding of a complex system, and explicitly invites "a simulation of emergent dynamics." An amphitheatre is a good fit for an unobvious reason: the thing worth understanding is not the architecture, it is the *flow*, and flow is invisible in every photograph and floor plan ever made of it.

The decision that shaped everything else was to make the explanation **operable rather than narrated**. A labelled cutaway would have demonstrated taste; it would not have demonstrated engineering. So the tool simulates 50,000 people individually, and every claim it makes about the building is something you watch happen and can then break by changing a control.

The second decision was that a model nobody can check is just an animation. So `validate.js` runs the simulation headless and prints its numbers next to the published ones, with permission to disagree.

## What is non-obvious

**The famous number has no source.** "Empties in fifteen minutes" appears everywhere — also as five minutes, also as ten — and I could not find an originating study, engineer, or calculation behind any version of it. What does exist is a 2022 peer-reviewed simulation comparing the Colosseum with a modern arena. Most of what people "know" about this building's performance is folklore with a number attached.

**The Colosseum would fail a modern egress code.** It provides about **4.3 mm of working stair per spectator**. The International Building Code asks for 7.6 mm, or 5.1 mm in a fully sprinklered building with voice alarm. It is below even the exception — and clears the building in a time comparable to a modern arena.

**The reason is topological, not dimensional.** Each of the ~80 wedges has its own seating block, its own stairway, and its own arch. No two routes share a corridor, so nothing merges inside the building and every metre of stair runs near its theoretical maximum. A modern arena gathers people into concourses first, and loses roughly 30% of the flow each metre could carry. The published figures make the equivalence exact:

| | width | specific flow | capacity |
|---|---|---|---|
| Colosseum stair | 2.8 m | 1.14 p/s/m | **3.19 people/s** |
| Modern arena stair | 4.0 m | 0.80 p/s/m | **3.20 people/s** |

A stair thirty percent narrower does the same work. Across a whole building that compounds: to match the Colosseum, a modern arena needs about **42% more staircase**.

**And the social hierarchy is in the circulation plan.** Rank fixed your tier, tier fixed your height, and height was most of your journey home. The cheapest seats — the wooden gallery for the poor, slaves and women — were forty metres up and had the longest way down. A plan view hides this completely, which is why clicking a wedge opens a cross-section.

## How the model works

Agents are simulated at 1:1 — 50,000 people, not 5,000 sprites — in typed arrays with a uniform grid, no allocation in the hot loop, and no trig in the simulation at all (agents live in angle/depth space and densities are binned there).

The part I care most about getting right is the division between what is imported and what is produced:

**Imported from measurement**
- Walking speed as a function of local density — Kholshevnikov & Samoshin, roughly 35,000 observations
- The maximum flow a metre of stair carries, from the stair literature
- The 71% familiar-exit bias, which fixes the exit-choice model's one free parameter
- The modern arena's flow efficiency, 0.80 p/s/m against the Colosseum's 1.14, applied as *effective width* — the standard way obstruction and merging losses are modelled

**Emergent from the model**
- Where queues form and how they interact
- The specific flow the building actually achieves
- How clearance time responds to exit policy and to exit capacity

That last division is the whole credibility of the exercise. The model's peak stair flow, **1.13 p/s/m**, is an output — nothing sets it — and it lands within 1% of a published 1.14 the model never sees. If I had imposed the flow rate and then reported it as a finding, the comparison would have been circular and worthless.

**Exit choice** is a multinomial logit over the available gates: disutility is walking distance plus a familiarity penalty for any gate that is not the one you came in by. The penalty is defined *relative* to the distance coefficient, so changing how sharply people weigh distance never disturbs the measured 71/29 split at equal distance.

## Decisions and tradeoffs

**Vanilla JavaScript, zero runtime dependencies, no build step.** Not because a toolchain was unavailable — it wasn't — but because of this artifact's lifespan and review context. It is ~2,900 lines, single author, and one of the ways it gets read is source-in-a-browser. A build step means either a committed `dist/` (confusing in exactly that view) or a Pages action that can fail silently between submission and review. `// @ts-check` with JSDoc gives editor-level type safety with none of that. For a codebase with a year and three contributors ahead of it I would use TypeScript without hesitating.

**The simulation core is DOM-free.** Nothing in `claims`, `rng`, `geometry` or `crowd` imports anything from the browser, so the same modules run in Node. That is what makes the headless check possible, and it is why determinism is testable at all.

**A claims registry as the architectural spine.** Every displayed figure goes through `claims.js`, which throws on an unregistered key. Presenting a contested claim as settled becomes structurally impossible rather than a discipline someone has to maintain. This cost about twenty lines and earned its keep twice — see below.

**Deployed as static files on GitHub Pages.** No backend, because nothing needs one and the most common way a take-home dies is a dead demo link on the morning a reviewer opens it. The repo link and the prototype link are the same artifact.

**Physics: path-advected agents with per-cell exclusion at bottlenecks.** A social-force model looks better and can eat an entire budget on force constants. A pure speed-density rule slows people but never stops them entering — mine let stair cells reach 140 people per square metre before I added jam-density exclusion. The combination imports the crowd physics from measurement and lets the queues emerge.

**Two features were cut on evidentiary grounds, and none on time.** That is the tradeoff I would most want a reviewer to notice.

## What the model disproved

The most useful results were the ones that contradicted me.

**The project began as a sharding thesis** — "your ticket was a route, not a seat" — arguing that assignment was what made the building fast. Then the model said otherwise: with 80 evenly spaced gates, free choice lands almost exactly where the assignment would have put you. The design does not beat good decision-making; it makes good decision-making unnecessary. Measured over five seeds, run-to-run noise is 8–11s and the policy gap is ~41s, so the effect is real — but **free choice is faster for 95% of the crowd and slower only for the last few.** Assignment buys the tail, not the median. That is a better finding than the one I set out to prove, and the whole framing of the tool moved to accommodate it.

**The water act was planned and cut.** The Colosseum was aqueduct-fed, and at the inaugural games the arena was flooded for naval displays — Cassius Dio says Titus "suddenly filled this same theatre with water." The *quantities* are sourced: ~5,600 m³, Aqua Claudia at 2.12 m³/s. The *topology* is not — no archaeological evidence survives for the link from the Caelian, and no pipes have been found inside the building. A flow visualisation is nothing but topology, so the centrepiece would have had to be invented. The claims registry had no tier to put it in, which is how I knew to cut it.

**My first modern-arena comparison was the Colosseum against itself with bigger doors.** Holding total exit width equal and redistributing it across 8 exits produced no penalty at all — because that synthetic building kept Roman flow efficiency. The negative result was true but empty: *arrangement does not matter if you hold efficiency constant.* The fix was to stop inventing the modern venue and import its measured efficiency instead.

**A code review found a bug in the headline comparison.** An earlier concourse model binned *seated* spectators into the corridor from the first step, penalising the modern building before anyone had reached a merging point. Removing it, the comparison survived (9m45 vs 9m12) — so the result was real, but it had been partly resting on an artifact.

**And one in my process.** The same review found that a commit did not contain the change its message described: a patch script had edited a file in memory and never written it, and I had "verified" the change by reading my own script's output.

## Known limitations, stated rather than hidden

- **We model travel time only.** A full evacuation model includes pre-movement time — the minute or two of gathering belongings and finishing conversations. This is the likeliest reason our 9m12 sits below the published 12m44, and I have deliberately *not* added it, because a parameter that conveniently closes a gap is the thing I would least trust in someone else's model.
- **Capacity is allocated in array-index order.** When a cell has one slot left, the lower index takes it. Deterministic, effectively random, but not a tie-break the physics justifies.
- **Speed and admission read different epochs** — speed from start-of-step counts, admission from live ones.
- **Exit choice is final.** Nobody queued at a busy stair reroutes to an idle one. Defensible here because stairs are near-equally loaded; it would not be if one route were congested and another free.
- **The 71% familiarity figure comes from emergency evacuations**, and this is ordinary end-of-show dispersal. I would expect the bias to hold or strengthen when nobody is hurrying, but that is inference.
- **Capacity estimates for the building run from 50,000 to 87,000.** We use 50,000 and say so.

## With more time

1. **Pre-movement time**, properly sourced rather than fitted, and reported as a band rather than a point.
2. **Re-selection under congestion** — let a spectator who has queued too long reconsider, which is what the exit-choice literature describes and what would make a damaged-building scenario meaningful.
3. **The hypogeum, and the flooding it ended.** Domitian's basement made the naval displays impossible; arena naumachiae are recorded in a window of roughly 80–85 AD and never again. "They shipped a stage-machinery upgrade and permanently deprecated a headline capability" is the best story in the building's history, and it needs evidence about channel topology that does not currently exist.
4. **A real modern stadium**, surveyed rather than synthesised, so the comparison rests on a building instead of a thought experiment.
5. **Validation against the published model's intermediate curves**, not just its endpoints — density over time is where the paper's most interesting claim lives (Colosseum density falls, modern accumulates) and we currently cite it rather than reproduce it.
6. **A hover layer on the charts**, and the wedge-by-wedge throughput strip as a small-multiples view.

## Time spent

**About three hours of my own time**, spread across two sittings.

I built this by directing Claude Code rather than typing the implementation, so the honest measure is engaged time rather than elapsed time. Reconstructed from the session transcript: ~1,300 words written by me and ~19,000 read, which is roughly 20 minutes typing and 85 minutes reading, plus perhaps an hour driving the tool, reading the inspector, and deciding what to do next. Call it three hours. Elapsed wall-clock across the two sittings was about twenty hours, most of it not at the keyboard.

Where that time actually went is the interesting part, and it was not construction. It went on judgement calls: choosing the theme, cutting the water act when the evidence wouldn't support it, rejecting a dramatic-but-wrong routed/unrouted comparison, noticing the subtitle buried the lead, deciding the gates-shut control didn't explain anything, spotting in the inspector that an element was re-rendering sixty times a second, and calling for a code review that found a bug in the headline number. The implementation was fast. Working out what was true took the time.

## Sources

- [Simulation of Evacuation from Stadiums and Entertainment Arenas of Different Epochs — *Fire* 2022, 5, 20](https://www.mdpi.com/2571-6255/5/1/20) — the Colosseum/Gazprom Arena comparison; specific flows and clearance times
- [Parameters of Pedestrian Flow for Modeling Purposes — Kholshevnikov & Samoshin](https://link.springer.com/chapter/10.1007/978-3-642-04504-2_12) — speed as a function of density
- [Exit choice in an emergency evacuation scenario is influenced by exit familiarity and neighbor behavior](https://www.sciencedirect.com/science/article/abs/pii/S0925753516306038) — the 71% figure
- [Exit Choice Behaviour during the Evacuation of Two Lecture Theatres — IAFSS](https://publications.iafss.org/publications/fss/2/541/view/fss_2-541.pdf) — the independent 72% replication
- [Logit-based exit choice model — Guo & Huang](https://www.researchgate.net/publication/230900445_Logit-based_exit_choice_model_of_evacuation_in_rooms_with_internal_obstacles_and_multiple_exits) — the choice model's form
- [IBC Chapter 10, Means of Egress](https://codes.iccsafe.org/content/IBC2021P2/chapter-10-means-of-egress) — 0.3 in (7.6 mm) per occupant
- [Colosseum — Wikipedia](https://en.wikipedia.org/wiki/Colosseum) — dimensions, arches, seating hierarchy
- [Evidence of a Seating Plan Discovered at the Colosseum — Smithsonian](https://www.smithsonianmag.com/smart-news/please-find-your-seats-evidence-seating-plan-discovered-colosseum-180954023/) — the red-painted numerals
- [Engineering of the Flavian Amphitheatre — Brewminate](https://brewminate.com/engineering-of-the-flavian-ampitheatre-roman-colosseum/) — arch dimensions, drainage, standardised parts
- [The Naumachia of Titus and Domitian in the Colosseum — Encyclopaedia Romana](https://penelope.uchicago.edu/encyclopaedia_romana/gladiators/naumachiae.html) and [Bad Ancient](https://www.badancient.com/claims/flood-the-colosseum/) — the flooding, for the act that was cut
