# Colosseum People Flow

**Your ticket was a route, not a seat.**

A simulation and explainer for how tens of thousands of spectators moved through the Flavian Amphitheatre — and what happens to that building's performance when you take the routing away.

🔗 **Live:** _(pending first deploy)_

## Status

Under construction. See `DESIGN.md` for the rationale once the build lands.

## Running it locally

No toolchain, no install, no build step. ES modules need to be served over HTTP rather than opened from disk:

```
python3 -m http.server 8000
```

then open <http://localhost:8000>.

## Validating the model

```
node validate.js
```

Runs the simulation headless and prints clearance times and specific flow against published figures. CI runs this on every push.

## Model, not reconstruction

The topology is drawn from attested dimensions; the crowd behaviour is from published pedestrian-flow measurements; the counterfactual is an ablation, not a historical claim. Every figure in the UI carries a confidence tier and a source.

## Licence

MIT — see `LICENSE`.
