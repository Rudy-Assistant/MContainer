# UX Fixes Plan C: Quick Setup Wizard Enhancement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the existing Quick Setup wizard to cover the full "extensions + exterior style + interior + stacking + stairs" workflow in 2-4 clicks, reducing the 100+ click manual workflow.

**Architecture:** The wizard infrastructure already exists: `WizardModal.tsx` renders preset cards, `wizardPresets.ts` defines step sequences, and `applyWizardPreset` in the store executes them. We need to (1) add new composite presets that combine extension deployment + wall painting + stacking, (2) add a second "options" page to the wizard so users can customize the preset before applying, and (3) ensure `applyWizardPreset` handles the new step types.

**Tech Stack:** React 19, Zustand 5, existing `WizardModal`, `wizardPresets.ts`, `applyWizardPreset` store action.

**Relevant docs:** Read `src/config/wizardPresets.ts` for current preset schema, `src/components/ui/WizardModal.tsx` for current modal UI, `src/store/slices/containerSlice.ts` search for `applyWizardPreset`.

---

### Task 1: Add Composite Presets to wizardPresets.ts

**Files:**
- Modify: `src/config/wizardPresets.ts`
- Test: `src/Testing/wizard-presets.test.ts` (new)

- [ ] **Step 1: Write test — new presets have valid step configurations**

```typescript
// src/Testing/wizard-presets.test.ts
import { describe, it, expect } from 'vitest';
import { WIZARD_PRESETS, type WizardStep } from '@/config/wizardPresets';

describe('Wizard presets', () => {
  it('has at least 6 presets', () => {
    expect(WIZARD_PRESETS.length).toBeGreaterThanOrEqual(6);
  });

  it('all presets have unique ids', () => {
    const ids = WIZARD_PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all presets have non-empty steps', () => {
    for (const p of WIZARD_PRESETS) {
      expect(p.steps.length).toBeGreaterThan(0);
    }
  });

  it('full_glass_home preset has extensions + paint + stacking steps', () => {
    const preset = WIZARD_PRESETS.find(p => p.id === 'full_glass_home');
    expect(preset).toBeDefined();
    const actions = preset!.steps.map(s => s.action);
    expect(actions).toContain('extensions');
    expect(actions).toContain('paint_outer_walls');
    expect(actions).toContain('open_interior_walls');
  });

  it('roof_deck_combo preset includes rooftop_deck step', () => {
    const preset = WIZARD_PRESETS.find(p => p.id === 'roof_deck_combo');
    expect(preset).toBeDefined();
    const actions = preset!.steps.map(s => s.action);
    expect(actions).toContain('rooftop_deck');
  });
});
```

