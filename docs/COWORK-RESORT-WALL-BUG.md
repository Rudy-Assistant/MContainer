# Cowork prompt — finish the resort_house wall-rendering bug

A self-contained handoff prompt for a fresh Claude (or human) session
to take over the resort_house wall-rendering bug at C:\MHome\MContainer.
Copy the section below the rule into the new session.

---

TASK: Fix the resort_house preset wall-rendering bug in C:\MHome\MContainer.

User-facing problem: When the user loads the "Resort House" model home via
the Saved tab, the building renders in 3D and Walkthrough modes as a flat
steel roof on stilts with no enclosing walls. The user has rejected this
across 4+ rounds. Acceptance: walls visible in 3D + walkthrough screenshots,
user can walk from outside the building up stairs to the rooftop deck.

═══════════════════════════════════════════════════════════════════════════════
STATE OF THE WORLD
═══════════════════════════════════════════════════════════════════════════════

Repo: C:\MHome\MContainer (separate git repo, NOT the wrapper at C:\MHome).
Branch: master, HEAD = bc0d61d. 1119/1119 vitest passing. tsc clean.

Current resort_house preset (src/config/modelHomes.ts):
  - 19 containers: 1 subterranean pool + 6 L1 + 6 L2 + 6 L3 in 3×2 grid
  - All rotation = 0 (an earlier rotation-ring attempt was reverted in 6bdbbc4
    because it broke halo activation in additional ways — DO NOT re-introduce
    rotation until the base bug is fixed)
  - All levels use `central_atrium` arrangement (steel walls + 2×2 atrium void)
  - extensionConfig: 'all_deck' on every container
  - Stair chain on NW column: voxel 9 face='s' (L1→L2), voxel 14 face='n'
    (L2→L3), extraStairs voxel 9 face='top' (L3→roof)
  - extraRooftopDecks: [13,14,15,16,17,18] (forces rooftop on L3)
  - placeModelHome (src/store/slices/librarySlice.ts:375) sets
    designMode='manual' at start and KEEPS it manual permanently
    (commit bc0d61d). MH-5 test was updated to set smart mode before its
    adjacency check.

Reference photos: C:\Users\ccimi\Downloads\Model Home (5 IMG_71XX.jpeg files
showing a Bali-style atrium home with indoor pool, multi-level balconies,
stairs visible inside the atrium, wood-clad walls with stone accents, lots
of greenery). The user accepts this is not reproducible exactly with shipping
containers — they want the SHAPE (3 levels + roof, perimeter ring around
atrium, pool at base) and SOLID WALLS.

User spec (verbatim): "L1-L3 should have at least 5 per level; so at least 16
containers (15 with 5 per level + 1 pool)." Rooftop deck required.

═══════════════════════════════════════════════════════════════════════════════
THE BUG (precise diagnosis from prior session)
═══════════════════════════════════════════════════════════════════════════════

Voxel inspection via Playwright on the live dev server (localhost:3000):

  t0 (synchronous return from placeModelHome):
    L1 NW voxel 0 (NW corner halo, level 0 row 0 col 0): active=true
    L1 NW voxel 8 (W halo body row, level 0 row 1 col 0): active=true,
      faces.w='Solid_Steel'
    L1 NW north-face Solid_Steel count: 7

  t1 (~150ms later, after rAF + React render cycle):
    L1 NW voxel 0: active=FALSE
    L1 NW voxel 8: active=FALSE, faces.w='Open'
    L1 NW north-face Solid_Steel count: 0

So something between sync-return and 150ms-later DEACTIVATES extension halo
voxels. This is the bug.

Vitest tests run the SAME placeModelHome + refreshAdjacency code path
synchronously and pass GREEN — the data layer is correct. The deactivation
only happens in the browser's async render cycle.

