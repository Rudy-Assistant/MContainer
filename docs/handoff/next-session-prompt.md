# Next Session Startup Prompt

Copy-paste this into a new Claude Code session:

---

```
/superpowers:brainstorming Read the handoff docs for complete context on what to build next:

1. docs/handoff/sprint-block-bay-gizmo-handoff.md — Block tab + gizmo sprint (completed)
2. docs/handoff/sprint-bugfix-handoff.md — Pre-existing bugs (4 fixed, 3 remain)
3. ~/.claude/projects/C--MHome/memory/sprint-finishes-panel-handoff.md — FinishesPanel redesign (completed)

Two work streams to design:

**Stream A: Remaining Bugs (fix before design pass)**
- Debug/Wireframe mode missing from UI (restore toggle)
- Frame mode doesn't hide walls or update pole/rail materials visually
- Door flush positioning offset in ContainerSkin.tsx DoorFace component

**Stream B: Design Pass (needs brainstorming)**
1. Block tab isometric previews — Replace Lucide icons with SVG isometric voxel drawings showing each preset's face config. Recommend programmatic SVG approach.
2. Ghost preview on hover — Wire onMouseEnter on Block tab preset cards → facePreview store → HoverPreviewGhost renders transparent overlay in 3D. Pattern exists for hotbar items.
3. Card design standardization — Create shared PresetCard matching TextureSwatchGrid (square card + label). Use across Block tab, OptionCardGrid, all tabs.
4. Bottom hotbar — Responsive layout (don't overlap left panel), 80% more transparent, remove icon dots, readable text.
5. Inspector cleanup — Remove Bay/Block toggle (use Simple/Detail mode), remove legend/cable info/scope text, remove "Structural Presets" label.
6. Container preset tab — All Deck/Interior/N Deck/S Deck/Retract → dedicated tab with isometric container previews.
7. Multi-select in Block Grid — Shift+Click row select, Ctrl+Click toggle. Element type constraint (only same-type elements multi-selectable together).

Start with Stream A bugs (quick fixes), then brainstorm Stream B design pass.
```
