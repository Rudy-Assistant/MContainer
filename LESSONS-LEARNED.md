# ModuHome V1 — Lessons Learned

Hard-won knowledge from debugging sessions. Read before every sprint.

---

## 1. Corrupted IndexedDB Persisted State

**Symptom**: 3D canvas shows green ground but NO container. No console errors. SceneErrorBoundary NOT triggered.
**Root cause**: Store actions that create invalid container configurations (e.g., stacking test leaving 2 containers at same Y position) persist to IndexedDB. On reload, the corrupted state silently prevents rendering.
**Fix**: Clear IndexedDB: `indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name)))`
**Prevention**: Always clean up test containers after programmatic stacking tests. Add guard in `stackContainer` to reject stacking when a container already exists at the target position.

## 2. FaceContextWidget Removal — Stale Webpack Cache

**Symptom**: `ReferenceError: FaceContextWidget is not defined` even after removing the import and JSX.
**Root cause**: Next.js webpack HMR cache retained the old compiled module. Page reloads don't clear the webpack module cache.
**Fix**: Stop dev server, delete `.next/` directory, restart. Or: `rm -rf .next && npm run dev`
**Prevention**: After removing imports/components, always restart the dev server rather than relying on HMR.

## 3. R3F boxGeometry Args Don't Update on Re-render

**Symptom**: Changing `<boxGeometry args={[w, h, d]} />` props doesn't visually update the mesh geometry.
**Root cause**: R3F/Three.js memoizes geometry objects. Changing args creates a new geometry but the old one may be retained by the fiber tree.
**Fix**: Add a `key` prop that changes when args change: `<mesh key={\`post_\${cutScale}\`}>`. This forces React to unmount/remount, creating fresh geometry.
**Prevention**: Always use `key` props on meshes whose geometry dimensions change dynamically.

## 4. CSS Grid `fr` Units Overridden by Content

**Symptom**: Grid cells all appear the same size despite using proportional `fr` values.
**Root cause**: Text content inside grid cells forces minimum widths that override `fr` proportions.
**Fix**: Add `min-width: 0; overflow: hidden;` to grid children.
**Prevention**: Always add `minWidth: 0` to CSS grid children that use `fr` units.

## 5. Border Width Changes Cause Layout Shift

**Symptom**: Hovering a grid cell shifts all adjacent cells.
**Root cause**: Default border is 1px, hover border is 2px. The extra 1px on each side pushes siblings.
**Fix**: Use consistent border width (always 2px) and change only border color on hover.
**Prevention**: Never change border width on hover/focus states. Change color or box-shadow instead.

## 6. React Hooks Called After Early Return

**Symptom**: "Rendered fewer hooks than expected" error.
**Root cause**: `useMemo`/`useEffect`/`useState` called AFTER an early `return null` in a component.
**Fix**: Move all hooks before any conditional returns.
**Prevention**: ALWAYS place hooks at the top of the component, before any `if (...) return null` guards.

## 7. `select()` Action Clearing Multi-Select State

**Symptom**: Bay group selection (multi-voxel) disappears immediately after clicking in Simple mode.
**Root cause**: Clicking a container triggers `select(containerId)` which clears `selectedVoxels`. The 2D grid's `handleBayClick` sets `selectedVoxels`, but `select()` runs on the same event cycle and clears it.
**Fix**: `select()` preserves `selectedVoxels` when re-selecting the same container.
**Prevention**: Audit all store actions for unintended side effects on related state fields.

## 8. Ground Mesh Intercepting `onPointerMissed`

**Symptom**: Clicking empty space doesn't deselect voxels — "afterburn" wireframes persist.
**Root cause**: Ground plane mesh catches all clicks, preventing R3F's `onPointerMissed` from firing.
**Fix**: Add `raycast={() => {}}` to ground meshes so clicks pass through.
**Prevention**: Any large non-interactive mesh (ground, sky, background) should have `raycast={() => {}}`.

## 9. Voxel Preview Dimensions Wrong for Extension Voxels

**Symptom**: Extension voxel preview shows body voxel dimensions (2.0m × 1.2m) instead of extension dimensions (2.9m × 2.0m).
**Root cause**: VoxelPreview3D hardcoded `nW = dims.length / 6` and `nD = dims.width / 2` — correct for body voxels but wrong for extension (halo) voxels.
**Fix**: Compute dimensions based on voxel position: halo cols/rows use `dims.height` for their projection depth.
**Prevention**: Any voxel-dimension computation must check if the voxel is body vs extension.

## 10. Camera Angle Makes Dimensions Look Wrong

**Symptom**: Voxel preview 3D cube appears square despite having 2:1 aspect ratio dimensions.
**Root cause**: Orthographic camera position makes the narrow axis appear the same width as the wide axis.
**Fix**: Position camera to emphasize the wider dimension: `[3, 3.5, 5]` for Z-dominant (showing the 2.0m N/S face as front).
**Prevention**: After changing preview camera, ALWAYS verify visually that the 3D proportions match the dimension labels.

## 11. Dark Mode — Superficial Find-Replace is Not Enough

**Symptom**: Dark mode looks "incomplete" — some panels white, text invisible, scrollbars light.
**Root cause**: Replacing individual color values misses: constants used throughout a file, hover/leave event handlers with hardcoded colors, Tailwind utility classes, and nested component styling.
**Fix**: Replace COLOR CONSTANTS at the top of each file (e.g., `const BG = "var(--surface-alt)"`), which cascades to everything using them. Add scrollbar CSS. Use `var(--token, fallback)` pattern.
**Prevention**: Start dark mode from constants/tokens, not individual style props. Audit with the explore agent to find ALL hardcoded colors before starting.

## 12. Marking Issues Complete Without Visual Verification

**Symptom**: User reports same issue multiple times despite "fix" being committed.
**Root cause**: TSC passing + tests passing ≠ visual correctness. Many UI issues (proportions, alignment, visibility) require actual screenshot verification.
**Prevention**: ALWAYS take a screenshot after each fix and compare against the user's reported issue. If the screenshot doesn't clearly show the fix, don't mark it complete.

---

## Verification Checklist (Use Before Marking Anything Complete)

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all tests pass
3. **Screenshot the specific UI area that was changed**
4. **Compare screenshot to the user's original complaint**
5. If the fix involves store state: verify with `window.__store?.getState()` in browser console
6. If the fix involves 3D rendering: verify with wall cut modes, camera orbit, and walkthrough
7. After stacking tests: ALWAYS clear IndexedDB to prevent corrupted persisted state
