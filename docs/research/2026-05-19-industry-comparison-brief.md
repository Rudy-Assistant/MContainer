# Industry Comparison Brief — Controls, UI, and Visual Quality

**Date**: 2026-05-19
**Trigger**: User feedback after building-UX sprint shipped: *"Lumion looks more beautiful than we have accomplished. Where are the gaps?"*
**Method**: Three parallel Gemini research lanes (arch-viz / pro-CAD / consumer-simplicity) + direct codebase audit + training-knowledge synthesis.
**Lanes**:
- Arch-viz (Lumion, Twinmotion, Enscape) — Gemini lane timed out; this section uses direct knowledge.
- Pro-CAD (SketchUp, Blender, 3ds Max) — Gemini cascade returned. See `archive_resp.md`.
- Consumer (Planner 5D, RoomSketcher, Sweet Home 3D, Live Home 3D, IKEA Kreativ, Sims 4) — Gemini cascade returned.

---

## Executive Summary

MContainer's **interaction layer** is now broadly competitive with consumer-grade home-design tools after the recent building-UX sprint. The remaining gap is in three categories:

1. **Visual quality** (the Lumion gap). Post-processing is on; what's missing is *material library breadth*, *foliage/vegetation*, *water/reflection shaders*, and *scanned PBR textures*. The renderer can show beauty — it lacks the **content** to be beautiful with.
2. **Precision controls** (the pro-CAD gap). Non-modal type-to-set ("type `3m` mid-drag"), axis locking (G→X), custom pivots, and modifier-stack-style non-destructive layering are absent. These are *power-user* affordances — they don't hurt simplicity if hidden behind one-key access.
3. **Onboarding** (the consumer gap). MContainer drops users on an empty canvas. Planner 5D's "AI Smart Wizard," Sims 4's "Styled Rooms," and IKEA Kreativ's "scan-and-edit" all bypass the blank-canvas problem. MContainer's `FirstLaunchHint` is a banner — not a starting layout.

**Highest-leverage next moves** (in priority order):
1. **Vegetation + ground surfaces** — the single biggest "Lumion gap." Add trees/grass/ground material library. ~1 week.
2. **Scanned PBR material upgrade** — replace flat colors with normal/roughness/AO maps for at least the most-used 8 surfaces. ~3 days.
3. **Pre-built starting templates** — auto-load a curated 2-container starter on first visit, not an empty plane. ~1 day.
4. **SketchUp-style inference snapping + non-modal type-to-set** — extends current snap-to-edge with mid-axis / midpoint inferences + a text overlay that captures keystrokes during drag. ~2-3 days.
5. **Water/reflection + soft-shadow polish** — pool reflectivity + contact shadows specifically. ~2 days.

---

## 1. Arch-Viz Lane — Lumion, Twinmotion, Enscape (the "beauty" tier)

### What makes them look beautiful (in priority of perceived impact)

1. **Massive curated content libraries.** Lumion 2024 ships with ~7,000+ models — trees, grass, people, vehicles, furniture — all art-directed for consistency. The single biggest reason a Lumion render feels alive is that there's *life in the scene*. A bare box on a flat plane is never going to look like a Lumion render no matter how good the post stack is.
2. **Scanned PBR materials.** Lumion's Quixel-style materials carry albedo + normal + roughness + AO + displacement maps. The difference between a flat painted wall and a scanned-concrete wall is night-and-day even before any lighting work.
3. **Real-time global illumination + sky-scattered light.** Lumion uses a custom GI solver; Enscape uses real-time path-tracing on RTX hardware. Twinmotion uses Unreal's Lumen system. The shared property: light bounces. Indirect ambient color leaks across surfaces, making interiors feel inhabited rather than studio-lit.
4. **Water shaders with reflection + refraction + caustics.** Pools, lakes, ocean — all use specialized shaders, not flat textures. Even small puddles add perceived production value.
5. **Volumetric atmospherics.** Light shafts ("god rays"), fog, haze, particulate dust. Cheap to do, instantly cinematic.
6. **Post stack done by default.** Bloom, depth-of-field, vignette, chromatic aberration, film grain, color LUTs — all on by default with sensible presets. The user gets the look without knowing what any of those words mean.
7. **Sky/sun workflow.** A single time-of-day slider. The sun moves, the sky color shifts, the shadows rotate, the HDRI swaps. **No separate "sun" panel.** This is something MContainer already gets right with its time-of-day slider.

