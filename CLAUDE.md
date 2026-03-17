# ModuHome V1 (MContainer) — Claude Code Project Instructions

## Project Overview

ModuHome is a browser-based 3D architectural engine for designing shipping container homes. Users compose modular containers into multi-level structures, paint surfaces, place furniture, and visualize in real-time 3D.

This is **V1** (codebase: `C:\MHome\MContainer\`). V2 exists at `C:\MHome\` for reference only — do not modify V2 files.

**Stack:** Next.js 16 App Router, React 19, Three.js, Zustand 5 (7 slices) + zundo 2.3 + persist (idb-keyval), Zod 4

**Store:** `src/store/useStore.ts` (252 lines — middleware chain only). All business logic lives in `src/store/slices/` (7 files, ~3700 lines total).

## Ground Rules

1. **Do NOT make changes without browser verification.** `tsc` + `vitest` passing is NOT equivalent to "done." Every user-facing change must be confirmed in the browser before reporting complete.
2. **If anything breaks, revert immediately.** A working app with missing features is more valuable than a broken app with attempted improvements.
3. **No source-scanning tests.** Tests must call real functions and assert return values or state changes. Never use `fs.readFileSync` to check source code patterns.
4. **Run `/simplify` after implementation, before browser verification.** This catches code quality issues, dead code, and missed reuse opportunities.
5. **WalkthroughControls.tsx is NOT a candidate for replacement.** It's 1182 lines of production-quality voxel collision, auto-tour, and FP navigation built on drei's PointerLockControls.
6. **Sprint N+1 cannot start until Sprint N audit artifacts are in context.** Every sprint must pass tsc + vitest + browser verification before the next sprint begins.

## Architecture Reference

Read `MODUHOME-V1-ARCHITECTURE-v2.md` at the start of every session. It is the source of truth for:
- Store architecture and 7-slice structure (§2)
- Rendering pipeline: materialCache → ContainerSkin → ContainerMesh → Scene (§3)
- Voxel data model and coordinate system (§4)
- Keyboard controls reference (§5)
- Feature status (§6)
- Development invariants (§7)
- Known limitations and deferred work (§8)

## Sprint Process

Every sprint follows this structure:
1. **Read the architecture doc** — do not skip this
2. **Complete all required code reads** — write findings before implementation
3. **Second-order analysis** — for every change, answer: what else reads this data? Does undo still work? Could this move a bug from visible to invisible?
4. **Write failing tests first** (TDD) — behavioral tests only
5. **Implement**
6. **Run `/simplify`**
7. **`npx tsc --noEmit` → 0 errors**
8. **`npx vitest run` → all 243 tests pass**
9. **Browser verification** — walk through every checklist item, report PASS/FAIL verbatim
10. **Update `MODUHOME-V1-ARCHITECTURE-v2.md`** if any architectural state changed

## Anti-Patterns

| Pattern | Why Forbidden |
|---------|--------------|
| `useStore(s => s)` | Subscribes to entire state, kills FPS |
| Inline object/array in useStore selector | New reference each render → infinite re-render loop |
| `fs.readFileSync` in tests | Tests code structure, not behavior — silently goes stale |
| Blind UX changes without browser check | Three consecutive failed UX fixes prove this doesn't work |
| `expect(literal).toBe(literal)` | Tautological test — tests nothing |
| Replacing WalkthroughControls.tsx | 1182 lines of tested production code — extend, don't rewrite |
| `page.evaluate()` to trigger UI behavior | Bypasses event handlers — tests store not app. Use page.click(), page.keyboard.press() instead |
| Visual gates without baseline comparison | 'VISUAL: human review' is not a gate. Use pixelmatch against committed baseline |

## Quality Assessment Policy

CURRENT-QUALITY-ASSESSMENT.md is AUTO-GENERATED. Never edit it manually.
To update: `npm run gates && npm run quality`
A feature cannot be rated PRODUCTION without a passing Playwright gate.

## V2 Reference

V2 codebase is at `C:\MHome\` (parent of MContainer). It contains useful reference implementations for:
- Adjacency auto-merge: `src/utils/adjacencyDetection.ts`
- Zod hydration schema: `src/state/schemas.ts`
- Behavioral test patterns: `src/Testing/` (267 behavioral tests, ignore the 38 source-scanning ones)
- Anti-pattern detection tests: `src/Testing/anti-patterns.test.ts`

Do not modify V2 files. Read them for reference only.

## File Locations

| File | Purpose |
|------|---------|
| `MODUHOME-V1-ARCHITECTURE-v2.md` | Living architecture doc (source of truth) |
| `CURRENT-QUALITY-ASSESSMENT.md` | Feature ratings with Playwright evidence |
| `DEAD-CODE-AUDIT.md` | File inventory — active vs dead code |
| `ONBOARDING.md` | New developer quick-start guide |
| `src/store/useStore.ts` | Store entry (252 lines — middleware chain + types) |
| `src/store/slices/` | 7 slice files — all business logic |
| `src/config/materialCache.ts` | PBR material singletons (_themeMats) |
| `src/config/themes.ts` | Theme definitions (Industrial/Japanese/Desert) |
| `src/types/container.ts` | Container, Voxel, VoxelFaces, SurfaceType types |
| `src/components/objects/ContainerSkin.tsx` | Per-voxel 3D face rendering (~2500 lines) |
| `src/components/three/Scene.tsx` | Main scene graph (~1700 lines) |
| `src/components/ui/SmartHotbar.tsx` | 10-slot hotbar + room/material rows (~1400 lines) |

## Keyboard Controls Reference (V1 current)

### Hotbar
| Key | Action |
|-----|--------|
| 1–9 | Hotbar slots 1–9 |
| 0 | Hotbar slot 10 |
| = | Next hotbar row |
| - | Previous hotbar row |
| Tab | Toggle hotbar row |

### View Modes
| Key | Action |
|-----|--------|
| Alt+3 | 3D view |
| Alt+4 | Blueprint view |
| F | Walkthrough (FP) |
| V | Cycle all views |

### Container Manipulation
| Key | Action |
|-----|--------|
| Left-drag (selected) | Move container (drag to reposition, ghost follows cursor) |
| G | Group selected into zone |
| R | Rotate module / rotate container |
| Q | Rotate stamp faces / rotate container |
| Delete | Delete container (or clear voxel if face selected) |

### Painting
| Key | Action |
|-----|--------|
| Alt+click | Eyedropper — pick face material |
| Space | Repeat last stamp (or cycle edges) |
| C | Clear hovered face/block |
| E | Apply active hotbar stamp to hovered block |

### UI
| Key | Action |
|-----|--------|
| [ | Toggle sidebar collapse |
| Scroll | Camera zoom (always — no material cycling) |

### Reserved (do not rebind)
| Key | Reserved for |
|-----|-------------|
| W/A/S/D | FP movement |
| Q/Z | FP fly up/down |
| P | Toggle preview mode |
| B | Toggle build mode (Frame Builder) |
| Ctrl+Z/Y | Undo/Redo |
| PgUp/PgDn | Level slicer |

## UI Change Policy

Before removing ANY toolbar button or sidebar element:
1. Document what it does in a comment in the PR
2. Confirm keyboard shortcut coverage if removing a visual affordance
3. Confirm the action is still accessible by another path
4. Add it to the Playwright toolbar gate if it's being moved, not removed

Removals require explicit sign-off — do not remove UI elements speculatively
during cleanup sprints. When in doubt, move to a secondary location rather than delete.

## Sprint Close Checklist

Every sprint must complete ALL of these before being declared done:

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all tests pass (288+ currently)
3. `node acceptance-gates.mjs` → all gates pass, 0 FAIL
4. `node generate-quality-assessment.mjs` → CURRENT-QUALITY-ASSESSMENT.md updated
5. Read ALL gate screenshots with view tool — describe what each shows
6. If any visual gate shows broken state (uniform color, missing geometry), fix before closing
7. Git tag: `sprint-N-complete` with test count in annotation
8. GATE-REPORT.json committed with `failed: 0`

## Known Regression History

Regressions that have occurred in past sprints. Check these specifically during verification:

| Bug | Root Cause | Fix | Sprint |
|-----|-----------|-----|--------|
| Camera brown/blue screen after right-drag | TRUCK mode pushes target to ground, viewport fills with ground/sky | CameraFloorGuard: target Y >= 0.3, angle guard <= 70°, XZ radius <= 40, truckSpeed 0.5 | 8 |
| Container disappears during drag | `if (isBeingDragged) return null` hides original | Keep original visible at 30% opacity; ghost follows cursor | 8 |
| Gate passes but screenshot shows failure | G15 checked numeric values only, not visual output | readPixels color variance check: fail if >85% pixels same color | 8 |
| Gates contaminated by prior gate state | G15 right-drag moves camera, all subsequent gates inherit bad camera | Camera reset (btn-reset click + position restore) between destructive gates | 8 |
| Start Fresh button broken but gates pass | Gates called `store.addContainer()` directly, bypassing broken button | Sprint 8 principle: page.evaluate() for reading only, never triggering behavior | 8 |
| isExteriorFace n/s↔e/w swapped | row=X axis but n/s was mapped to rows instead of e/w | Correct: e→row=BODY_ROW_END, w→row=BODY_ROW_START | 9 |
| Extension platforms/moats rendering | Extension top/bottom returned true from isExteriorFace | Extension top/bottom now return false | 10 |
| Stale baselines cause visual gate failures | Scene changes without baseline recapture | Run `npm run baselines` after any visual change, commit PNGs | 8 |

## Camera Architecture

Three mutually exclusive camera modes, switched by `viewMode` in store:

| Mode | Controller | Mount Location | Input |
|------|-----------|----------------|-------|
| **Realistic3D** (Design) | drei `<CameraControls>` (orbit) | `RealisticScene` | Left-drag=rotate, Right-drag=TRUCK pan, Scroll=dolly |
| **Blueprint** | `<OrthographicCamera>` + auto-fit | `CameraController` | Top-down only |
| **Walkthrough** (Walk) | drei `<PointerLockControls>` + WASD | `WalkthroughScene` | Mouse look, WASD move, Q/Z fly, Shift sprint |

### Orbit Mode Helper Components (RealisticScene only)

| Component | Purpose | Key Invariant |
|-----------|---------|---------------|
| `CameraTargetLerp` | Smoothly moves orbit target when selection changes | **Settle-and-release**: lerps toward new target, then stops. Does NOT continuously override — user can freely TRUCK/WASD after settling. |
| `CameraBroadcast` | Saves/restores 3D camera across view switches; broadcasts angles to store ~10Hz | Uses `controlsRef` pattern (not ref prop) — safe during React unmount cleanup. |
| `CameraFloorGuard` | NaN recovery + `__camDiag` diagnostic exposure | Pure safety net — no user-visible constraints. |
| `KeyboardPanControls` | WASD=horizontal pan, Arrows=orbit rotate in 3D mode | Only mounted when `viewMode !== Walkthrough`. Uses camera-controls API (setPosition/setTarget), not direct mutation. |

### Camera Safety Layers (cameraConstants.ts)

1. **Polar angle clamp**: `minPolarAngle`/`maxPolarAngle` on `<CameraControls>` props — prevents ground/sky fill
2. **Distance clamp**: `minDistance=3` / `maxDistance=60`
3. **Target Y clamp**: `CAMERA_TARGET_MIN_Y=0.3` enforced in CameraTargetLerp
4. **NaN recovery**: CameraFloorGuard stores last-known-good, restores on NaN detection

Mouse buttons configured via `CAMERA_MOUSE_BUTTONS` prop (not imperative useEffect):
- Left: ROTATE (1), Right: TRUCK (2), Middle: TRUCK (2), Wheel: DOLLY (16)
- truckSpeed: 0.5 (reduced from default 2.0)

### Anti-Patterns (Camera-Specific)

| Pattern | Why Broken | Correct Approach |
|---------|-----------|-----------------|
| `CameraTargetLerp` calling `setTarget()` every frame | Fights TRUCK/WASD — user can't pan | Settle-and-release: stop after reaching target |
| Ref props for camera components | React 19 nulls refs during unmount → TypeError crashes canvas | `useThree().controls` + `controlsRef = useRef(controls)` pattern |
| `boundaryEnclosesCamera = true` | Over-constrains TRUCK — camera position locked in box | Removed. Polar angle + distance constraints are sufficient |
| Direct `camera.position` mutation in orbit mode | camera-controls overwrites from internal state next frame | Use `cc.setPosition()` / `cc.setTarget()` API |
