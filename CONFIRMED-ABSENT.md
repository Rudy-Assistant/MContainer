# Confirmed Absent Features — V1 vs MEMORY.md Claims

This document tracks features referenced in MEMORY.md or old documentation that have been verified against the V1 codebase.

---

## Actually Implemented (Previously Claimed Absent)

Features incorrectly assumed missing during sprint planning, causing wasted audit time.

| Feature | Evidence |
|---------|----------|
| Container frame (posts + beams) | ContainerMesh.tsx FramePosts + FrameBeams, PBR frameMat |
| toggleStructuralElement | containerSlice.ts, right-click toggle, structureConfig.hiddenElements |
| CssVoxelIcon (3D hotbar icons) | SmartHotbar.tsx |
| WalkthroughControls WASD | WalkthroughControls.tsx (no pointerLock guard) |

**Lesson**: Before any sprint task says "build X from scratch" or "X is missing", the agent must grep the codebase for X. The pre-flight audit exists for exactly this reason and must never be skipped.

---

## Confirmed Absent in V1

Features referenced in MEMORY.md that do NOT exist in V1 (MContainer/) code.

| Feature | Claimed In | Evidence |
|---------|-----------|---------|
| bitECS | MEMORY.md | Not in package.json, 0 source hits |
| @react-three/csg | MEMORY.md | V2 package.json only, not in MContainer/package.json |
| @react-three/rapier | MEMORY.md | V2 package.json only, not in MContainer/package.json |
| immer middleware (zustand) | MEMORY.md rule #1 | immer is in deps but not used as zustand middleware — V1 uses partial state merging |
| camera-controls (npm) | MEMORY.md | drei CameraControls used instead of standalone camera-controls npm package |
| bvhecctrl | MEMORY.md | V2 package.json only |
| zod schemas for hydration | MEMORY.md | Zod is in deps but store hydration uses manual validation, not Zod schemas |
| @use-gesture/react | MEMORY.md | V2 package.json only |
| react-hotkeys-hook | MEMORY.md | V2 package.json only |
| motion (LazyMotion) | MEMORY.md | V2 package.json only |
| @react-spring/three | MEMORY.md | V2 package.json only |

**Note:** MEMORY.md describes V2 architecture. V1 (MContainer/) has a different, simpler stack. The MEMORY.md entries above are accurate for V2 but do not apply to V1.

---

## Why This Matters

MEMORY.md is loaded into every conversation. When it describes V2 features as if they're universal, the agent may:
1. Skip implementing something that V1 actually needs
2. Waste time verifying V2 features exist in V1
3. Plan sprints that "build from scratch" features that already exist

This registry prevents those failure modes by documenting what's real vs. what's V2-only.
