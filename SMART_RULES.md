# ModuHome Smart Rules — Canonical Reference

A "Smart Rule" is an architectural invariant that the app enforces automatically
when the user edits a design in **Smart** mode, and that a correctness gate
runs over any design that arrives via the AI pipeline or a share URL. Rules
model the physics and building-code constraints of real shipping-container
homes.

**Every rule has:**
- A **source of truth** — the function/module that owns the enforcement.
- A **scanner** — a pure function in `src/utils/smartRuleValidator.ts` that
  detects violations, emitting `SmartRuleViolation[]`.
- A **repair** (for 8 of 10 rules) — a pure function in
  `src/utils/smartRuleRepair.ts` that autofixes violations. SR-02 and SR-08
  are render-derived; no data-layer repair exists.
- An **exemplar** — the Starter Set model home that demonstrates the rule.
- A **test** — the behavioural test that guarantees it keeps working.

**Every rule is reachable from one public API:**
[`normalizeDesign(containers, { mode })`](src/utils/normalizeDesign.ts) — runs
the cascade in the correct dependency order and returns either a scan report
(`mode: 'report'`) or an autofixed containers record (`mode: 'repair'`).

---

## Rule Index

| ID | Rule | Tier | Severity | Scanner | Repair | Exemplar |
|----|------|------|----------|---------|--------|----------|
| SR-01 | Stairs auto-void the floor above | physics | error | ✅ | ✅ | `two_story`, `split_level_loft` |
| SR-02 | Perimeter floor corners get support poles | render | info | — | — | `garden_pavilion` |
| SR-03 | Rooftop decks live on the top internal level | physics | error | ✅ | ✅ | `two_story`, `stacked_triplex` |
| SR-04 | Open-air perimeter edges get cable railings | safety | warning | ✅ | ✅ | `entertainer`, `garden_pavilion` |
| SR-05 | Stair entry-face walls auto-open | safety | warning | ✅ | ✅ | `two_story` |
| SR-06 | Stair lateral faces get railings | safety | warning | ✅ | ✅ | `two_story` |
| SR-07 | Rooftop deck only on topmost container | physics | error | ✅ | ✅ | `stacked_triplex` |
| SR-08 | Concave-corner poles | render | info | — | — | `corner_terrace` |
| SR-09 | Multi-level stair chain — stacked void | physics | error | ✅ | ✅ | `stacked_triplex` |
| SR-10 | Fall-hazard hole guards | safety | warning | ✅ | ✅ | `atrium_gallery` |

**Severity tiers:**
- **physics** (`error`) — violation is physically impossible; AI output with
  residual physics violations after repair is rejected by the pipeline.
- **safety** (`warning`) — habitable but unsafe; surfaced in the Warning Panel.
- **render** (`info`) — render-time-derived, no data state to scan; the rule
  exists for documentation / future retention only.

---

## Cascade Order (documented in `normalizeDesign.ts`)

Repair passes run in this order. Each pass assumes prior passes have run.

```
SR-07 → SR-01 → SR-05 → SR-06 → SR-09 → SR-04 → SR-10 → SR-03
```

| Pass | Why it runs in this position |
|------|------------------------------|
| SR-07 first  | Strip stale rooftop-deck signatures from non-topmost containers so later rules see the final stacking graph. |
| SR-01        | Open ceilings above stairs so SR-05/SR-06 scan against the final face state. |
| SR-05, SR-06 | Entry wall + lateral railings for each stair. |
| SR-09        | Propagate the floor void across stacked containers. |
| SR-04, SR-10 | Perimeter and fall-hazard railings, with prior stair fixes already applied. |
| SR-03 last   | Demote any Deck_Wood stranded on non-top levels (safety net). |

---

## Data Flow

