# Granular UI Audit: Every ModuHome Toolbar Element vs Sims 4 / Valheim

## Sources
- [Sims Wiki: Build Mode](https://sims.fandom.com/wiki/Build_mode_(The_Sims_4))
- [SimsVIP Build Guide](https://simsvip.com/the-sims-4-building-guide/)
- [Sims 4 Hotkeys](https://www.carls-sims-4-guide.com/controls.php)
- [Valheim Wiki: How to Play](https://valheim.fandom.com/wiki/How_to_play)

---

## ModuHome Top Bar Elements (left to right)

### 1. Delete (Trash icon)
| Game | Location | Access | Notes |
|------|----------|--------|-------|
| **Sims 4** | Top-center toolbar, "Sledgehammer" tool (K hotkey) | Click tool, then click object | NOT a persistent button — it's a TOOL MODE you activate |
| **Valheim** | No button — middle-click with Hammer equipped | Context action on hover target | No dedicated UI element at all |
| **ModuHome** | Top bar, always visible | Click button | ⚠️ Should be a TOOL MODE (cursor changes to demolish), not a one-shot button. Consider: toggle on, click to delete multiple, toggle off |

### 2. Rotate (↻ icon)
| Game | Location | Access | Notes |
|------|----------|--------|-------|
| **Sims 4** | No button — `<` and `>` keys, or right-click drag on object | Keyboard only + mouse gesture | NOT in any toolbar |
| **Valheim** | Scroll wheel while holding piece | Mouse gesture only | NOT in any toolbar |
| **ModuHome** | Top bar button | Click button | ⚠️ Should be hotkey-only (R key already works). Button wastes toolbar space for a rarely-clicked action |

### 3. Reset (↺ icon, red)
| Game | Location | Access | Notes |
|------|----------|--------|-------|
| **Sims 4** | "Bulldoze Lot" button in bottom-left lot info panel — NOT top bar | Requires confirmation dialog | Tucked away, hard to accidentally click. NOT in main toolbar |
| **Valheim** | Does not exist — must destroy piece by piece | N/A | No reset concept |
| **ModuHome** | Top bar, prominent red icon | One click + confirm | ⚠️ Dangerous action in prominent position. Move to Settings dropdown or a "..." overflow menu |

### 4. Outer Walls (panel icon + dropdown)
| Game | Location | Access | Notes |
|------|----------|--------|-------|
| **Sims 4** | Wall display modes in top-RIGHT area: 3 small house silhouette icons | Always visible, 3-state toggle | This is WALL VISIBILITY (up/down/cutaway), not wall material. Wall materials are in the build catalog |
| **Valheim** | No equivalent | N/A | Players build walls manually |
| **ModuHome** | Top bar dropdown "Walls" | Click dropdown, pick preset | ⚠️ Confuses wall MATERIAL presets with wall VISIBILITY. Wall visibility is already in Settings (Full/Half/Down). Consider: move material presets to hotbar/catalog, not toolbar |

### 5. Undo (← arrow)
| Game | Location | Access | Notes |
|------|----------|--------|-------|
| **Sims 4** | Top-CENTER toolbar, small left arrow | Ctrl+Z hotkey + small icon button | Icon-only, no text label. Part of the tool cluster, not isolated |
| **Valheim** | Does not exist | N/A | No undo |
| **ModuHome** | Top bar | Ctrl+Z + icon button | ✅ Correct placement. Already icon-only |

### 6. Redo (→ arrow)
| Game | Location | Access | Notes |
|------|----------|--------|-------|
| **Sims 4** | Top-CENTER toolbar, small right arrow, next to Undo | Ctrl+Y hotkey + small icon button | Paired with Undo as a unit |
| **Valheim** | Does not exist | N/A | No redo |
| **ModuHome** | Top bar, next to Undo | Ctrl+Y + icon button | ✅ Correct placement |

### 7. Share (share icon)
| Game | Location | Access | Notes |
|------|----------|--------|-------|
| **Sims 4** | "Gallery" button in top-right — opens a separate full-screen panel for sharing to EA Gallery | Separate screen, NOT inline | NOT a toolbar button — it's a major navigation mode |
| **Valheim** | No share feature in vanilla game | N/A | Community uses screenshots/mods |
| **ModuHome** | Top bar button | Click to copy share URL | ⚠️ Low-frequency action in premium toolbar space. Move to overflow "..." menu or Settings |

### 8. Export (download icon + dropdown)
| Game | Location | Access | Notes |
|------|----------|--------|-------|
| **Sims 4** | Save is automatic. "Save As" in the game menu (Esc). Gallery sharing is separate | Not in build toolbar at all | Export is a SYSTEM action, not a build tool |
| **Valheim** | No export feature | N/A | World files are saved automatically |
| **ModuHome** | Top bar dropdown (JSON + GLB) | Click dropdown | ⚠️ Low-frequency action. Move to overflow "..." menu or Settings |

### 9. Material Palette (paintbrush icon)
| Game | Location | Access | Notes |
|------|----------|--------|-------|
| **Sims 4** | Design Tool (R hotkey) — activates recolor mode. Click object to see swatch options INLINE, not in a separate palette | Tool mode + inline swatches on selected object | NOT a persistent toolbar button — it's a mode |
| **Valheim** | No recolor feature | N/A | Materials are fixed per piece type |
| **ModuHome** | Top bar, opens palette modal | Click button | ⚠️ Consider: make it a TOOL MODE like Sims. Clicking a face while in "paint mode" shows material options. The separate palette modal is an extra step |

### 10. Floor / Roof View Toggle
| Game | Location | Access | Notes |
|------|----------|--------|-------|
| **Sims 4** | Floor selector on RIGHT side — vertical stack of floor buttons. "Ceiling" is accessed by switching to the ceiling/roof category | Right-side panel for floors; ceiling is a catalog category | Floor selection is RIGHT side, separate from toolbar |
| **Valheim** | No floor selector | N/A | Continuous vertical building |
| **ModuHome** | Top bar pill toggle (Floor/Roof) | Click to switch | ⚠️ Consider moving to right side (Sims pattern). Currently in toolbar which is horizontal — vertical right-side stack would match Sims and free toolbar space |

### 11. View Mode (Grid/Design/Walk icons)
| Game | Location | Access | Notes |
|------|----------|--------|-------|
| **Sims 4** | Mode tabs at TOP (Live/Build/Buy) — these are the MAIN navigation, not small buttons | Large segmented tabs at very top, highly prominent | The mode switch IS the most prominent UI element |
| **Valheim** | No mode switch — equipping Hammer IS build mode | N/A | Mode is determined by equipped tool |
| **ModuHome** | Top bar pill, right side (3 small circle buttons) | Click to switch | ⚠️ Too small and hidden. These should be more prominent — larger tabs or a segmented control, similar to Sims |

### 12. Settings (sliders icon + dropdown)
| Game | Location | Access | Notes |
|------|----------|--------|-------|
| **Sims 4** | Game Options in Esc menu. Build-specific settings (grid, moveobjects, etc.) are cheats in the console | Esc menu + cheat console | NOT in build toolbar. Settings are separate from building |
| **Valheim** | Settings in Esc menu | Esc menu | NOT in build toolbar |
| **ModuHome** | Top bar dropdown | Click to open | ⚠️ Contains too much: Dark Mode + Grid + Wall Visibility + Wireframe. Consider: Dark Mode → system/app settings. Grid/Wall Visibility → keep. Wireframe → dev-only |

---

## Recommended Top Bar Redesign

Based on the audit, ModuHome's toolbar has **too many buttons** that aren't used during active building. Sims 4 keeps its toolbar focused on BUILDING TOOLS (select, eyedropper, sledgehammer, undo/redo) with everything else in panels or menus.

### Keep in Toolbar (high-frequency build actions):
- **Undo / Redo** (Sims has these in toolbar)
- **View Mode** tabs (make larger, like Sims' Live/Build/Buy tabs)
- **Floor / Roof** toggle (but consider moving to right side)

### Move to Overflow "⋯" Menu (low-frequency):
- **Delete/Reset** (dangerous, rarely clicked — use hotkey Del)
- **Rotate** (hotkey R is sufficient)
- **Share** (copy URL — rare action)
- **Export** (JSON/GLB — rare action)
- **Outer Walls** presets (move to hotbar catalog)

### Move to App Settings (Esc menu or persistent dropdown):
- **Dark Mode** toggle
- **Grid complexity** (Simple/Detail)
- **Wireframe** debug

### Keep as Toolbar Controls:
- **Wall Visibility** (Full/Half/Down) — equivalent to Sims' wall display modes
- **Material Palette** (keep as quick-access, like Sims' Design Tool)