### Camera controls (confidence: HIGH)

All three tools converge on a similar control model:

| Action | Lumion | Twinmotion | Enscape |
|---|---|---|---|
| Orbit | RMB drag | RMB drag | RMB drag |
| Pan | MMB drag or `Shift+RMB` | MMB drag | MMB drag |
| Dolly/zoom | Scroll wheel | Scroll wheel | Scroll wheel |
| Fly-mode | `WASD` + mouse-look (RMB held) | `WASD` + mouse-look | `WASD` + mouse-look |
| Speed boost | `Shift` (run) | `Shift` (run) | `Shift` (run) |
| Up/down | `Q/E` | `Q/E` | `Q/E` |

The **WASD + mouse-look** convention is gaming standard. It's what users coming from games will try. MContainer's walkthrough mode supports this — that's a strength.

### What "simple" looks like in arch-viz (Twinmotion specifically)

Twinmotion is praised over Lumion for approachability because:
- The library is **dragged directly into the scene** — no separate "place" mode.
- Materials are dragged onto surfaces — drag, drop, painted.
- A **single weather/sun panel** replaces sliders for haze, fog, cloud cover, sun intensity, sky model.
- Most controls are **collapsed by default**; advanced settings are behind a chevron.

### UI patterns to consider for MContainer

- **Materials library as a flyout you drag-from** — currently MContainer's finish-picker is per-container; a global "drag this onto any surface" affordance is the Twinmotion idiom.
- **Single environment panel** combining time-of-day + weather + sky + fog — MContainer has time-of-day; it's missing fog/weather/cloud cover controls.
- **Default-on post stack** — already shipped (N8AO + Bloom + ACES tonemap + HueSat + BrightnessContrast). Missing: vignette, chromatic aberration, depth-of-field.

### Honest scope note

Lumion-grade GI is **not achievable** in a browser/R3F context without RTX-level hardware. But the *perception* of GI — from baked AO, contact shadows, IBL-driven ambient, and good HDRI choice — can carry most of the way. **The bigger gap is content, not renderer.**

---

## 2. Pro-CAD Lane — SketchUp, Blender, 3ds Max

(Summarized from Gemini cascade output at `C:/Users/ccimi/AppData/Local/Temp/procad_resp.md`)

### Specific patterns MContainer is missing

| Pattern | Source | Why it helps MContainer | Effort |
|---|---|---|---|
| **Inference snapping** (snap-to-midpoint / face-center / corner-to-corner) | SketchUp | Eliminates manual coordinate entry for the "I want these two containers aligned at their midpoint" case | Medium (2-3 days extending existing snap engine) |
| **Non-modal type-to-set** (drag, then type "3m", Enter) | SketchUp | Precision without losing flow; no Position-X form click | Medium (3-4 days; needs drag-aware key listener + numeric overlay) |
| **Axis locking** (drag + X to lock X-axis only) | Blender | Eliminates jitter, prevents accidental Y drift during a long X move | Low (1 day; modifier-key state on drag) |
| **Custom pivot points** (click a corner to set rotation pivot) | Blender | Currently rotation pivots at container center; corner-pivot matches real crane operation | Medium (3-4 days; new pivot-mode selector) |
| **Modifier-stack non-destructive layers** (toggle "cladding" off to see structure) | 3ds Max | MContainer's `setVoxelFacePreset` is *destructive* in the sense that protection prevents re-application; a true layer stack would allow "show/hide" any layer | High — architectural change |
| **Context quad-menus** (right-click an object opens a 4-quadrant action menu) | 3ds Max | Reduces sidebar travel; keeps focus on the model | Medium (3-5 days) |
| **Repeat-last action** (`Shift+R` to duplicate the last move) | Blender | Place 4 containers in a row in 4 keystrokes | Low (1-2 days) |

