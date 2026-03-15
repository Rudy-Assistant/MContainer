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
| Shift+G | Grab mode (arrows move, Enter confirm, Esc cancel) |
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
| Scroll | Cycle face material / block preset |

### Reserved (do not rebind)
| Key | Reserved for |
|-----|-------------|
| W/A/S/D | FP movement |
| Q/Z | FP fly up/down |
| E | Apply hotbar to hovered block |
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
