# Contributing to ModuHome

## Development Workflow

### Setup

```bash
cd MContainer
npm install
npm run dev          # http://localhost:3000
```

### Before Every Change

1. Read `MODUHOME-V1-ARCHITECTURE-v2.md` — it's the source of truth for store structure, rendering pipeline, and coordinate systems.
2. Run `npx tsc --noEmit` to confirm you're starting from a clean state.
3. Run `npx vitest run` to confirm all 307 tests pass.

### Making Changes

1. **Write failing tests first** — behavioral tests only (call real functions, assert real outcomes).
2. **Implement the change.**
3. **Type check:** `npx tsc --noEmit` — must be 0 errors.
4. **Run tests:** `npx vitest run` — all tests must pass.
5. **Browser verification** — every user-facing change must be confirmed visually. `tsc` + `vitest` passing is not sufficient.
6. **Run acceptance gates:** `npm run gates` — all gates must pass with 0 failures.

### Sprint Process

Work is organized in sprints. Each sprint follows:

1. Read the architecture doc
2. Complete required code reads — write findings before implementation
3. Second-order analysis — for every change, ask: what else reads this data? Does undo still work?
4. Write failing tests (TDD)
5. Implement
6. `npx tsc --noEmit` -> 0 errors
7. `npx vitest run` -> all pass
8. Browser verification — walk through every checklist item
9. Update `MODUHOME-V1-ARCHITECTURE-v2.md` if architecture changed

## Coding Standards

### State Management

- **Atomic selectors only** — never `useStore(s => s)`. Subscribe to the specific fields you need.
- **No inline objects/arrays in selectors** — creates new references every render, causing infinite loops.
- **Middleware order matters:** Immer (inner) -> Zundo (temporal) -> Persist (outer).
- All business logic belongs in `src/store/slices/`, not in components.

### 3D / Three.js

- Use `<instancedMesh>` directly, not Drei's `<Instances>` for voxel rendering.
- Canvas uses `frameloop="demand"` — call `invalidate()` when the scene needs to re-render.
- Camera modes are mutually exclusive — only one controller mounted at a time.
- All `.glb` files go in `/Public`, referenced as absolute paths.
- Explicit `.dispose()` on geometry updates to prevent memory leaks.

### Testing

- **Behavioral tests only** — test real behavior, not source code structure.
- No `fs.readFileSync` to check code patterns (silently goes stale).
- No `expect(literal).toBe(literal)` (tautological — tests nothing).
- No `page.evaluate()` to trigger UI behavior in E2E tests — use `page.click()`.
- Mock only external boundaries (IndexedDB via idb-keyval). Don't mock internal modules.

### UI

- Before removing any toolbar button or UI element, confirm the action is still accessible by another path.
- `WalkthroughControls.tsx` is production-locked — extend it, never replace it.
- Hotbar uses CSS `calc()` for sidebar offset — no JS resize listeners.
- Selection highlighting must show consistently in: MatrixEditor grid, VoxelPreview3D, and the 3D viewport.

## Anti-Patterns

| Pattern | Why It's Forbidden |
|---------|-------------------|
| `useStore(s => s)` | Subscribes to entire state, kills FPS |
| Inline object/array in selectors | New reference each render -> infinite loop |
| `fs.readFileSync` in tests | Tests structure not behavior, goes stale |
| Replacing WalkthroughControls.tsx | 1182 lines of tested production code |
| `page.evaluate()` for UI triggers | Bypasses event handlers |
| Visual gates without baseline comparison | "Human review" is not a gate |

## Quality Assessment

`CURRENT-QUALITY-ASSESSMENT.md` is auto-generated. Never edit manually.

```bash
npm run gates      # Run acceptance gates
npm run quality    # Regenerate quality assessment
npm run baselines  # Recapture visual baselines after visual changes
```

A feature cannot be rated PRODUCTION without a passing Playwright gate.

## File Ownership

These components have clear ownership — don't duplicate or relocate:

| Component | Owner File | Notes |
|-----------|-----------|-------|
| Spatial/Block Grid | `MatrixEditor.tsx` | Never duplicate in FinishesPanel |
| VoxelPreview3D | `FinishesPanel.tsx` | 3D preview of selected voxel/bay |
| Interior Finishes tabs | `finishes/FinishesPanel.tsx` | Tab content only, no grid |
| Hotbar | `SmartHotbar.tsx` | CSS calc() for offset |
