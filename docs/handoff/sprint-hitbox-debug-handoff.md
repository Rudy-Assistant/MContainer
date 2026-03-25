# Sprint: Hitbox Debug & Highlight Polish — Handoff

## What Was Done

### Original 5 Issues (from design-pass sprint)
1. **Grid Orientation** — Reversed deck numbering (Deck 3 = nearest camera), added FRONT/BACK labels to SpatialVoxelGrid and MatrixEditor
2. **Container Presets** — 3-column grid with larger ContainerPresetCard wrapper, SVG size 48
3. **Context-Aware Tabs** — `selectWithFace` batched action in selectionSlice, unified tab routing in FinishesPanel (face priority over element type)
4. **Hotbar Styling** — Rounded frames, bold white #fff labels, removed conditional color logic
5. **Ghost Preview** — `stampPreview` state in uiSlice, `StampGhost` component in HoverPreviewGhost

### Highlight System Fixes
- **Blue color scheme** for all selection highlights (was cyan/amber mix)
- **Floor quadrant strips** — wall hover/select shows only the half of floor nearest the wall (not full floor)
- **Bay select floor highlight** — blue wireframe + blue floor rect when bay selected without face

### Debug Wireframe Overlay (Task 5 — extensively reworked)
- **Floor tiles for all 32 voxels** with outer rect + inner center zone + quadrant boundary lines
- **Simple mode**: bay-grouped tiles (15 merged AABBs from computeBayGroups)
- **Detail mode**: per-voxel tiles (32 individual tiles)
- **Ceiling toggle**: tiles move to ceiling level when inspectorView === 'ceiling'
- **mHit material toggle**: ContainerSkin's actual hitbox meshes become visible (blue, 15% opacity) in debug mode
- **BASEPLATE_STRIP = 0.53**: wall quadrant hitbox strips are wide for easy wall clicking

### Escape Cascade (already implemented, verified)
- Escape with face selected → clears face, keeps voxel/bay
- Escape with voxel/bay selected → clears elements, keeps container
- Escape with container selected → clears everything

## Key Files Modified
| File | Changes |
|------|---------|
| `src/config/bayGroups.ts` | Deck numbering reversed (3-i) |
| `src/components/ui/finishes/SpatialVoxelGrid.tsx` | Labels + FRONT/BACK |
| `src/components/ui/MatrixEditor.tsx` | FRONT/BACK labels |
| `src/components/ui/finishes/ContainerPresetCard.tsx` | NEW — wrapper card |
| `src/components/ui/finishes/ContainerPresetRow.tsx` | 3-col grid, larger SVGs |
| `src/store/slices/selectionSlice.ts` | `selectWithFace` action |
| `src/components/ui/finishes/FinishesPanel.tsx` | Unified tab routing, face priority |
| `src/components/objects/ContainerSkin.tsx` | `selectWithFace` calls, mHit debug toggle, BASEPLATE_STRIP=0.53 |
| `src/components/ui/BottomPanel.tsx` | Card styling, white labels |
| `src/components/ui/SmartHotbar.tsx` | clearStampPreview calls |
| `src/store/slices/uiSlice.ts` | stampPreview state |
| `src/components/objects/HoverPreviewGhost.tsx` | StampGhost component |
| `src/components/three/DebugOverlay.tsx` | Floor tiles + quadrants + ceiling toggle |
| `src/components/three/ContainerMesh.tsx` | Blue highlights, quadrant floor strips, hlFloorSelectMat |

## Test Status
- 726/726 tests pass
- 0 type errors
- 87 test files

## Known Remaining Issues
1. **Wall face selection from steep camera angles** — floor edge strips (BASEPLATE_STRIP=0.53) are at Y=0.05, so from above-looking-down the roof hitbox wins. Clickable wall panels on the vertical faces themselves do not have hover/click handlers — only floor-level edge strips do.
2. **Extension voxel positions in debug** — Extensions render at their fold-out positions (far from container body). V2 showed these as wrapping tightly around the container edge. This is a ContainerSkin architecture issue.
3. **Ghost preview face dimensions** — StampGhost uses approximate box dimensions, not exact voxel face dims from getVoxelLayout.
4. **S/M toggle** in toolbar is Smart/Manual mode — user confirmed to leave as-is.
