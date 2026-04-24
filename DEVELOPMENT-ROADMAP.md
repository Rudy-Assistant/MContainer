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

## Remaining Roadmap

### Phase 1: Atrium Productization

Goal: turn the new hole-guard infrastructure into real user-facing design options.

1. Add first-class `Atrium` arrangements/presets
- single-container enclosed atrium
- glass atrium variant if it materially differs
- container-tab availability and preview contract

2. Integrate atrium into design intents
- single-container intent support
- multi-container intent compatibility
- prompt-schema compatibility

3. Add verification
- arrangement invariants
- store behavior tests
- browser/runtime smoke for atrium openings

### Phase 2: Smart Opening Semantics

Goal: make vertical circulation and voids feel designed rather than voxel-by-voxel.

1. Merge contiguous guardrails into cleaner runs
2. Make stair exit-side logic depend on walkable continuity, not only ascent direction
3. Preserve user-painted rails/glass while recomputing smart perimeter guards
4. Extend smart-hole handling to non-stair vertical openings created by presets/tools

### Phase 3: Container-Level Design Options

Goal: broaden the design vocabulary before deeper AI generation work.

1. Add more whole-container arrangements
- atrium variants
- courtyard / breezeway / gallery patterns where footprint allows
- stronger rooftop / terrace combinations

2. Add multi-container composition presets
- linked atrium pairs
- stacked atrium tower
- bridge / wing compositions with adjacency-aware defaults

3. Keep all of these on the typed arrangement / intent path

### Phase 4: Smart UI and Workflow Exposure

Goal: expose the stronger design semantics cleanly in the product.

1. Improve Container tab grouping so arrangements read as whole-building moves
2. Surface design-intent-backed presets in wizard and quick-start paths
3. Add visual cues for atrium/hole guard behavior in inspector and preview
4. Add more browser gates around arrangement workflows

### Phase 5: Rendering and Visual Fidelity

Goal: resolve the remaining rendering complaints before expanding generation features.

1. Shadow fidelity pass
- roof and horizontal-surface shadow registration on ground
- sun shadow frustum/bias tuning
- verify with browser screenshots

2. Atmosphere pass
- reduce sky washout
- keep bloom restrained and physically plausible
- verify golden hour / midday / overcast behavior

3. Continue targeted visual regression tests for these cases

### Phase 6: AI-Ready Design Authoring

Goal: expand generation only after the manual design vocabulary is strong enough.

1. Introduce higher-level design intents above single arrangements
- composition
- circulation
- envelope style
- interior openness

2. Add validation for contradictory generated layouts
3. Add parser boundary from text prompt to validated intent structures
4. Only then begin full prompt-to-design flows

## Execution Order

1. Atrium productization
2. Smart opening semantics
3. Container-level design options
4. Smart UI/workflow exposure
5. Rendering and visual fidelity
6. AI-ready design authoring

## Completion Standard

This roadmap is complete only when:
- all roadmap phases above are implemented or explicitly retired with replacement
- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run test` passes
- `npm run build` passes
- browser verification exists for the new user-facing workflows
