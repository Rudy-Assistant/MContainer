# ModuHome - Modular Shipping Container Home Configurator

## Role & Objective
A professional-grade, web-based modular shipping container home configurator built by a Senior Creative Technologist. Bridges the gap between "architectural sandbox" and "feasibility planner," offering deep logic for structural modifications, solar analysis, and dynamic cost estimation.

## Technical Stack
- **Core:** React 19 (Next.js App Router), TypeScript
- **3D Engine:** React Three Fiber (R3F), Drei (Gizmos/Controls/Environment)
- **State Management:** Zustand (entire house configuration = serializable JSON tree)
- **Styling:** Tailwind CSS (Material Design system: Slate Blue `#475569` backgrounds, Bright Blue `#3B82F6` accents)

## Core Architecture: "The Multi-Size Grid"

### Container Options (Industry Standards)
| Type | Dimensions (L x W x H) | Notes |
|------|------------------------|-------|
| 20ft Standard | 6.06m x 2.44m x 2.59m | |
| 40ft Standard | 12.19m x 2.44m x 2.59m | |
| 40ft High-Cube | 12.19m x 2.44m x 2.90m | **Default** |

### The Slot System
- Long walls: divided into **1.5m "bays"** (~4 bays for 20ft, ~8 bays for 40ft)
- Short walls: **2 fixed bays**

## Feature Requirements (Modules)
All components have a `cost_factor` and `thermal_value`.

1. **Panel_Solid:** Corrugated steel (Default)
2. **Panel_Glass:** Fixed Window or Sliding Glass Door
3. **Advanced Flap System (CRITICAL):**
   - `HingedWall` component with `foldsDown` and `foldsUp` boolean props
   - `foldsDown=true`: Floor extension, checks ground collision
   - `foldsUp=true`: Rigid awning or upper-level deck base
   - Both: "Gull Wing" open-air room

## Environment & Solar Analysis
1. **Time of Day:** Slider (00:00-24:00) rotating HDRI for Day/Night cycles
2. **Cardinal Orientation:** "North Offset" slider (0-360 degrees)
   - Compass gizmo in top-right corner, real-time updates
   - Purpose: Visualize sunlight entry for passive heating/cooling

## Interaction: Grouping & Zoning
1. **Zone Logic:**
   - Multi-Select (Shift+Click) adjacent containers → "Group" them
   - Name groups (e.g., "Guest Wing," "Kitchen Block")
   - Clicking any part selects whole unit for moving/rotating
2. **Volume Merging:**
   - Grouped containers sharing a wall → auto-hide internal panels → open floor plan

## View Modes & Visual Language
1. **3D Mode:** Realistic PBR materials (Steel, Glass, Wood)
2. **Blueprint Mode (2D Top-Down):**
   - Orthographic Camera + schematic shader
   - **Color Coding:**
     - Standard Walls: Thick Black Lines
     - Windows/Glass: Cyan Blue lines
     - Fold-DOWN Flaps (Decks): Semi-transparent **Orange** fill
     - Fold-UP Flaps (Awnings): Dashed outline with **Yellow** hatch

## Dynamic Pricing Architecture
- **Config:** `pricing_config.json` with base rates (`steel_20ft: 2500`, `cut_fee: 500`)
- **Budget Settings:** Modal for user to override base rates with local prices
- **Real-Time Estimator:** Floating widget "Est. Cost: $X - $Y", instant updates

## Execution Plan
| Phase | Scope |
|-------|-------|
| **Phase 1** | `useStore` state management for multiple container sizes and groupings |
| **Phase 2** | R3F Scene with Day/Night cycle and North slider |
| **Phase 3** | `HingedWall` logic (Up/Down/Both) and Blueprint Shader |
| **Phase 4** | UI Overlay (Grouping, Renaming, Pricing) |
