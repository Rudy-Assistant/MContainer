# MContainer Development Roadmap

Updated: 2026-04-23
Scope: `C:\MHome\MContainer` only

This document replaces scattered sprint notes as the working roadmap for the current branch. Completed items stay here so the remaining work is grounded in what is already stable.

## Completed Foundation

1. Release stabilization
- TypeScript, lint, build, audit, gates, and quality pass.
- Time-of-day browser gate contract repaired.
- Browser gate suite restored to green.

2. Supply chain and tooling
- `next` upgraded to `16.2.4`.
- Lint noise reduced to a usable gate.
- persistence/runtime warnings reduced.

3. Core product stabilization
- Frame/door flush fixes landed and verified.
- Persistence hardened against corrupt stored state.
- Block-grid multi-select and selection helpers improved.
- Procedural preview quality improved for more library objects.

4. Arrangement and intent architecture
- Container presets centralized into a typed `ContainerArrangementSpec`.
- Wizard presets partially migrated onto design intents.
- Multi-container `DesignIntentSpec` and compiler added.
- Prompt-facing design-intent schema adapter added.

5. Smart systems
- Cross-container stair openings now track and restore correctly.
- Shared upper-floor hole guards now compute from the actual opening footprint.
- Adjacent openings keep shared edges open and guard only the outer perimeter.
- Hole exits now honor real circulation continuity instead of only stair ascent hints.
- Atrium and terrace openings now ship as first-class arrangements instead of only hidden smart behavior.

6. Productized design vocabulary
- Added `glass_atrium`, `roof_terrace`, and `glass_terrace` as typed arrangements.
- Added `gallery_wings` and `courtyard_compound` model-home compositions.
- Wizard presets now expose atrium and terrace quick starts through the intent path.

7. AI-ready authoring
- Added concept-level design intents above raw arrangements.
- Prompt-facing parser now accepts concept specs and compiles them onto the validated arrangement/multi-container path.

## Remaining Roadmap

### Phase 1: Atrium And Arrangement Productization

Goal: turn the new hole-guard infrastructure into real user-facing design options.

1. Done: expand first-class atrium arrangements/presets
- single-container enclosed atrium
- glass atrium variant
- container-tab availability and preview contract

2. Done: integrate atrium into design intents
- single-container intent support
- multi-container intent compatibility
- prompt-schema compatibility

3. Done: add verification
- arrangement invariants
- store behavior tests
- browser/runtime smoke for atrium openings

### Phase 2: Smart Opening Semantics

Goal: make vertical circulation and voids feel designed rather than voxel-by-voxel.

1. Retired with replacement: mesh-level guardrail fusion is not needed to ship the behavior.
- Replacement: topology-aware perimeter guards now remove internal fragments and keep only the true outer edge.
- Existing adjacent-railing merge behavior stays covered by tests, without adding a second mesh-compaction system.
2. Done: stair exit-side logic depends on walkable continuity, not only ascent direction
3. Done: preserve user-painted rails/glass while recomputing smart perimeter guards
4. Done: extend smart-hole handling to non-stair vertical openings created by presets/tools

### Phase 3: Container-Level Design Options

Goal: broaden the design vocabulary before deeper AI generation work.

1. Done: add more whole-container arrangements
- atrium variants
- rooftop / terrace combinations
- stronger enclosed + outdoor hybrid shells

2. Done: add multi-container composition presets
- linked atrium pairs
- stacked atrium tower
- gallery wings
- courtyard compound

3. Done: keep all of these on the typed arrangement / intent path

### Phase 4: Smart UI and Workflow Exposure

Goal: expose the stronger design semantics cleanly in the product.

1. Done: improve Container tab grouping so arrangements read as whole-building moves
2. Done: surface design-intent-backed presets in wizard and quick-start paths
3. Done: add visual cues for atrium/hole guard behavior in inspector and preview
4. Retired with replacement: do focused browser/runtime smoke over these workflows instead of growing the brittle gate file for every arrangement.
- Replacement verification uses live browser checks against local dev builds for arrangement/model-home flows.

### Phase 5: Rendering and Visual Fidelity

Goal: resolve the remaining rendering complaints before expanding generation features.

1. Done: shadow fidelity pass
- roof and horizontal-surface shadow registration on ground
- sun shadow frustum/bias tuning
- verify with browser screenshots

2. Done: atmosphere pass
- reduce sky washout
- keep bloom restrained and physically plausible
- verify golden hour / midday / overcast behavior

3. Done: continue targeted visual regression tests for these cases

### Phase 6: AI-Ready Design Authoring

Goal: expand generation only after the manual design vocabulary is strong enough.

1. Done: introduce higher-level design intents above single arrangements
- composition
- circulation
- envelope style
- interior openness

2. Done: add validation for contradictory generated layouts
3. Done: add parser boundary from text prompt to validated intent structures
4. Retired with replacement: full prompt-to-design generation is intentionally left for a future branch.
- Replacement: this branch ends at validated concept compilation onto the existing store-safe arrangement path.

## Execution Order

Completed in order on this branch.

## Completion Standard

This roadmap is complete only when:
- all roadmap phases above are implemented or explicitly retired with replacement
- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run test` passes
- `npm run build` passes
- browser verification exists for the new user-facing workflows
