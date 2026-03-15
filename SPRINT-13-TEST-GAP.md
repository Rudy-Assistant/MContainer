# Sprint 13 — Store Test Gap Analysis

**Date:** 2026-03-12
**Total store actions:** 145
**Existing tests:** 164 (19 test files)

## Completely Untested Actions (13)

| Action | Signature | Risk |
|--------|-----------|------|
| `addFurniture` | `(containerId, type, position?, rotation?) => string\|null` | High — furniture rendering depends on this |
| `removeFurniture` | `(furnitureId) => void` | High — dangling furniture IDs |
| `moveFurniture` | `(furnitureId, position) => void` | Medium |
| `renameContainer` | `(id, name) => void` | Low — simple property set |
| `resizeContainer` | `(id, newSize) => void` | High — rebuilds voxel grid |
| `copyVoxel` | `(containerId, voxelIndex) => void` | Medium — clipboard |
| `pasteVoxel` | `(containerId, voxelIndex) => void` | Medium — clipboard + lock check |
| `copyVoxelStyle` | `(containerId, voxelIndex) => void` | Low |
| `convertToPool` | `(containerId) => void` | Medium — transforms entire grid |
| `createGreatRoomDemo` | `() => void` | Low — demo function |
| `toggleVoxelLock` | `(containerId, voxelIndex) => void` | Medium — affects paint guards |
| `isVoxelLocked` | `(containerId, voxelIndex) => boolean` | Medium — query function |
| `saveBlockToLibrary` | `(label, faces) => string` | Medium — library system |

## Actions with Only 1 Test File (18)

| Action | Single Test File |
|--------|-----------------|
| `updateContainerRotation` | container-crud |
| `unstackContainer` | container-crud |
| `toggleDoorState` | hover-door |
| `loadHomeDesign` | user-save |
| `placeModelHome` | model-homes |
| `saveContainerToLibrary` | user-save |
| `exportState` | smart-systems |
| `setTimeOfDay` | view-modes |
| `redo` | undo |
| `selectMultiple` | selection |
| `resetVoxelGrid` | paint |
| `stampFromHotbar` | paint |
| `stampAreaSmart` | paint |
| `setSelectedVoxel` | selection |
| `applySmartRailing` | smart-systems |
| `setAllOuterWalls` | bulk-extensions |
| `toggleRoof` | — (needs verification) |
| `toggleFloor` | — (needs verification) |

## Coverage Plan

New test file: `src/__tests__/store-coverage.test.ts` — 50+ behavioral tests covering:
1. Furniture CRUD (add, remove, move)
2. Container rename + resize
3. Voxel clipboard (copy, paste, style copy)
4. Voxel locking
5. Pool conversion
6. Great Room demo
7. Block library save
8. Import/export round-trip
9. Toggle roof/floor
10. Dollhouse toggle
11. View level
12. Stamp area
13. Frame material (if exists)
