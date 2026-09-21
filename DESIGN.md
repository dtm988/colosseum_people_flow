# Design rationale

**Colosseum People Flow** — [live tool](https://dtm988.github.io/colosseum_people_flow/) · [repo](https://github.com/dtm988/colosseum_people_flow)

---

## The idea

I was in the Roman Colosseum a week before starting this and found myself taken with the intricate, ancient engineering: a stadium built two thousand years ago that seated fifty thousand people and featured running water plumbed to its latrines. Its basement level could be flooded to stage naval battle reenactments, then drained and the floor put back in place to support land skirmishes. It even had a retractable roof for shade made from ship sails on pulleys. Due to clever design, massive crowds were able to flow into and out of the Colosseum at rates commensurate with modern sports stadiums.

I sought to build an app that showcased and explained some aspect of the Colosseum's design, with early ideas to either focus on the flow of people or water. Research yielded an obvious choice between the two: people flow. Chasing the circulation story turned up a oft repeated claim repeated: fifty thousand people out in fifteen minutes. I found one study from 2022 that compared a simulation of Colosseum people flow to a newly built stadium and found their egress rates to be comparable, then sought to replicate and expand upon the premise.

## Theme 1, and why this approach

Theme 1 asks for something that builds deep understanding of a complex system, and explicitly invites "a simulation of emergent dynamics." While it is possible to explain the flow of people through the Colosseum in words, a visual model helps bring the theory to life and enables real world comparison to modern equivalents such as professional sports stadiums.

Importantly, I decided to enable running a high-fidelity simulation live instead of showing a pre-canned animation. So the tool simulates 50,000 people individually, and every claim it makes about the building is something the user can replicate and watch unfold live. Then, they are invited to change the input parameters and engage in hands on experimentation with the mechanics.

## What is non-obvious

**The famous number has no single source.** "Empties in fifteen minutes" is a ubiquitous phrase — sometimes quoted as five or ten minutes — and I could not find an originating study, engineer, or calculation behind any version of it. What does exist is a 2022 peer-reviewed simulation comparing the Colosseum with a modern arena. Most of what people "know" about this building's performance is folklore with a number attached.

**The Colosseum would fail a modern egress code.** It provides about **4.3 mm of working stair width per spectator**. The International Building Code asks for 7.6 mm, or 5.1 mm in a fully sprinklered building with voice alarms. It is below even the exception — and clears the building in a time comparable to a modern arena.

**The reason is topological, not dimensional.** Each of the ~80 wedges of the Colosseum has its own seating block, its own stairway, and its own arch. No two routes share a corridor, so nothing merges inside the building and every meter of stair runs near its theoretical maximum. A modern arena will funnel people into open concourses first, and then ushers them towards a small number of grand staircases, losing roughly 30% of the flow each meter of those staircases could theoretically carry. The published figures make the equivalence exact:

| | width | specific flow | capacity |
|---|---|---|---|
| Colosseum stair | 2.8 m | 1.14 p/s/m | **3.19 people/s** |
| Modern arena stair | 4.0 m | 0.80 p/s/m | **3.20 people/s** |

A stair thirty percent narrower does the same work in the same time. Across a whole building that compounds: to match the Colosseum, a modern arena needs about **42% more total stair width**.

Worth being precise about what that 42% is, because it is easy to misread. It is not that each grand staircase is 42% wider — they are about nine times wider each, and there are a ninth as many. In the comparison both buildings are handed the *same* total stair width, 212.8 m, and the difference is that only about 70% of the modern building's width carries flow. To get 212.8 m of *working* width you would need 303 m of nominal width: hence 42% more.

The model agrees with that figure independently, which is worth more than quoting it. Hand the modern building 42% more nominal width and its clearance time lands on the Colosseum's exactly — 9m12 either way. `validate.js` asserts it.

It also explains something that looks like a weak result until you take it apart. Left alone, the two buildings finish only 6% apart (9m12 against 9m45) despite a 30% difference in working stair width. That is because stair capacity accounts for only about 40% of the clearance time — the rest is walking to the stair and descending forty metres, and neither cares how wide the stair is. The extra queueing largely hides inside travel time that was happening anyway. It is also why the published study finds near-parity in *time* between an ancient and a modern arena while finding a large gap in *flow per metre*: clock time is a blunt instrument for this, and the efficiency is where the difference actually lives.

And in the other direction, a real modern building is not stingy with stairs — it is the opposite. The Colosseum runs on about 4.3 mm of working stair per spectator where a modern code asks for 7.6 mm, roughly **77% more width per person**. Modern arenas buy their egress performance with more stair; the Colosseum buys it by wasting less of what it has.

**And the social hierarchy is in the circulation plan.** Rank fixed your tier, tier fixed your height, and height was most of your journey home. The cheapest seats — the wooden gallery for the poor, slaves and women — were forty metres up and had the longest way down.

## How the model works

Agents are simulated at 1:1 — 50,000 people, not 5,000 sprites — in typed arrays with a uniform grid, no allocation in the hot loop, and no trig in the simulation at all (agents live in angle/depth space and densities are binned there).

The part I care most about getting right is the division between what is imported and what is produced:

**Imported from measurement**
- Walking speed as a function of local density — Kholshevnikov & Samoshin, roughly 35,000 observations
- The maximum flow a metre of stair carries, from stair literature
- The 71% familiar-exit bias, which captures the phenomenon that people tend to exist where they came in and fixes the exit-choice model's one free parameter
- The modern arena's flow efficiency, 0.80 p/s/m against the Colosseum's 1.14, applied as *effective width* — the standard way obstruction and merging losses are modelled

**Emergent from the model**
- Where queues form and how they interact
- The specific flow the building actually achieves
- How clearance time responds to exit policy and to exit capacity

That last division is the whole credibility of the exercise. The model's peak stair flow, **1.13 p/s/m**, is an output — nothing sets it — and it lands within 1% of a published 1.14 the model never sees. If I had imposed the flow rate and then reported it as a finding, the comparison would have been circular and worthless.

**Exit choice** is a multinomial logit over the available gates: disutility is walking distance plus a familiarity penalty for any gate that is not the one you came in by. The penalty is defined *relative* to the distance coefficient, so changing how sharply people weigh distance never disturbs the measured 71/29 split at equal distance.

## Decisions and trade-offs

### 1. Water or people

The trip that prompted this threw up two candidates. The Colosseum moved **water** — aqueduct-fed latrines flushed continuously, a hundred-odd drinking fountains, a great circular drain, and, at the inaugural games, an arena flooded for naval displays. And obviously it moved **people** into and out of the stands.

Water was initially the better story. Cassius Dio has Titus "suddenly fill this same theatre with water"; Martial, probably an eyewitness, writes *"here but lately was land… here but lately was sea."* Then Domitian built the hypogeum and flooding became impossible, so the whole spectacle exists in a window of about five years. That is a terrific narrative.

I cut it, and the reasoning is the one I would most want read. The **quantities** are sourced — roughly 5,600 m³ to flood, Aqua Claudia at 2.12 m³/s, published fill estimates. The **topology is not**: there is no surviving archaeological evidence for the link from the Caelian, and no pipes have been found inside the building. A flow visualisation is nothing *but* topology — where the water enters, which channels carry it, how it drains. Building it would have meant inventing the centrepiece and dressing it as history.

**Cost:** the more charismatic subject, and the best single fact I had.
**Why it was right:** people-flow has the opposite profile — the topology is the attested part (arches, numerals, wedge structure) and only the behaviour needs importing from measurement. A tool whose whole posture is "every figure carries its evidence" cannot have an invented centrepiece.

### 2. Front-end only or build a server?

This app does not require user accounts and no persistent data storage was needed. Moreover, early testing of the algorithm, demonstrated that the browser was able to keep up with animating 50,000 agents simultaneous without any back-end help: no noticeable lag or loss of fidelity. Finally, the full algorithm was written from scratch and required a small amount of code by modern browser standards. Thus, there was no need to import large libraries and that could slow down load times (or introduce a build step to compress the JS and combat those slow load times). For these reasons, I elected to make this a front-end only architecture. Moreover, given this is a demo, front-end only maximizes the chances of the demo running successfully for all users. There is no server than can become unavailable or go down.

The same logic extended to tooling. One of the ways this gets read is source-in-a-browser on GitHub, and a build step means either a committed `dist/` (confusing in exactly that view) or a Pages action that can fail quietly between submission and review. `// @ts-check` with JSDoc gives editor-level type safety with none of that.

**Cost:** no server-side persistence, no shared state, and hand-rolled charts instead of a library.
**Bought:** repo link and prototype link are the same artifact, and there is no runtime that can fail.
**Where I'd decide differently:** a codebase with a year and three contributors ahead of it gets TypeScript without hesitation. This is ~2,900 lines with one author and a review window.

### 3. An explainer that operates the model, rather than narrating beside it

Once the simulation worked it was still illegible. Someone arriving cold sees an ellipse and some moving dots, and the assignment is explicitly about helping people *learn* something.

Two bad options presented themselves. A **sandbox** with controls and no guidance teaches a reviewer with three minutes nothing. A **canned walkthrough** — scripted animation, prerecorded states — teaches, but denies the discovery that makes it land, and quietly stops being a simulation at all.

The resolution was that every tour step drives **the same controls a visitor can drive themselves**. There is no scripted animation anywhere in the tool; each step sets up the real model, points at one part of the building, and says what is about to happen. You can leave at any step and keep playing with what is on screen, because what is on screen is just the tool.

The detail I would defend hardest is the **"watch for this" line** on each step that runs. Telling someone what to look for *before* it happens is the difference between a demo and an explanation — after the fact it is just a caption.

**Cost:** roughly a fifth of the build, and the card covers part of the plan.
**Bought:** the thing the brief actually asks for. A simulation a stranger cannot read is a screensaver.

### 4. A claims registry as the architectural spine

Every figure the tool displays goes through one module that pairs it with an evidence tier, and `claim()` throws on an unregistered key. Presenting a contested number as settled becomes structurally impossible rather than a discipline I have to keep remembering at 1 a.m.

**Cost:** indirection on every displayed value, and about twenty lines.
**Bought:** it caught problems. The water act died because its channel topology had no tier to put it in — the registry asked a question I could not answer. It is also why the tool can say out loud that the famous fifteen-minute figure is **unsourced**, which is a claim most explainers of this building quietly launder into fact.

### 5. Which crowd physics

Three options, and the most impressive one was the wrong one.

- **Social-force model** — the most convincing crowd visually, and a genuine risk of spending the entire budget on force constants and instability.
- **Floor-field cellular automaton** — the evacuation literature's standard; jamming emerges from cell exclusion, but its emergent fundamental diagram needs calibrating against the measured curve, which is its own project.
- **Path-advected agents on a measured speed-density curve, with per-cell exclusion at the bottlenecks** — what I built.

The deciding argument was not effort, it was what I would be able to *claim*. With the third option I can say precisely: the physics is imported from roughly 35,000 observations, and the queues are emergent. A lattice rule that produces a plausible-*looking* jam is not evidence about this building, and claiming emergence you did not earn is exactly the sort of thing the people reading this submission notice.

It also needed correcting twice in flight. A pure speed-density rule slows people but never stops them entering, so stair cells were reaching **140 people per square metre** and reporting flow rates the physics cannot deliver; jam-density exclusion fixed that. And an earlier version applied a stair slowdown *on top of* the density curve, double-counting it and capping stairs at half their real capacity.

### 6. What the tool is *about*: assigned exits, or stair efficiency

This project started as a sharding thesis. The tagline was *"your ticket was a route, not a seat"* — the argument being that pre-assigned exits were what made the building fast, which is a lovely systems story about static routing beating runtime scheduling.

**The model disproved it.** With 80 evenly spaced gates, letting people choose freely lands them almost exactly where the assignment would have. There is no dramatic gap to show, because the design *encodes* the choice a well-informed crowd would make anyway.

What replaced it came out of the literature: the Colosseum achieves **1.14 person/s/m** on a 2.8 m stair where a modern arena manages **0.80** on a 4.0 m one. Same people per second, thirty percent less stair. Across a building that compounds into 42% more staircase needed to match.

**Cost:** the duller headline. "Static routing beats dynamic scheduling" is a better soundbite than "flow efficiency per metre of stair," and I had already written the tagline, the tour copy, and half the framing around it.
**Why it was right:** it is the claim the evidence actually supports, and it is *more* surprising once stated — the building would fail a modern egress code and clears in a comparable time anyway.

There was a second, subtler version of the same error. My first modern-arena comparison redistributed the Colosseum's own geometry into eight big exits and found **no difference at all** — because that synthetic building kept Roman flow efficiency. I had built the Colosseum against itself with bigger doors. The fix was to stop inventing the modern venue and **import its measured efficiency**, applied as effective width. Importing a measured parameter and computing its consequence is a different act from assuming the answer, and the distinction is the difference between a result and a circular one.

### 7. Keeping the assignment toggle anyway

Having demoted assignment from the thesis, the honest question was whether to delete the control. I measured it over five seeds instead of arguing about it: run-to-run noise is 8–11 s and the policy gap is ~41 s, so the effect is real. But it sits somewhere unexpected:

| | median out | 95% out | last out |
|---|---|---|---|
| assigned | 5m 47s | 8m 20s | **9m 12s** |
| free choice | **4m 56s** | **7m 39s** | 10m 49s |

Free choice is faster for 95% of the crowd and slower only for the last few percent. **Assignment does not buy speed; it buys the tail.** That is p50 versus p99, and it is a more interesting property than the one I set out to prove — so the control stays, relabelled to ask the question it actually answers.

### 8. Cutting the gates-shut control

I built a control that closed arcs of gates, and it produced striking numbers — a quarter less stair costs 3.3× the clearance time, and under damage the rigid assignment becomes a liability. Genuinely interesting, and I cut it.

There is no evidence the Colosseum ever ran with gates shut. It was a disaster scenario wearing an explainer's clothes: a fact about egress capacity in general rather than about this building, sitting in a tool that exists to explain this building. The nonlinearity survives in prose here, where it costs the reader nothing.

**Two features cut on evidentiary grounds, none on time.** That is the sentence I would most want a reviewer to take from this document.

### 9. Debugging a control that did nothing

The tour's Next button appeared dead, and it took three rounds to find. The wrong theories were cache staleness and a canvas overlapping the button — both plausible, both wrong. The actual cause: a careless string replace had matched `requestAnimationFrame(frame);`, which appears *inside* `frame()` itself, and injected the initialisation block into the render loop. `tour.start()` was running sixty times a second. Every click worked and was undone about sixteen milliseconds later.

The reason it survived three rounds is the part worth recording. Claude was inspecting the page through an automation tab, and **browsers suspend `requestAnimationFrame` in backgrounded tabs** — so the loop containing the bug never ran on its side. `elementFromPoint` said the button was on top; a `MutationObserver` counted zero mutations; a synthetic click advanced the tour. Every measurement was correct, and every one was of a page that could not exhibit the defect. It was solved by me manually looking at the inspector and saying *"the aside appears to be recreating itself many times a second."* I noticed the hallmark flashing of the element tag to indicate recreation from my years of experience debugging browser HTML and JS issues.

Three things changed as a result, and I would keep all of them:

- **Never rebuild interactive DOM inside a render loop.** A button replaced between mousedown and mouseup never fires a click at all. The card is now built once and only its text swapped, so the failure is structurally impossible. The metrics panel had the same defect and got the same fix.
- **A visible build stamp**, because two of those rounds were spent not knowing which build was in the browser — plus a `validate.js` check that the version agrees across every file, turning the manual step that caused a lost edit into a tested invariant.
- **A fault banner**, because a control that silently does nothing is the worst failure a tool can have: it reads as a design decision rather than a bug.

**The transferable lesson:** challenge AI saying "works for me" about a browser UI visual because its read of what's on screen is hampered by animation frame limitations for background tabs.

### 10. Commissioning a review I might not like

With the tool working, I ran a full review pass over the implementation rather than calling it done. It found eight issues. Two mattered: a concourse model that penalised the modern arena with a start-up artifact **inside the headline comparison**, and a commit that did not contain the change its message described — a patch script had edited a file in memory and never written it, and I had "verified" the change by reading the script's own output.

The comparison survived removing the artifact (9m45 against 9m12), so the finding was real — but part of it had been resting on a bug. I would rather know that before a reviewer does.

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