```
            ┌─────────────────────────────────────────────┐
            │            INVOCATION POINTS                 │
            │  applyDesignIntent  applyMultiContainerDI   │
            │  importSharedDesign  cleanupDesign()         │
            └───────────────┬─────────────────────────────┘
                            │ containers (Record<id, Container>)
                            ▼
            ┌─────────────────────────────────────────────┐
            │         normalizeDesign(containers, opts)   │
            │         src/utils/normalizeDesign.ts        │
            └───────────────┬─────────────────────────────┘
                            │ mode === 'repair': cascade SR-07 → SR-03
                            ▼ mode === 'report': pure scan
            ┌─────────────────────────────────────────────┐
            │  SMART_RULES.md rule index drives the loop  │
            └─────────────────────────────────────────────┘
                                ▲
                                │
          ┌─────────────────────┴──────────────────────┐
LLM JSON ─►  parsePromptDesignIntent (Zod)  ─► executor │
          │                                             │
share URL ─►  importSharedDesign                        │
          │                                             │
user click ─► cleanupDesign() (Clean up button)         │
          └─────────────────────────────────────────────┘
```

---

## Rule Details

### SR-01 — Stairs Auto-Void The Floor Above

**Invariant.** When stairs are placed on a voxel, the voxel directly above
(same column/row, next level) must have its floor face opened so the stairs
aren't walking into a ceiling.

**Scanner.** [`checkStairVoid`](src/utils/smartRuleValidator.ts) — reports when a stair's upper
voxel has a solid floor.

**Repair.** [`repairStairVoid`](src/utils/smartRuleRepair.ts) → calls [`computeFloorVoid`](src/utils/stairEnforcement.ts)
which opens the bottom face and installs `Railing_Cable` on non-exit walls.

---

### SR-02 — Perimeter Floor Corners Always Get Support Poles

**Invariant.** Every convex corner of an active voxel boundary has a pole,
including deck-extension corners (no ceiling, but a walkable floor).

**Scanner.** [`checkFloorCornerPole`](src/utils/smartRuleValidator.ts) — flags isolated perimeter
floor voxels with no cardinal neighbours to share a pole with.

**Repair.** None — poles are render-derived in [`smartPoles.ts`](src/utils/smartPoles.ts).

---

### SR-03 — Roof Decks Live On The Top Internal Level

**Invariant.** `generateRooftopDeck` writes Deck_Wood to the **top face of
the top internal level's** body voxels. Never level 0.

**Scanner.** [`checkRooftopLevel`](src/utils/smartRuleValidator.ts) — flags Deck_Wood on non-top
internal levels (excluding stair-upper voxels, which legitimately carry
Deck_Wood as the landing).

**Repair.** [`repairRooftopLevel`](src/utils/smartRuleRepair.ts) — demotes Deck_Wood on non-top
body voxels to Solid_Steel.

---

### SR-04 — Open-Air Perimeter Edges Auto-Get Cable Railings

**Invariant.** Any active voxel whose face borders an inactive/OOB neighbour,
on an elevated container, with an open top, must have `Railing_Cable`
(or another approved guard) on that face — unless the user hand-painted it.

**Scanner.** [`checkOpenEdgeRailing`](src/utils/smartRuleValidator.ts) — merged from the
legacy `checkUnprotectedEdges` rule. Superset of the old behaviour.

**Repair.** [`repairOpenEdgeRailing`](src/utils/smartRuleRepair.ts) — installs `Railing_Cable`
on qualifying faces.

**Legacy alias.** `checkUnprotectedEdges` in `designValidation.ts` still
exists as a compatibility wrapper that emits warnings with the original
`safety-unprotected-*` id format. Existing callers keep working.

---

### SR-05 — Stair Entry Walls Auto-Open

**Invariant.** The wall shared between a stair and its entry neighbour must
be `Open` (or a `Door`) or the stair is walled off.

**Scanner.** [`checkStairEntryWall`](src/utils/smartRuleValidator.ts).

**Repair.** [`repairStairEntryWall`](src/utils/smartRuleRepair.ts) → calls
[`computeEntryWallClear`](src/utils/stairEnforcement.ts).

---

### SR-06 — Stair Lateral Railings

**Invariant.** For a north-south stair, exposed east/west faces get
`Railing_Cable`. For an east-west stair, exposed north/south faces do.

**Scanner.** [`checkStairLateralRailing`](src/utils/smartRuleValidator.ts).

**Repair.** [`repairStairLateralRailing`](src/utils/smartRuleRepair.ts) → calls
[`computeLateralRailings`](src/utils/stairEnforcement.ts).

---

### SR-07 — Rooftop Deck Only On Topmost

**Invariant.** `generateRooftopDeck` guards on `isTopmost`. Any container
with another container stacked on it must NOT carry a rooftop-deck signature
on its top-level body voxels.

