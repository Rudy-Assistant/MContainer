# Simplified UI + Graphics Enhancement — Design Spec

**Date:** 2026-03-28
**Branch:** `variant/brother`
**Approach:** Parallel UI (new component tree, shared Zustand store)

---

## 1. Goals

1. **Anyone can build** — a first-grader can place containers and paint walls
2. **Big, obvious buttons** — bottom tab bar with 5 modes, large touch-friendly cards
3. **Progressive disclosure** — UI grows as the user does more (no toggle)
4. **Enhanced graphics** — materials, lighting, post-processing, geometry detail
5. **Zero regression** — existing `src/components/ui/` untouched

## 2. Target Audience

Mixed / family. Kids navigate the simple mode. Adults reach power features
naturally through progressive disclosure. The existing Advanced UI stays
available as a fallback (route or feature flag).

---

## 3. Architecture

### 3.1 File Structure

```
src/components/
  simple/                     # NEW — entire simplified UI
    SimpleLayout.tsx           # Root layout: canvas + panel + tab bar
    TabBar.tsx                 # Bottom tab bar (5 tabs, 80px)
    SlidePanel.tsx             # Slide-up panel with drag handle
    TopPill.tsx                # Floating undo/redo/save pill
    ProgressiveGate.tsx        # Tracks milestones, controls unlocks
    tabs/
      BuildTab.tsx             # Container type cards + "Your Containers" list
      PaintTab.tsx             # Material category cards + swatch grid
      FurnishTab.tsx           # Furniture catalog cards (doors/windows/furniture)
      LookTab.tsx              # Theme cards + time slider + ground picker
      ExploreTab.tsx           # View mode cards (3D / Blueprint / Walk)
    shared/
      BigCard.tsx              # Reusable large card component (icon + label + action)
      ActionButton.tsx         # Large tappable button (48px icon + label)
      UnlockToast.tsx          # "Feature unlocked!" notification
      CategoryRow.tsx          # Horizontal scrollable row of cards
  ui/                          # EXISTING — untouched
  three/                       # SHARED — graphics improvements here
    materials/
      PBRMaterialFactory.ts    # NEW — enhanced PBR material builder
    geometry/
      BeveledFrame.tsx         # NEW — beveled container frame edges
      TrimDetail.tsx           # NEW — corner trim and edge caps
    lighting/
      LightProbeGrid.tsx       # NEW — interior light probes
      ContactShadowPlane.tsx   # NEW — soft contact shadows (not old ContactShadows)
    postprocessing/
      EnhancedStack.tsx        # NEW — improved post-processing pipeline
```

### 3.2 Routing / Entry Point

```tsx
// src/app/page.tsx — add a layout selector
const uiMode = useStore(s => s.uiMode); // 'simple' | 'advanced'

return uiMode === 'simple'
  ? <SimpleLayout />
  : <AdvancedLayout />;  // existing TopToolbar + Sidebar + BottomDock
```

Default: `'simple'`. Setting stored in `environmentSlice` and persisted.
A small gear icon in the TopPill lets users switch to Advanced mode.

### 3.3 Store Additions

```ts
// environmentSlice additions
uiMode: 'simple' | 'advanced';           // default 'simple'
setUiMode: (mode: 'simple' | 'advanced') => void;

// NEW: progressive disclosure state (persisted)
milestones: {
  containerPlaced: boolean;    // unlocks PAINT + FURNISH tabs
  materialApplied: boolean;    // unlocks EXPLORE tab
  containerStacked: boolean;   // unlocks Stack button in BUILD
  multipleContainers: boolean; // unlocks Move + Model Homes
  furniturePlaced: boolean;    // unlocks interior features in LOOK
};
setMilestone: (key: keyof Milestones, value: boolean) => void;
```

Milestones are set automatically by existing store actions (addContainer,
paintFace, stackContainer, etc.) via a `milestoneMiddleware` that wraps
the store and fires `setMilestone` on relevant state transitions.

---

## 4. Tab Bar Design

### 4.1 Specs