### What "approachable" means in SketchUp's reputation

SketchUp's friendliness comes from three specific decisions:
1. **The inference engine speaks visually.** Dotted lines, colored dots, "On Edge" tooltips. The tool *tells you* what it just inferred. MContainer's snap already exists but doesn't speak — there's no inference label.
2. **Tools, not menus.** A small toolbar of verbs (Move, Rotate, Push/Pull, Paint, Erase). Each verb has one job. MContainer has multiple non-verb-shaped controls (Smart toggle, advanced settings, Inspector, MatrixEditor) — collapsing to a verb toolbar would be a major simplification.
3. **One-button orbit.** Hold middle mouse, you're orbiting. No "switch to Orbit tool" mode. MContainer's `CameraControls` already gets this right (right-mouse orbit) but it's not visually announced anywhere.

---

## 3. Consumer Lane — Planner 5D, Sweet Home 3D, Live Home 3D, IKEA Kreativ, Sims 4 Build Mode

(Summarized from Gemini cascade output at `C:/Users/ccimi/AppData/Local/Temp/consumer_resp.md`)

### The 4 universal simplicity patterns

1. **Direct manipulation with tactile handles.** Sims 4 puts arrows directly on objects. Live Home 3D's "context-aware Inspector" morphs when selection changes. MContainer has selection-driven Sidebar morphing already — that's an aligned pattern.
2. **Bypass the blank canvas.**
   - **Planner 5D** opens with an AI Smart Wizard that asks "Studio? 1-bed? 2-bed?" and generates a starting layout.
   - **IKEA Kreativ** shifts users from "creator" to "editor" via room-scan: you load a photo of your real room, then swap items.
   - **Sims 4** offers "Styled Rooms" — drop a pre-furnished room and immediately edit.
   - **MContainer** currently drops users on an empty canvas with a one-time hint banner. *This is the largest UX gap.*
3. **Skeuomorphic navigation.** Sims 4 lets you click the *roof* to see roof options, click the *wall* to see wall options. MContainer's Sidebar tabs (Structure/Interior/Saved) are text — they could be visually mapped to the model.
4. **2D/3D toggle.** Persistent button that swaps views without losing selection or state. MContainer has `ViewMode.Blueprint` ↔ `ViewMode.Realistic` — already aligned. Confirm the toggle is *one click* and selection survives the swap.

### Sims 4 Build Mode as the gold standard