- [ ] **Step 2: Run test — should fail (new presets don't exist yet)**

Run: `npx vitest run src/Testing/wizard-presets.test.ts -v`
Expected: FAIL — `full_glass_home` and `roof_deck_combo` not found

- [ ] **Step 3: Add new step actions to WizardStep type**

In `src/config/wizardPresets.ts`, update the `WizardStep.action` union:

```typescript
export interface WizardStep {
  action: 'extensions' | 'rooftop_deck' | 'vertical_stairs' | 'paint_outer_walls'
        | 'open_interior_walls' | 'set_all_floors' | 'set_all_ceilings' | 'add_door';
  config?: ExtensionConfig;
  wallMaterial?: SurfaceType;
  floorMaterial?: SurfaceType;
  ceilingMaterial?: SurfaceType;
  stairVoxelIndex?: number;
  stairFacing?: 'n' | 's' | 'e' | 'w';
  doorVoxelIndex?: number;
  doorFace?: 'n' | 's' | 'e' | 'w';
}
```

- [ ] **Step 4: Add new composite presets**

Append to the `WIZARD_PRESETS` array:

```typescript
{
  id: 'full_glass_home',
  label: 'Glass Home',
  description: 'Full extensions with glass walls, wood floors, open interior — maximum space.',
  icon: '🏡',
  steps: [
    { action: 'extensions', config: 'all_interior' },
    { action: 'open_interior_walls' },
    { action: 'paint_outer_walls', wallMaterial: 'Window_Standard' },
    { action: 'set_all_floors', floorMaterial: 'Deck_Wood' },
    { action: 'add_door', doorVoxelIndex: 27, doorFace: 's' },
  ],
},
{
  id: 'roof_deck_combo',
  label: 'Home + Roof Deck',
  description: 'Glass ground floor with stacked rooftop deck, stairs, and railings.',
  icon: '🌇',
  steps: [
    { action: 'extensions', config: 'all_interior' },
    { action: 'open_interior_walls' },
    { action: 'paint_outer_walls', wallMaterial: 'Window_Standard' },
    { action: 'set_all_floors', floorMaterial: 'Deck_Wood' },
    { action: 'add_door', doorVoxelIndex: 27, doorFace: 's' },
    { action: 'rooftop_deck' },
    { action: 'vertical_stairs', stairVoxelIndex: 14, stairFacing: 's' },
  ],
},
{
  id: 'steel_fortress',
  label: 'Steel Fortress',
  description: 'Full steel enclosure with no extensions. Industrial bunker style.',
  icon: '🏭',
  steps: [
    { action: 'paint_outer_walls', wallMaterial: 'Solid_Steel' },
    { action: 'open_interior_walls' },
    { action: 'set_all_floors', floorMaterial: 'Concrete' },
  ],
},
```

- [ ] **Step 5: Run test**

Run: `npx vitest run src/Testing/wizard-presets.test.ts -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/config/wizardPresets.ts src/Testing/wizard-presets.test.ts
git commit -m "feat: add composite wizard presets (Glass Home, Roof Deck Combo, Steel Fortress)"
```

---

### Task 2: Implement New Step Actions in applyWizardPreset

**Files:**
- Modify: `src/store/slices/containerSlice.ts` (applyWizardPreset action)
- Test: `src/Testing/wizard-apply.test.ts` (new)

- [ ] **Step 1: Write failing test — applyWizardPreset handles open_interior_walls**

```typescript
// src/Testing/wizard-apply.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

describe('applyWizardPreset new step actions', () => {
  let containerId: string;

  beforeEach(() => {
    useStore.getState().reset();
    containerId = useStore.getState().addContainer('40ft_high_cube');
  });

  it('full_glass_home preset opens interior walls and sets exterior to Window_Standard', () => {
    useStore.getState().applyWizardPreset(containerId, 'full_glass_home');

    const grid = useStore.getState().containers[containerId].voxelGrid;
    // Body voxel index 10 (row 1, col 2): interior walls should be Open
    // East neighbor is voxel 11 (active body), so east face is interior
    expect(grid[10].faces.e).toBe('Open');
    // Bottom should be Deck_Wood (set_all_floors step)
    expect(grid[10].faces.bottom).toBe('Deck_Wood');
  });

  it('full_glass_home preset adds a door at voxel 27', () => {
    useStore.getState().applyWizardPreset(containerId, 'full_glass_home');

    const grid = useStore.getState().containers[containerId].voxelGrid;
    expect(grid[27].faces.s).toBe('Door');
  });

  it('roof_deck_combo creates stacked L1 container', () => {
    useStore.getState().applyWizardPreset(containerId, 'roof_deck_combo');

    const containers = useStore.getState().containers;
    const ids = Object.keys(containers);
    expect(ids.length).toBe(2);

    const l1 = Object.values(containers).find(c => c.level === 1);
    expect(l1).toBeDefined();
    expect(l1!.position.y).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test — should fail (new step actions not implemented)**

Run: `npx vitest run src/Testing/wizard-apply.test.ts -v`
Expected: FAIL — `open_interior_walls`, `set_all_floors`, `add_door` steps not handled

- [ ] **Step 3: Find applyWizardPreset in containerSlice.ts**

Search for `applyWizardPreset` in `src/store/slices/containerSlice.ts`. Read the current switch/if-else that handles step actions. Note the exact line numbers.

Run: `grep -n "applyWizardPreset" src/store/slices/containerSlice.ts`

- [ ] **Step 4: Add new step handlers**

In the `applyWizardPreset` action, find the loop that iterates over `preset.steps` and add cases for the new actions. Add these cases inside the step loop:

```typescript
case 'open_interior_walls': {
  // Batch all face changes in a single set() call for performance.
  // CRITICAL: Direction mapping must match codebase convention:
  //   Row axis = X, Col axis = Z
  //   e(+X) = row+1, w(-X) = row-1, s(+Z) = col+1, n(-Z) = col-1
  //   (Matches isExteriorFace in voxelSlice.ts — verified Sprint 8 fix)
  set((s) => {
    const c = s.containers[containerId];
    if (!c?.voxelGrid) return s;
    const grid = [...c.voxelGrid.map(v => ({ ...v, faces: { ...v.faces } }))];
    for (let level = 0; level < 2; level++) {
      for (let row = 0; row < VOXEL_ROWS; row++) {
        for (let col = 0; col < VOXEL_COLS; col++) {
          const idx = level * VOXEL_ROWS * VOXEL_COLS + row * VOXEL_COLS + col;
          if (!grid[idx]?.active) continue;
          // Direction mapping (row=X, col=Z):
          //   e → row+1, w → row-1, s → col+1, n → col-1
          const neighbors: Array<{ face: 'n' | 's' | 'e' | 'w'; dr: number; dc: number }> = [
            { face: 'e', dr: 1, dc: 0 },
            { face: 'w', dr: -1, dc: 0 },
            { face: 's', dr: 0, dc: 1 },
            { face: 'n', dr: 0, dc: -1 },
          ];
          for (const { face, dr, dc } of neighbors) {
            const nr = row + dr, nc = col + dc;
            if (nr < 0 || nr >= VOXEL_ROWS || nc < 0 || nc >= VOXEL_COLS) continue;
            const ni = level * VOXEL_ROWS * VOXEL_COLS + nr * VOXEL_COLS + nc;
            if (grid[ni]?.active) {
              grid[idx].faces[face] = 'Open';
            }
          }
        }
      }
    }
    return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
  });
  break;
}

case 'set_all_floors': {
  if (!step.floorMaterial) break;
  // Single set() call — mutate grid directly for performance
  set((s) => {
    const c = s.containers[containerId];
    if (!c?.voxelGrid) return s;
    const grid = c.voxelGrid.map(v =>
      v.active ? { ...v, faces: { ...v.faces, bottom: step.floorMaterial! } } : v
    );
    return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
  });
  break;
}

case 'set_all_ceilings': {
  if (!step.ceilingMaterial) break;
  set((s) => {
    const c = s.containers[containerId];
    if (!c?.voxelGrid) return s;
    const grid = c.voxelGrid.map(v =>
      v.active ? { ...v, faces: { ...v.faces, top: step.ceilingMaterial! } } : v
    );
    return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
  });
  break;
}

case 'add_door': {
  if (step.doorVoxelIndex !== undefined && step.doorFace) {
    // Use paintFace for consistency with paint_outer_walls (marks userPaintedFaces)
    get().paintFace(containerId, step.doorVoxelIndex, step.doorFace, 'Door');
  }
  break;
}
```

- [ ] **Step 5: Run test**

Run: `npx vitest run src/Testing/wizard-apply.test.ts -v`
Expected: PASS

- [ ] **Step 6: Run full test suite + type check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/store/slices/containerSlice.ts src/Testing/wizard-apply.test.ts
git commit -m "feat: implement open_interior_walls, set_all_floors, add_door wizard steps"
```

---

### Task 3: Improve WizardModal UI — Show Step Preview

**Files:**
- Modify: `src/components/ui/WizardModal.tsx`
- No new tests (UI-only change, verified in browser)

- [ ] **Step 1: Add step preview list when a preset is selected**

In `WizardModal.tsx`, find the "Description area" section (around line 146). Replace the simple text with a step-by-step preview:

```typescript
{selectedPreset && (
  <div style={{
    margin: "0 20px", padding: "10px 14px",
    background: "var(--bg-secondary, #f1f5f9)", borderRadius: 8,
  }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main, #1e293b)", marginBottom: 6 }}>
      {selectedPreset.label} — {selectedPreset.steps.length} steps
    </div>
    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-muted, #475569)", lineHeight: 1.8 }}>
      {selectedPreset.steps.map((step, i) => {
        const labels: Record<string, string> = {
          extensions: `Deploy extensions (${step.config || 'default'})`,
          rooftop_deck: 'Stack rooftop deck with railings',
          vertical_stairs: `Add staircase (facing ${step.stairFacing || 'S'})`,
          paint_outer_walls: `Paint exterior walls → ${step.wallMaterial?.replace(/_/g, ' ') || 'default'}`,
          open_interior_walls: 'Open all interior walls',
          set_all_floors: `Set all floors → ${step.floorMaterial?.replace(/_/g, ' ') || 'default'}`,
          set_all_ceilings: `Set all ceilings → ${step.ceilingMaterial?.replace(/_/g, ' ') || 'default'}`,
          add_door: `Add door (voxel ${step.doorVoxelIndex}, ${step.doorFace?.toUpperCase()} face)`,
        };
        return <li key={i}>{labels[step.action] || step.action}</li>;
      })}
    </ol>
    <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)", marginTop: 6 }}>
      Fully undoable with Ctrl+Z
    </div>
  </div>
)}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Browser verify — open Quick Setup, select "Home + Roof Deck"**

Click wrench icon → Quick Setup modal opens.
See 7 preset cards (4 original + 3 new).
Click "Home + Roof Deck" → step preview shows:
1. Deploy extensions (all_interior)
2. Open all interior walls
3. Paint exterior walls → Window Standard
4. Set all floors → Deck Wood
5. Add door (voxel 27, S face)
6. Stack rooftop deck with railings
7. Add staircase (facing S)

Click "Apply" → entire design builds in ~1 second.
Press Ctrl+Z repeatedly → each step undoes individually.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/WizardModal.tsx
git commit -m "feat: wizard step preview + 3 new composite presets"
```