- Fixed bottom, 80px tall, full width
- 5 tabs: BUILD | PAINT | FURNISH | LOOK | EXPLORE
- Each tab: 48px icon + 14px bold label
- Active: accent color (#2563eb) fill, 1.1x scale
- Inactive: gray (#94a3b8) icons
- Locked tabs: dimmed with small lock badge, tap shows tooltip "Add a container first!"
- Tap active tab again: dismisses slide panel (canvas fullscreen)

### 4.2 Tab Icons

| Tab     | Icon     | Label    |
|---------|----------|----------|
| BUILD   | Cube+    | Build    |
| PAINT   | Palette  | Paint    |
| FURNISH | Armchair | Furnish  |
| LOOK    | Sun      | Look     |
| EXPLORE | Eye      | Explore  |

Icons: Lucide React (already available via Next.js ecosystem) at 48px.

### 4.3 Progressive Unlock Order

1. **Start:** BUILD + LOOK active
2. **After first container placed:** PAINT + FURNISH unlock (pop animation + toast)
3. **After first material applied:** EXPLORE unlocks
4. All tabs remain unlocked permanently once unlocked (persisted)

---

## 5. Tab Designs

### 5.1 BUILD Tab

**Top section — "Add a Container":**
- 3 large cards in horizontal scroll: 20ft Standard, 40ft Standard, 40ft High Cube
- Each card: ~120px wide, container silhouette illustration, name, dimensions, big "+" button
- Tap "+" → container auto-placed adjacent to last container (smart placement)

**Bottom section — "Your Containers":**
- Vertical list of placed containers
- Each row: container icon, name ("Container 1 (40ft)"), Delete button, Rotate button
- Tap row → select in 3D, camera pans to it
- Selected row: accent left-border highlight

**Progressive reveals:**
- 2+ containers → "Stack" arrow-up button on each row
- 3+ containers → "Model Homes" gallery at bottom (Great Room, Studio, Loft presets)

### 5.2 PAINT Tab

**Top section — "Choose a Style":**
- 3-4 large theme cards in horizontal scroll: Industrial, Japanese, Desert, Coastal
- Each card: color swatch strip + name + "Apply" button
- Applying a theme paints all unpainted faces with that theme's defaults

**Bottom section — "Paint Surfaces":**
- Category buttons row: Walls | Floor | Ceiling | Exterior
- Below: grid of material swatch cards (large 80px squares with material preview + name)
- Tap swatch → enters paint mode (cursor becomes brush icon)
- Tap any face in 3D to apply
- "Paint All" button for bulk application to all faces of that category
- Clear/Undo buttons prominent

**Progressive reveals:**
- After painting 5+ faces → "Custom Colors" color picker appears
- After using 2+ themes → "Palette" save/load appears

### 5.3 FURNISH Tab

**Top section — Category cards (large, horizontal scroll):**

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  🚪      │ │  🪟      │ │  🪑      │ │  💡      │
│  Doors   │ │ Windows  │ │ Furniture│ │ Lights   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

- Tap category → expands to show items in that category below
- Each item: large card with SVG thumbnail, name, one-tap place button

**Bottom section — Selected category items:**
- Horizontal scrollable strip of item cards
- Tap item → enters placement mode
- Tap a wall/floor in 3D to place
- Drag to reposition (furniture only)

**Progressive reveals:**
- After placing 3+ items → "Recently Used" bar appears at top
- After placing stairs → "Electrical" category unlocks (outlets, switches)

### 5.4 LOOK Tab

**Time of Day — big hero slider:**
```
  🌅 ━━━━━━━━━━●━━━━━━━━━━ 🌙
  6am              3pm        10pm
       "Afternoon Sun"
```
- Full-width slider with sun/moon endpoints
- Large thumb (24px), labeled with current time + descriptive name
- Dragging updates scene in real-time

**Theme preset cards (below slider):**
- Same cards as PAINT tab theme section but focused on environment
- Industrial, Japanese, Desert — affect sky, ground, atmosphere

**Ground texture cards:**
- Horizontal scroll: Grass, Concrete, Gravel, Sand, Wood Deck
- Tap to apply

**Progressive reveals:**
- After trying 2+ times of day → "Golden Hour" and "Night Mode" quick-pick buttons
- After using walkthrough → "Fog" and "Weather" controls appear

### 5.5 EXPLORE Tab

**3 large view mode cards:**

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│             │ │             │ │             │
│  🔄 3D     │ │  📐 Blueprint│ │  🚶 Walk   │
│  Orbit View │ │  Top-Down   │ │  Inside     │
│             │ │             │ │             │
│ [ACTIVATE]  │ │ [ACTIVATE]  │ │ [ACTIVATE]  │
└─────────────┘ └─────────────┘ └─────────────┘
```

- Active mode card gets accent border + "Active" badge
- Each card: icon, name, one-line description, Activate button
- Walkthrough card shows WASD hint when activated

**Below cards:**
- Screenshot button (captures current view)
- Share button (generates share URL)
- Export button (GLB download)

**Progressive reveals:**
- After first walkthrough → "Auto Tour" button appears
- After exporting → "Quality Settings" (Low/Med/High) appears

---

## 6. Slide-Up Panel

### 6.1 Specs

- Anchored above tab bar
- Default height: 30% of viewport when a tab is active
- Drag handle (12px wide pill, centered) at top
- Drag up → 50% height. Drag down → dismiss (spring snap).
- Swipe down on content → dismiss
- Background: `var(--surface)` with 12px top border-radius
- Subtle box-shadow up

### 6.2 Behavior

- Tab tap when panel closed → panel slides up (300ms spring)
- Tab tap when panel open + same tab → panel slides down
- Tab tap when panel open + different tab → cross-fade content (no close/reopen)
- Panel content scrolls independently (overflow-y auto)

---

## 7. Top Pill (Floating Controls)

```
  ┌──────────────────────┐
  │  ↩️  ↪️  💾  ⚙️      │
  │ Undo Redo Save Gear  │
  └──────────────────────┘
```

- Fixed top-right, 48px tall pill shape
- 4 icon buttons: Undo, Redo, Save, Settings gear
- Semi-transparent background (backdrop-blur)
- Gear opens a small dropdown: Switch to Advanced UI, Quality, Dark Mode

---

## 8. Progressive Disclosure System

### 8.1 Milestone Tracking

```ts
interface Milestones {
  containerPlaced: boolean;     // triggers: addContainer
  materialApplied: boolean;     // triggers: paintFace, applyPalette
  containerStacked: boolean;    // triggers: stackContainer
  multipleContainers: boolean;  // triggers: addContainer (count >= 2)
  furniturePlaced: boolean;     // triggers: addFurniture
  exploredWalkthrough: boolean; // triggers: setViewMode('walkthrough')
  exportedDesign: boolean;      // triggers: exportGLB, shareUrl
}
```

### 8.2 Milestone Middleware

A zustand middleware that listens to state transitions and auto-sets milestones:

```ts
const milestoneMiddleware = (config) => (set, get, api) => {
  const wrappedSet = (partial, replace) => {
    set(partial, replace);
    const state = get();
    // Check containers count
    if (Object.keys(state.containers).length >= 1 && !state.milestones.containerPlaced) {
      set({ milestones: { ...state.milestones, containerPlaced: true } });
    }
    // ... similar checks for other milestones
  };
  return config(wrappedSet, get, api);
};
```

### 8.3 Unlock Animations

- Lock badge on tab fades out with scale-down
- Tab icon does a brief "pop" (scale 1 → 1.3 → 1, 400ms)
- Toast slides up from bottom: "PAINT unlocked! Customize your walls."
- Toast auto-dismisses after 3 seconds

### 8.4 Feature Gates

| Milestone              | Unlocks                                         |
|------------------------|--------------------------------------------------|
| containerPlaced        | PAINT tab, FURNISH tab                           |
| materialApplied        | EXPLORE tab                                      |
| multipleContainers     | Move button, Model Homes gallery                 |
| containerStacked       | Stack button in BUILD, Level Slicer              |
| furniturePlaced        | Electrical category in FURNISH, interior LOOK    |
| exploredWalkthrough    | Auto Tour button in EXPLORE                      |
| exportedDesign         | Quality Settings in EXPLORE                      |

---

## 9. Graphics Enhancements

All improvements go in `src/components/three/` — shared by both Simple and
Advanced UIs. Quality tier system gates performance cost.

### 9.1 Materials (PBRMaterialFactory)

**Current state:** `materialCache.ts` singleton with flat `MeshStandardMaterial`.
Basic procedural normal maps (corrugation, brushed metal).

**Enhancement:**

```ts
// PBRMaterialFactory.ts — replaces inline material creation
export function createPBRMaterial(config: PBRConfig): THREE.MeshStandardMaterial {
  // Quality-aware: Low=flat color, Medium=1K textures, High=2K+detail maps
}

interface PBRConfig {
  baseColor: number;
  metalness: number;
  roughness: number;
  texturePath?: string;       // base directory for texture maps
  normalScale?: number;       // 0-2, default 1
  aoIntensity?: number;       // ambient occlusion map strength
  displacementScale?: number; // only on High quality
  envMapIntensity?: number;
  repeatX?: number;
  repeatY?: number;
}
```

**New material detail levels:**

| Material  | Low                | Medium                    | High                         |
|-----------|--------------------|---------------------------|------------------------------|
| Steel     | Flat #333 + procedural normal | 1K corrugated diffuse+normal+rough | 2K KTX2 + AO + displacement |
| Wood      | Flat #8B6914       | 1K grain diffuse+normal   | 2K + AO + parallax occlusion |
| Glass     | Flat + transmission | + roughness map + env     | + thickness map + caustics hint |
| Concrete  | Flat #808080       | 1K diffuse+normal+rough   | 2K + AO + micro-displacement |
| Interior  | Flat per-finish    | 1K per finish family      | 2K + detail normal overlay   |

**Texture pipeline:**
- Textures stored in `public/textures/{1k,2k}/{material}/` (already structured)
- KTX2 transcoder (BasisU) for High quality (smaller downloads, GPU-compressed)
- Progressive loading: show flat color immediately, swap in texture when loaded
- `useTexture` wrapped in ErrorBoundary (lesson learned from Sprint 8)

### 9.2 Lighting

**Current:** Single directional SunLight + per-container interior SpotLights.

**Enhancements:**

1. **Environment HDRI upgrade:**
   - Current: bundled low-res HDRI or CubeCamera
   - New: 3 time-bracketed HDRIs (dawn, day, dusk) at 1K resolution
   - Crossfade between HDRIs as time-of-day slider moves
   - Night: procedural star field (existing Sky+Stars, but add moonlight directional)

2. **Contact shadow plane (new):**
   - Soft circular shadow under each container (not the old `ContactShadows` component)
   - Custom shader: gaussian blur of a depth-only render from below
   - Quality: Low=none, Medium=512px shadow, High=1024px shadow
   - Eliminates the "floating container" look

3. **Light probes (High quality only):**
   - `LightProbeGrid.tsx`: place 3 SH probes per container interior
   - Bake on container add/theme change (async, not per-frame)
   - Gives indirect lighting bounce inside containers
   - Visible difference: steel walls reflect warm interior light

4. **Interior light improvements:**
   - Ceiling lights: add IES-style angular falloff (cosine lobe, not point)
   - Warm/cool color temperature tied to time-of-day
   - Volumetric glow sprite around each fixture (billboard quad, not raymarched)

### 9.3 Post-Processing

**Current:** N8AO + Bloom + ACESFilmic ToneMapping.

**Enhancements:**

```tsx
// EnhancedStack.tsx
<EffectComposer>
  {/* AO: existing N8AO but with tuned parameters */}
  <N8AO
    aoRadius={quality === 'high' ? 1.2 : 0.8}
    intensity={1.2}
    halfRes={quality !== 'high'}
    denoiseRadius={quality === 'high' ? 3 : 1}
  />

  {/* NEW: SMAA anti-aliasing (replaces nothing — currently no AA) */}
  {quality !== 'low' && <SMAA preset={quality === 'high' ? SMAAPreset.ULTRA : SMAAPreset.MEDIUM} />}

  {/* Bloom: tighter threshold for architectural look */}
  <Bloom
    luminanceThreshold={0.9}
    luminanceSmoothing={0.05}
    mipmapBlur
    intensity={0.3}
  />

  {/* NEW: Vignette — subtle darkening at edges for photo quality */}
  {quality === 'high' && <Vignette offset={0.3} darkness={0.4} />}

  {/* Tone mapping: keep ACES Filmic */}
  <ToneMapping mode={ToneMappingMode.ACESFilmic} />
</EffectComposer>
```

**Key changes:**
- SMAA anti-aliasing eliminates jagged edges (biggest single visual win)
- Bloom tightened — current 0.85 threshold causes too much glow on steel
- Vignette gives a "camera lens" feel on High quality
- N8AO denoise radius increased for smoother ambient occlusion

### 9.4 Geometry Detail

**Current:** Box geometry for everything — voxel faces are flat planes, frame
is square tube (BoxGeometry).

**Enhancements:**

1. **Beveled frame edges (`BeveledFrame.tsx`):**
   - Replace BoxGeometry posts/rails with ExtrudeGeometry + bevel
   - Bevel radius: 0.01m (subtle chamfer, not rounded)
   - Only on Medium/High quality (Low keeps BoxGeometry)
   - Merged geometry per container (single draw call via BufferGeometryUtils.mergeGeometries)

2. **Corner trim (`TrimDetail.tsx`):**
   - Small L-shaped trim pieces at container corners (where walls meet)
   - Simple BoxGeometry strips, instanced (negligible draw cost)
   - Gives containers a "finished" look vs. raw meeting edges
   - Only on High quality

3. **Edge softening (shader-based, no geometry):**
   - Custom MeshStandardMaterial `onBeforeCompile` shader injection
   - Darkens sharp edges based on normal discontinuity (screen-space)
   - Cheap (fragment shader only), works on all quality tiers
   - Eliminates the CG "too perfect" look

---

## 10. Shared Components (BigCard, ActionButton)

### 10.1 BigCard

```tsx
interface BigCardProps {
  icon: React.ReactNode;      // Lucide icon or SVG
  label: string;
  description?: string;       // one-line subtitle
  action?: {
    label: string;            // button text ("+ ADD", "Apply", "Activate")
    onClick: () => void;
  };
  locked?: boolean;           // dimmed with lock badge
  lockMessage?: string;       // tooltip on tap when locked
  active?: boolean;           // accent border
  size?: 'medium' | 'large';  // medium=100px, large=140px wide
}
```

- Border-radius 16px, padding 16px
- Background: `var(--surface)`
- Hover: slight lift (translateY -2px) + shadow increase
- Active: accent left border (4px)
- Locked: opacity 0.4, lock icon overlay, tap shows lockMessage tooltip

### 10.2 ActionButton

```tsx
interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'medium' | 'large';  // medium=40px, large=56px height
  disabled?: boolean;
}
```

- Large tap target (minimum 44px per accessibility guidelines)
- Primary: accent fill + white text
- Secondary: border + text only
- Danger: red fill for destructive actions (Delete)

---

## 11. Performance Budget

All graphics enhancements gated by quality tier:

| Budget         | Low     | Medium  | High    |
|----------------|---------|---------|---------|
| Draw calls     | < 50    | < 100   | < 200   |
| Triangles      | < 50K   | < 200K  | < 500K  |
| Texture memory | < 32MB  | < 128MB | < 256MB |
| Post-process   | 0 passes| 2 passes| 4 passes|
| Target FPS     | 60      | 60      | 30+     |
| Shadow maps    | none    | 2048    | 4096    |

GPU auto-detection (`gpuDetect.ts`) selects initial tier.
User can override via Settings gear in TopPill.

---

## 12. CSS / Styling Approach

Follows existing Tailwind CSS v4 + CSS custom variables pattern.

New variables for simple UI:

```css
:root {
  --tab-height: 80px;
  --tab-icon-size: 48px;
  --panel-radius: 12px;
  --card-radius: 16px;
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  --card-shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.12);
  --unlock-pop-scale: 1.3;
  --spring-tension: 180;
  --spring-friction: 22;
}
```

Touch targets: minimum 44px (WCAG 2.1 AAA).
Font sizes: 14px labels, 18px headings, 24px tab icons.
All interactions have visible focus rings for accessibility.

---

## 13. What Changes vs. What Stays

### Changed (new code):
- `src/components/simple/` — entire new UI tree (~12 components)
- `src/components/three/materials/PBRMaterialFactory.ts` — enhanced material builder
- `src/components/three/geometry/BeveledFrame.tsx` — beveled frames
- `src/components/three/geometry/TrimDetail.tsx` — corner trim
- `src/components/three/lighting/LightProbeGrid.tsx` — light probes
- `src/components/three/lighting/ContactShadowPlane.tsx` — soft ground shadows
- `src/components/three/postprocessing/EnhancedStack.tsx` — improved post-processing
- `src/store/slices/environmentSlice.ts` — add `uiMode` + `milestones`
- `src/app/page.tsx` — add layout selector

### Untouched:
- All 34 existing `src/components/ui/` components
- All 7 store slices (except environmentSlice additions)
- All existing tests
- All acceptance gates
- Type definitions
- Config files

---

## 14. Testing Strategy

- **Unit tests:** Each new simple/ component with vitest + React Testing Library
- **Progressive disclosure tests:** milestone middleware fires correctly on state changes
- **Graphics tests:** material factory returns correct quality-tier materials
- **Acceptance gates:** New Playwright gates for simple UI flow (add container → paint → explore)
- **Performance tests:** FPS counter assertions per quality tier with loaded scene

---

## 15. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| KTX2 textures not loading on all GPUs | Broken materials | Fallback chain: KTX2 → JPG → flat color |
| Light probes slow to bake | Stutter on container add | Async bake in requestIdleCallback, show flat lighting until ready |
| Beveled geometry increases draw calls | FPS drop | Merge all frame geometry per container into single buffer |
| Progressive disclosure confusing | Users don't find features | Milestone toast + subtle "new" badge on unlocked tabs |
| Two UI trees drift apart | Maintenance burden | Both read/write same store — UI is presentation only |