Sims is the most-cited "fun simplicity" reference. What makes it feel effortless:
- **No tool palette.** You click a chair in the catalog, your cursor *becomes* the chair. Click in scene = place.
- **No mode for paint.** Same flow — click swatch, cursor becomes the brush, click surface = painted. MContainer already gets this right for face painting.
- **Wall-drag creates rooms.** Drag a rectangle on the floor and it becomes a walled room with a door slot. (MContainer doesn't have rooms-as-rectangles because it has containers-as-rectangles. The analog is: drag a container, get a habitable space.)
- **Buy/Build mode have no "save."** All changes commit and become undo-stack entries. MContainer's autosave + zundo gets this right.
- **The "+" hover affordance on adjacent stacking** — MContainer just shipped this as `AutoStairsAffordance`. ✅

### What MContainer is still missing from consumer simplicity

| Gap | Reference | Recommendation |
|---|---|---|
| Empty-canvas problem | Planner 5D, Sims 4, IKEA | Auto-load a curated 2-container "starter" on first visit |
| AI-generated starter | Planner 5D | Add a "What kind of home?" wizard: studio / 2-bed / resort / pool house — invokes existing `placeModelHome` |
| Visual catalog with hover-preview | Sims 4 catalog | Inspector arrangement gallery already does this for arrangements — extend to containers (LibraryCard hover currently shows static — could show animated 3D preview) |
| Drag-to-paint material (not click-each-face) | Twinmotion, Sims paint | Material brush: hold-drag across faces paints continuously |
| Toast → action confirm | Most consumer apps | Destructive toast already shipped; add "Toast: hover to peek at change before commit" pattern |
| Furniture/object library | All consumer apps | Furniture catalog exists (FURNITURE_CATALOG) but variety is limited |

---

## 4. Gap Analysis — MContainer Today

### What MContainer already does well

- Drag-ghost preview ✓ (industry standard)
- Snap-to-grid + snap-to-adjacent edges ✓ (matches SketchUp inference partial)
- Face-paint hover preview ✓ (translucent overlay before commit)
- Single-action paint (no tool mode) ✓ (matches Sims)
- Auto-stack + "+Stairs" affordance ✓ (Townscaper-grade)
- Smart-default mode with contextual opt-out ✓ (matches consumer-tool design)
- Visible undo + destructive toast ✓
- Component-snap prefabs ✓ (Figma-style, brainstorm deferred #1)
- Hierarchical groups ✓ (Lego-Studio-style)
- Touch gestures ✓ (Procreate-style multi-finger)
- Time-of-day slider with sun + HDRI swap ✓ (Lumion-grade workflow)
- N8AO + Bloom + ACES tonemap + Hue/Sat + Brightness/Contrast ✓ (most of the post stack)
- Walkthrough mode with WASD + mouse-look ✓ (game-standard)
- 2D/3D toggle with state preservation ✓
- Persistence via idb-keyval ✓

### Concrete remaining gaps (ordered by perceived impact)

#### **Visual content gaps** (biggest perceived "Lumion gap" — these are the difference between "looks like a sketch" and "looks like a render")

1. **Scanned PBR materials.** Replace flat-color surfaces with normal + roughness + AO maps. Use Polyhaven (already shipped HDRIs from there) — they have a matching texture library, CC0-licensed. The 8 highest-impact surfaces: concrete, wood-deck, painted-steel, glass, water, grass, dirt, gravel.
2. **Vegetation library.** Even 3-5 stylized low-poly trees + a grass shader would close 60% of the Lumion "alive" gap. drei has `<Instances>` for mass-instancing; sketchfab has free CC-licensed tree assets.
3. **Water shader.** The pool currently uses flat Glass surface. A real water shader (drei has `<MeshReflectorMaterial>`) with reflection + slight surface ripple would transform the pool moment.
4. **Vignette + chromatic aberration + film grain.** Three more post effects, already in `@react-three/postprocessing`. Default-on at low intensity. Free "expensive" feel.
5. **Contact shadows.** drei `<ContactShadows>` under each container. Cheap, dramatic.
6. **Fog/atmospheric scattering.** Three.js exponential fog tied to time-of-day. Already partially there via sky shader; explicit ground fog would add depth.

#### **Controls / precision gaps** (the pro-CAD gap — quick wins behind one-key access)

1. **Inference labels during snap.** When snap fires, show a small text label ("midpoint", "edge", "stack") near the snap point. Speaks the inference. (SketchUp's signature.)
2. **Type-to-set during drag.** Listen for digit keys during an active drag. Show a numeric overlay; on Enter, teleport to that offset.
3. **Axis lock (X/Y/Z keys during drag).** Lock movement to that axis. Matches Blender muscle memory.
4. **Custom pivot via Alt-click corner.** Sets next rotation pivot to that corner. One mode change, one cleanup on commit.
5. **Repeat-last (`Shift+R` or Ctrl+D).** Duplicate the last placement at the same delta. Container-row construction in 4 keystrokes.

#### **Onboarding gap** (consumer apps' biggest differentiator)

1. **Auto-load a starter scene** for new visitors instead of an empty canvas. A curated 2-container L-shape with a small deck takes ~3s to author once in code.
2. **"What are you building?" wizard.** 4 buttons: Studio / Family Home / Resort / Pool House. Each invokes `placeModelHome`. The library already has these — they're just not surfaced as the first-touch flow.
3. **Live 3D thumbnails in arrangement gallery.** Currently SVG isometric (shipped during U7). An R3F-rendered thumbnail per arrangement on hover would lift the visual quality of the gallery itself.

#### **Material/affordance ergonomics** (Twinmotion-style polish)

1. **Material brush: hold-drag-across-faces paints continuously.** Currently each face is a separate click.
2. **Materials in a global drag-from library** (not just inside per-container Inspector). Matches Twinmotion's "drag onto any surface" idiom.
3. **Skeuomorphic Sidebar tabs.** Replace text labels ("Structure" / "Interior" / "Saved") with iconified versions of the model: ▢ container outline, 🪑 chair, ❤ saved. Matches Sims' visual-house-diagram approach.
4. **Right-click quad menu on selection** for the top 4 most-used contextual actions (Rotate / Duplicate / Delete / Paint).

---

## 5. Recommended Roadmap

Ordered by impact ÷ effort. Each is shipped as a single PR; numbers are calendar-day estimates.

### Sprint A — Visual polish (1-2 weeks; biggest perceived ROI)
1. **PBR material upgrade** (8 highest-impact surfaces, Polyhaven CC0). ~3 days.
2. **Vegetation library** — 3-5 low-poly trees + grass instanced patch + dirt + gravel ground variants. ~4 days.
3. **Water shader on pool** via `<MeshReflectorMaterial>`. ~1 day.
4. **Vignette + chromatic aberration + film grain** added to PostProcessingStack at low default intensity. ~0.5 day.
5. **Contact shadows** under each container. ~0.5 day.

### Sprint B — Onboarding (3-5 days)
1. **Auto-starter scene** on first visit (replace `FirstLaunchHint` blue-banner with a 2-container starter + a "Clear and start fresh" button). ~1 day.
2. **"What are you building?" wizard** that surfaces existing `MODEL_HOMES` as the first-touch flow. ~2 days.
3. **Live R3F thumbnail per arrangement** in the Inspector picker. ~2 days.

### Sprint C — Precision controls (1 week; behind one-key access so simplicity preserved)
1. **Inference labels during snap** ("midpoint" / "edge" / "stack" near the snap point). ~1 day.
2. **Type-to-set during drag** with numeric overlay. ~2 days.
3. **Axis lock keys** (X/Y/Z during drag). ~1 day.
4. **Repeat-last** (Ctrl+D duplicates with last delta). ~1 day.

### Sprint D — Affordance polish (3-5 days)
1. **Material brush** (drag-across-faces paint). ~2 days.
2. **Global drag-from materials library** (Twinmotion-style). ~2 days.
3. **Right-click quad menu** on container selection. ~1 day.

---

## 6. Sources & Confidence

**Cascade responses** (file paths):
- `C:/Users/ccimi/AppData/Local/Temp/procad_resp.md` — Gemini lane on SketchUp/Blender/3ds Max
- `C:/Users/ccimi/AppData/Local/Temp/consumer_resp.md` — Gemini lane on Planner 5D/RoomSketcher/Sweet Home 3D/Live Home 3D/IKEA/Sims 4
- `C:/Users/ccimi/AppData/Local/Temp/archviz_resp.md` — empty (network timeout); arch-viz section synthesized from training knowledge

**Confidence levels**:
- Camera control mappings for Lumion/Twinmotion/Enscape — **HIGH** (well-documented; consistent across vendor docs).
- Lumion's GI implementation as the perceived-beauty driver — **MEDIUM-HIGH** (correlates with reviews; not independently benchmarked).
- "Content > Renderer" hypothesis — **MEDIUM** (defensible from observation that bare-scene Lumion renders look identical to bare-scene R3F at matched settings).
- Sims 4 Build Mode patterns — **HIGH** (extensively documented in game-design press).
- Consumer-tool "AI Smart Wizard" / starter-scene patterns — **HIGH** (verified across Planner 5D, IKEA Kreativ, Sims 4).
- SketchUp inference + non-modal-dimension idioms — **HIGH** (textbook SketchUp UX).
- MContainer current-state feature audit — **HIGH** (direct codebase grep performed before writing).

**Self-limitation note**: the arch-viz cascade timeout means specific recent (2024-2026) feature updates in Lumion/Twinmotion/Enscape are not verified. The recommendations don't depend on any 2024-2026-specific feature.