CRITICAL: The ONLY place in the entire codebase that writes voxel.active=false
is `clearUnpackPhase` at containerSlice.ts:967-988, in the wasReverse=true
branch:

  const wasReverse = voxel.unpackPhase === 'reverse';
  if (wasReverse) {
    grid[voxelIndex] = {
      ...voxel,
      active: false,            ← ONLY .active=false write site
      unpackPhase: undefined,
      ...
      faces: { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' },
    };
  }

clearUnpackPhase is called from ContainerSkin.tsx (R3F useFrame animation
completion). The ONLY place that sets unpackPhase='reverse' is
containerSlice.ts:741 (setAllExtensions config==='none' path). placeModelHome
does NOT call setAllExtensions('none').

So one of these is true:
  (a) Something post-placement (smart-rule cleanup, stack side effect,
      adjacency cascade) is setting unpackPhase='reverse' on halo voxels
      that should stay active.
  (b) clearUnpackPhase has another, more obscure caller path I missed.
  (c) A code path I haven't read yet writes active=false directly.

VERIFIED NOT THE WRITER (don't waste time on these):
  - recomputeSmartRailings (voxelSlice.ts:360) — only mutates .faces
  - recomputeSmartHoleGuards (voxelSlice.ts:526) — only mutates .faces
  - refreshAdjacency auto-merge (containerSlice.ts:1801+) — only mutates
    body voxel .faces, not halo, not .active
  - applyContainerArrangement.setCell — sets active per arrangement spec
    which returns active=true for halo cells when level0Scope='full_footprint'

═══════════════════════════════════════════════════════════════════════════════
GOTCHAS LEARNED THE HARD WAY
═══════════════════════════════════════════════════════════════════════════════

1. Webpack HMR goes stale during long sessions. After editing a slice file,
   verify your code is actually live by running this in the browser:
     window.__store.getState().placeModelHome.toString().includes('YOUR_MARKER')
   If false, your bundle is cached. Fix:
     taskkill /PID <port-3000-pid> /F
     rm -rf .next node_modules/.cache
     npm run dev
   Then hard-reload the page (?cachebust=N param).

2. Production build (npm run build && npm run start) strips window.__store —
   you can't inspect voxel state. Use dev server for inspection, prod only
   for visual verification if needed.

3. Pool y-coordinate: addPoolContainer (standalone) places the pool at
   y=8.7 (L3 height) instead of y=-2.9 (subterranean). The model-home
   pool-slot path in placeModelHome handles this correctly via
   subterranean:true + Y=-dims.height. Don't use addPoolContainer for
   programmatic builds — use addContainer with subterranean:true.

4. Container rotation breaks halo activation in placeModelHome in ways
   beyond the wall-loss bug. Reverted in 6bdbbc4. Don't reintroduce until
   the base bug is fixed.

5. designMode='smart' triggers the auto-merge cascade on every adjacency
   refresh. The current placeModelHome forces manual mode permanently.
   Walls survive ONLY in manual mode — if the user manually toggles to
   smart, walls die. Test path: vitest's MH-5 test must be in smart mode
   to exercise auto-merge; placeModelHome forces manual; the test was
   updated to reset to smart before refreshAdjacency.

6. Visual QA is required, not optional. After every patch attempt:
     a. Take screenshot via Playwright
     b. Read the JPEG file in the conversation (so you actually see it)
     c. State explicitly: "feature X should show Y; the screenshot shows Z"
   If Z != Y, keep fixing. Do not claim done.

═══════════════════════════════════════════════════════════════════════════════
EXECUTION PLAN
═══════════════════════════════════════════════════════════════════════════════

STEP 1 — Force fresh bundle and instrument clearUnpackPhase

  1a. Kill any existing dev server:
      powershell -c "Get-Process -Name node | Stop-Process -Force"
  1b. cd C:\MHome\MContainer && rm -rf .next node_modules/.cache
  1c. Add temporary console.log to clearUnpackPhase in
      src/store/slices/containerSlice.ts ~line 967, like:
        clearUnpackPhase: (containerId, voxelIndex) => {
          set((s) => {
            const c = s.containers[containerId];
            if (!c?.voxelGrid) return {};
            const grid = [...c.voxelGrid];
            const voxel = grid[voxelIndex];
            if (!voxel) return {};
            const wasReverse = voxel.unpackPhase === 'reverse';
            const VOXEL_COLS = 8, VOXEL_ROWS = 4;
            const localIdx = voxelIndex % (VOXEL_ROWS * VOXEL_COLS);
            const row = Math.floor(localIdx / VOXEL_COLS);
            const col = localIdx % VOXEL_COLS;
            const isHalo = row === 0 || row === 3 || col === 0 || col === 7;
            if (isHalo && wasReverse) {
              console.log('[CUP-DEACTIVATE]', containerId.slice(0,6), 'v', voxelIndex,
                          'r', row, 'c', col, 'beforeActive', voxel.active);
              console.trace('[CUP-DEACTIVATE-STACK]');
            }
            // ...rest of original function unchanged...
          });
        },
  1d. npm run dev
  1e. Open http://localhost:3000?inst=1 in Playwright
  1f. Verify code is live: assert
      window.__store.getState().clearUnpackPhase.toString().includes('CUP-DEACTIVATE')

STEP 2 — Reproduce + capture deactivation source

  2a. Run in Playwright:
        s.setDesignMode('smart')  // start smart so we see all paths
        for (id of containers) s.removeContainer(id)
        s.placeModelHome('resort_house')
        await wait(500)
  2b. Read browser console messages, filter [CUP-DEACTIVATE].
  2c. The first log entry's stack trace names the React component / line
      that called clearUnpackPhase. That's where unpackPhase='reverse' was
      set or how the wasReverse-branch got triggered.

STEP 3 — Trace back to who set unpackPhase='reverse'

  3a. Add another log at containerSlice.ts:741 inside setAllExtensions:
        if (config === 'none') {
          console.log('[SET-REVERSE]', containerId.slice(0,6));
          console.trace('[SET-REVERSE-STACK]');
          // ...existing body...
        }
  3b. Reproduce. Read console. The stack identifies who's calling
      setAllExtensions('none') post-placement. (If [SET-REVERSE] never
      fires but [CUP-DEACTIVATE] does, the unpackPhase='reverse' is being
      set somewhere ELSE — search for `'reverse' as const` and `unpackPhase:
      'reverse'` in src/.)

STEP 4 — Patch the source

  4a. The patch depends on what STEP 3 reveals. Likely candidates:
      - A setState that propagates 'reverse' from a stale voxel snapshot.
      - An animation-system completion callback that fires unexpectedly
        for fresh voxels with unpackPhase='walls_deploy'.
      - A smart-rule cleanup that touches halo voxels post-placement.
  4b. Patch at the source. Strip ALL instrumentation logs.
  4c. Re-run vitest: must stay 1119/1119 GREEN.
  4d. Re-run resort-house-walls.test.ts in particular.

STEP 5 — Visual QA (REQUIRED, blocks acceptance)

  5a. Hard-reload Playwright (?cachebust=N).
  5b. placeModelHome('resort_house'); wait 5000ms for any async passes.
  5c. Voxel check: L1 NW v0.active === true, faces.w === 'Solid_Steel',
      northSteel >= 4. If not, GO BACK TO STEP 2.
  5d. setViewMode('3d'); take screenshot to .qa/r12-walls-3d.jpg.
      Read the JPEG file. State explicitly:
        "Resort House should show: solid steel walls between L1 floor
         (~y=0) and L3 roof (~y=8.7), 3 distinct floor planes, atrium
         opening to pool below, rooftop deck on top.
         The screenshot shows: <description>."
      If walls not visible → not fixed → continue.

STEP 6 — Walkthrough verification

  6a. saveWalkthroughPos([0, 1.7, 15], Math.PI) — outside building, facing
      north.
  6b. setViewMode('walkthrough'); screenshot .qa/walk-01-outside.jpg.
  6c. Programmatically teleport through:
      - Inside L1 entry door
      - L1 stair voxel 9 NW
      - L2 floor NW
      - L2 stair voxel 14 NW
      - L3 floor NW
      - L3 stair voxel 9 face='top'
      - Rooftop deck
      Save .qa/walk-NN-stage.jpg per step.
  6d. Read each screenshot. Each must show solid walls.

STEP 7 — Commit + push

  7a. git add src/ .qa/walk-*.jpg .qa/r12-*.jpg
  7b. git commit with message describing root cause + patch + visual evidence
  7c. git push origin master
  7d. Halt phrase + autowork off if armed.

═══════════════════════════════════════════════════════════════════════════════
HARD STOPS (legitimate halt conditions)
═══════════════════════════════════════════════════════════════════════════════

- Missing credential / external service down.
- npm/build hard-fail unrelated to the task.
- After STEP 2 fully instruments + reproduces, if the deactivation source
  turns out to be in a third-party dependency (R3F, drei, zustand) — do
  NOT try to monkey-patch the dependency. Instead, document the finding
  and propose a workaround (e.g., setting unpackPhase=undefined explicitly
  for halo voxels after placeModelHome, OR adjusting the animation-phase
  state machine to treat 'walls_deploy' completion as final).

NOT VALID HALT REASONS:
- "Tests pass" → not enough; visual QA required.
- "Diagnosis is precise" → not enough; patch + screenshot required.
- "Mandate updated for next session" → not enough; complete the work.
- Sequence questions ("should I do A or B first?") → pick a defensible
  default and proceed.

═══════════════════════════════════════════════════════════════════════════════
DELEGATION

Route mechanical/diagnostic work via delegate-cheapest cascade
(Codex → Haiku → Gemini → Robin). Reserve Claude-direct for: <30 LOC
patches, visual taste judgment, architecture decisions, multi-file
synthesis, and RED-tier escalation.

Begin.