**Scanner.** [`checkRooftopTopmost`](src/utils/smartRuleValidator.ts).

**Repair.** [`repairRooftopTopmost`](src/utils/smartRuleRepair.ts) — strips Deck_Wood + perimeter
Railing_Cable from non-topmost containers.

**Regression history.** Stacking three containers sequentially used to leave
stale rooftop decks on intermediate levels (deck added to B when C stacked,
then B was stacked by D but the deck stayed). Fixed in `stackContainer` by
calling `removeRooftopDeck(bottomId)` before `generateRooftopDeck(topId)`.

---

### SR-08 — Concave Corners Also Need Poles

**Invariant.** In an L-shape or more complex footprint, the **inside** elbow
vertex (where 3 voxels meet and 1 is missing) also gets a pole.

**Scanner.** Scan-only no-op. Concave corners are normal in any L-shape and
flagging them would be pure noise.

**Repair.** None — render-derived.

---

### SR-09 — Multi-Level Stair Chain

**Invariant.** Every stair call that reaches the top level of its source
container propagates a floor void to the stacked container above.

**Scanner.** [`checkCrossContainerVoid`](src/utils/smartRuleValidator.ts).

**Repair.** [`repairCrossContainerVoid`](src/utils/smartRuleRepair.ts) → calls
[`computeCrossContainerVoid`](src/utils/stairEnforcement.ts).

---

### SR-10 — Fall-Hazard Hole Guards

**Invariant.** When a voxel's floor is open (atrium void or stair-above hole),
every side face that abuts an inactive/OOB neighbour must be `Railing_Cable`,
`Railing_Glass`, `Solid_Steel`, or `Glass_Pane`.

**Scanner.** [`checkFallHazardGuard`](src/utils/smartRuleValidator.ts).

**Repair.** [`repairFallHazardGuard`](src/utils/smartRuleRepair.ts).

---

## Integration Points

### AI pipeline (`designIntents.ts`)

LLM emits JSON matching `PromptDesignIntentZodSchema`. The schema is
`.strict()` — unknown keys reject. Use `safeParsePromptDesignIntent(raw)`
to get a `{ success, data | error }` discriminated result; use
`parsePromptDesignIntent(raw)` to get a throwing variant.

Once parsed, `applyMultiContainerDesignIntent` runs the executor, then
calls `cleanupDesign()` before returning. Any residual physics violations
mean the AI-emitted design is structurally impossible and the caller should
reject / regenerate.

### Share URL (`importSharedDesign`)

Same `cleanupDesign()` gate at the end. A shared design that predates
rules or originates from Manual-mode editing will normalize on load.

### User action (Clean up button)

The Sparkles icon in the top toolbar calls `cleanupDesign()`. Idempotent —
pressing twice on a clean design is a no-op.

### Interactive editor (`ValidationSubscriber`)

Scene.tsx's 300 ms-debounced subscriber calls `validateDesign` which runs
the full rule set via `checkSmartRules`. Warnings appear in the badge.

---

## Adding a new Smart Rule

1. Document the invariant here in prose with `SR-NN` format.
2. Add enforcement inside the appropriate store slice (`voxelSlice`,
   `containerSlice`, etc) if the mutation path owns the rule.
3. Add a **scanner** to `smartRuleValidator.ts` — a pure function that
   returns `SmartRuleViolation[]`. Add the ID to `SmartRuleId`.
4. If the rule is autofixable: add a **repair** to `smartRuleRepair.ts`,
   then insert it into `REPAIR_PASSES` in `normalizeDesign.ts` at the
   correct cascade position.
5. Add a Starter Set model home to `modelHomes.ts` that exercises the rule.
6. Write a behavioural test that would fail without the rule.
7. Add a row to the Rule Index above. Update the Cascade Order diagram if
   the new rule participates.

---

## Performance

`normalizeDesign` is synchronous. Budget: **< 50 ms on a 4-container design**.
Guarded by `AI-11` in [`smart-rules-ai.test.ts`](src/__tests__/smart-rules-ai.test.ts).
If future work pushes it past this budget, consider:
- Memoizing scanner output per container (stable identity → cached result).
- Running repair passes in parallel where dependency allows (SR-04 and SR-10
  are independent).
- Moving to a Web Worker for very large designs.
