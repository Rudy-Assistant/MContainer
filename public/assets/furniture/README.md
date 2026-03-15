# Furniture Assets

## Naming Convention

`{category}-{item}.glb` — e.g., `kitchen-counter.glb`, `bedroom-bed-double.glb`

## Categories

- `kitchen-*` — Kitchen furniture (counters, sinks, fridges, stoves)
- `bedroom-*` — Bedroom furniture (beds, dressers, nightstands)
- `bathroom-*` — Bathroom fixtures (toilets, sinks, showers, tubs)
- `living-*` — Living room (sofas, coffee tables, TV stands)
- `office-*` — Office (desks, chairs, shelves)
- `dining-*` — Dining (tables, chairs)
- `storage-*` — Storage (shelving, cabinets, wardrobes)
- `stairs-*` — Staircase models

## Recommended Sources (CC0 License)

1. **Kenney.nl Furniture Kit** — https://kenney.nl/assets/furniture-kit
   - 60+ low-poly pieces, consistent style, .glb format
   - Single zip download, CC0 license

2. **KayKit (Kay Lousberg)** — Interior furniture, CC0
3. **Poly Haven** — Higher fidelity models, CC0

## How to Add

1. Download .glb files to this directory
2. Rename following the convention above
3. Update `FURNITURE_CATALOG` in `src/types/container.ts` to add `glb` field
4. FurnitureRenderer automatically loads GLBs with box fallback

## Current State

No .glb models present yet. All furniture renders as colored box placeholders.
