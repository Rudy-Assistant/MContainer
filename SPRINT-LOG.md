# Sprint Log — Autonomous Completion Sprint

## Step 1: Audit Findings

### Baseline State
- **tsc**: 0 errors
- **vitest**: 288 passed, 26 files
- **Gates**: 32/32 PASS (pending current run)

### Camera System Findings
- `CameraFloorGuard` (Scene.tsx L828): Clamps BOTH position Y (>=0.5) and target Y (>=0.0) per frame
- `CameraTargetLerp` (Scene.tsx L784): Clamps _lerpTarget.y >= 0 before applying
- `mouseButtons.right = CAMERA_MOUSE_RIGHT (2 = TRUCK)` set in useEffect on mount
- `mouseButtons.middle = CAMERA_MOUSE_RIGHT` also set
- `maxPolarAngle = Math.PI/2 - 0.08` (~82°) prevents looking straight down
- **Missing**: `preserveDrawingBuffer: true` on Canvas gl prop — needed for pixel sampling
- **Missing**: No pixel-sampling gate exists — G15 only checks camera.position.y, not actual rendered pixels

### Stacking System Findings
- `findStackTarget` (spatialEngine.ts L389): Now has excludeId parameter to prevent self-targeting
- `commitContainerDrag` (dragSlice.ts): Calls stackContainer SYNCHRONOUSLY (no requestAnimationFrame gap)
- `stackContainer` (containerSlice.ts L1081): Sets Y = bottom.position.y + CONTAINER_DIMENSIONS[bottom.size].height
- G20 gate verifies Y=2.90 after stacking — this is a real behavioral test

### Walkthrough Spawn Findings
- EYE_HEIGHT = 1.6m
- Spawn: largest ground-floor (level 0) container center, Y = container.position.y + 0.06 + EYE_HEIGHT
- For ground containers: Y = 0 + 0.06 + 1.6 = 1.66m — within container bounds (height ~2.9m)
- Saved position restored if available
- **No bug found**: spawn is inside container bounds

### Gate Quality Findings
- G15: Tests camera.position.y after left-drag — good but doesn't pixel-sample
- G7 visual gates: Some show "no buffer for comparison" — clip screenshots timeout in SwiftShader
- G11: Falls back to "export function exists" instead of testing dropdown — acceptable (force click issue)
- G23: Two-level home gate is comprehensive (11 steps)

## Step 2: Bug Fixes

### Fix 1: Add preserveDrawingBuffer for pixel sampling
**Root cause**: Canvas gl prop missing preserveDrawingBuffer: true. Without this, readPixels always returns black.
**Fix**: Add to SceneCanvas.tsx gl prop.

### Fix 2: Camera pixel-sampling gate
**Root cause**: G15 only checks camera.position.y, not whether the actual rendered pixels are blue.
**Fix**: Add WebGL readPixels sampling after aggressive drag to detect blue screen condition.
