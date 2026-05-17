# Resort House wall-rendering bug — RESOLVED

The handoff prompt at `docs/COWORK-RESORT-WALL-BUG.md` described an
unresolved bug where placeModelHome('resort_house') rendered the building
as a flat steel roof on stilts with no enclosing walls. That bug was
fixed in two upstream commits:

  - 89ca997 fix(rooftop-deck): guard removeRooftopDeck against arrangement clobber
  - 937899d feat(resort-house): all-glass perimeter, continuous rooftop deck, restore smart mode

The actual root cause was `removeRooftopDeck` clobbering the arrangement's
applied perimeter wall state on stack events. The guard at
containerSlice.ts:~2049 fixed that interaction.

VERIFIED on 2026-05-17 via Playwright voxel inspection + screenshot Read:
  - L1 NW v0.active = true (was false)
  - L1 NW v8.active = true (was false)
  - L1 NW total_active = 64 (was 44 — full footprint now active)
  - L1 NW n-face Window_Standard = 7 (was Solid_Steel=0 + Window_Standard=0)
  - designMode = smart (the manual-mode workaround from bc0d61d was
    removed in 937899d as no longer needed)
  - 3D screenshot shows visible framed-glass walls fully enclosing the
    building perimeter, distinct floor seams at L1/L2/L3, rooftop deck
    on top (.qa/r14-upstream-fix-3d.jpg + .qa/r15-fullbuilding.jpg)

The handoff doc at COWORK-RESORT-WALL-BUG.md remains in the repo as a
record of the investigation arc; this RESOLVED note supersedes it.
