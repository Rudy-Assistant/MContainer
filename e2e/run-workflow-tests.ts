/**
 * E2E Workflow Regression Suite
 * Converts Sprint 12's 7 workflow audits into automated checks.
 * Requires dev server running on http://localhost:3000
 */

import { chromium } from "playwright";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  detail?: string;
}

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results: TestResult[] = [];

  function pass(name: string) {
    results.push({ name, status: "PASS" });
  }
  function fail(name: string, detail: string) {
    results.push({ name, status: "FAIL", detail });
  }

  try {
    // ── Navigate and wait for app + R3F canvas mount ──
    await page.goto("http://localhost:3000", { timeout: 30000 });
    await page.waitForSelector("canvas", { timeout: 15000 });

    // Wait for DevSceneExpose to mount (R3F useEffect fires after canvas render)
    await page.waitForFunction(
      () => typeof (window as any).__inspectScene === "function",
      { timeout: 15000 }
    );
    // Extra settle time for hydration + textures
    await page.waitForTimeout(2000);

    // ── Test 1: App loads with containers ──
    const storeState = await page.evaluate(() => {
      const s = (window as any).__store?.getState?.();
      if (!s) return null;
      return {
        containerCount: Object.keys(s.containers).length,
        viewMode: s.viewMode,
      };
    });
    if (storeState && storeState.containerCount >= 1) {
      pass("app-loads-with-containers");
    } else {
      fail("app-loads-with-containers", `got ${JSON.stringify(storeState)}`);
    }

    // ── Test 2: Scene has required components ──
    const scene = await page.evaluate(() => (window as any).__inspectScene?.());
    if (scene) {
      scene.meshCount > 0
        ? pass("scene-has-meshes")
        : fail("scene-has-meshes", `meshCount=${scene.meshCount}`);
      scene.lightsCount > 0
        ? pass("scene-has-lights")
        : fail("scene-has-lights", `lightsCount=${scene.lightsCount}`);
      scene.shadowMapEnabled
        ? pass("shadow-map-enabled")
        : fail("shadow-map-enabled", "shadowMap not enabled");
      scene.meshesWithCastShadow > 0
        ? pass("meshes-cast-shadows")
        : fail("meshes-cast-shadows", "no meshes cast shadow");
    } else {
      fail("scene-inspection", "__inspectScene() returned null");
    }

    // ── Test 3: Add container ──
    const countBefore = await page.evaluate(
      () => Object.keys((window as any).__store.getState().containers).length
    );
    await page.evaluate(() =>
      (window as any).__store.getState().addContainer("40ft_high_cube")
    );
    await page.waitForTimeout(500);
    const countAfter = await page.evaluate(
      () => Object.keys((window as any).__store.getState().containers).length
    );
    countAfter > countBefore
      ? pass("add-container")
      : fail("add-container", `before=${countBefore} after=${countAfter}`);

    // ── Test 4: Remove container (remove the one we just added) ──
    const idsAfterAdd: string[] = await page.evaluate(() =>
      Object.keys((window as any).__store.getState().containers)
    );
    const lastId = idsAfterAdd[idsAfterAdd.length - 1];
    await page.evaluate(
      (id: string) => (window as any).__store.getState().removeContainer(id),
      lastId
    );
    await page.waitForTimeout(300);
    const countAfterRemove = await page.evaluate(
      () => Object.keys((window as any).__store.getState().containers).length
    );
    countAfterRemove === countBefore
      ? pass("remove-container")
      : fail(
          "remove-container",
          `expected ${countBefore}, got ${countAfterRemove}`
        );

    // ── Test 5: Undo restores removed container ──
    await page.evaluate(() =>
      (window as any).__store.temporal?.getState?.()?.undo?.()
    );
    await page.waitForTimeout(300);
    const countAfterUndo = await page.evaluate(
      () => Object.keys((window as any).__store.getState().containers).length
    );
    countAfterUndo === countAfter
      ? pass("undo-restores-container")
      : fail(
          "undo-restores-container",
          `expected ${countAfter}, got ${countAfterUndo}`
        );

    // Redo to clean up
    await page.evaluate(() =>
      (window as any).__store.temporal?.getState?.()?.redo?.()
    );
    await page.waitForTimeout(300);

    // ── Test 6: Paint workflow (setVoxelFace) ──
    const paintResult = await page.evaluate(() => {
      const s = (window as any).__store.getState();
      const cId = Object.keys(s.containers)[0];
      if (!cId) return { face: null };
      s.setVoxelFace(cId, 10, "e", "Glass_Pane");
      const after = (window as any).__store.getState();
      const face = after.containers[cId]?.voxelGrid?.[10]?.faces?.e;
      return { face };
    });
    paintResult?.face === "Glass_Pane"
      ? pass("paint-voxel-face")
      : fail("paint-voxel-face", `face=${paintResult?.face}`);

    // Undo the paint
    await page.evaluate(() =>
      (window as any).__store.temporal?.getState?.()?.undo?.()
    );
    await page.waitForTimeout(200);

    // ── Test 7: Theme switch ──
    await page.evaluate(() =>
      (window as any).__store.getState().setTheme("japanese")
    );
    await page.waitForTimeout(300);
    const themeAfter = await page.evaluate(
      () => (window as any).__store.getState().currentTheme
    );
    themeAfter === "japanese"
      ? pass("theme-switch")
      : fail("theme-switch", `theme=${themeAfter}`);

    // Switch back
    await page.evaluate(() =>
      (window as any).__store.getState().setTheme("industrial")
    );

    // ── Test 8: View mode — Blueprint ──
    await page.evaluate(() =>
      (window as any).__store.getState().setViewMode("blueprint")
    );
    await page.waitForTimeout(500);
    const bpMode = await page.evaluate(
      () => (window as any).__store.getState().viewMode
    );
    bpMode === "blueprint"
      ? pass("viewmode-blueprint")
      : fail("viewmode-blueprint", `viewMode=${bpMode}`);

    // ── Test 9: View mode — Walkthrough ──
    await page.evaluate(() =>
      (window as any).__store.getState().setViewMode("walkthrough")
    );
    await page.waitForTimeout(500);
    const fpMode = await page.evaluate(
      () => (window as any).__store.getState().viewMode
    );
    fpMode === "walkthrough"
      ? pass("viewmode-walkthrough")
      : fail("viewmode-walkthrough", `viewMode=${fpMode}`);

    // ── Test 10: View mode — back to 3D ──
    await page.evaluate(() =>
      (window as any).__store.getState().setViewMode("3d")
    );
    await page.waitForTimeout(500);
    const mode3d = await page.evaluate(
      () => (window as any).__store.getState().viewMode
    );
    mode3d === "3d"
      ? pass("viewmode-3d")
      : fail("viewmode-3d", `viewMode=${mode3d}`);

    // ── Test 11: Export produces data ──
    const exportData = await page.evaluate(() => {
      const s = (window as any).__store.getState();
      if (typeof s.exportState === "function") {
        const data = s.exportState();
        return { hasData: !!data, type: typeof data };
      }
      return { hasData: false };
    });
    exportData?.hasData
      ? pass("export-state")
      : fail("export-state", "exportState() returned falsy");

    // ── Test 12: Save home design ──
    await page.evaluate(() => {
      (window as any).__store.getState().saveHomeDesign("E2E Test Home");
    });
    await page.waitForTimeout(300);
    const savedCount = await page.evaluate(
      () =>
        (window as any).__store.getState().libraryHomeDesigns?.length || 0
    );
    savedCount > 0
      ? pass("save-home-design")
      : fail(
          "save-home-design",
          `libraryHomeDesigns length=${savedCount}`
        );

    // ── Test 13: Door state toggle ──
    const doorResult = await page.evaluate(() => {
      const s = (window as any).__store.getState();
      const cId = Object.keys(s.containers)[0];
      if (!cId) return { doorState: null };
      // First paint a door
      s.setVoxelFace(cId, 15, "e", "Door");
      // Toggle door state
      s.toggleDoorState(cId, 15, "e");
      const after = (window as any).__store.getState();
      const doorState =
        after.containers[cId]?.voxelGrid?.[15]?.doorStates?.e;
      return { doorState };
    });
    doorResult?.doorState && doorResult.doorState !== "closed"
      ? pass("door-state-toggle")
      : fail("door-state-toggle", `doorState=${doorResult?.doorState}`);

    // Undo door changes
    await page.evaluate(() => {
      const t = (window as any).__store.temporal?.getState?.();
      t?.undo?.();
      t?.undo?.();
    });
    await page.waitForTimeout(200);

    // ── Test 14: Container role application ──
    const roleResult = await page.evaluate(() => {
      const s = (window as any).__store.getState();
      const cId = Object.keys(s.containers)[0];
      if (!cId) return { role: null };
      s.applyContainerRole(cId, "kitchen");
      const after = (window as any).__store.getState();
      return { role: after.containers[cId]?.appliedRole };
    });
    roleResult?.role === "kitchen"
      ? pass("apply-container-role")
      : fail("apply-container-role", `role=${roleResult?.role}`);

    // Undo
    await page.evaluate(() =>
      (window as any).__store.temporal?.getState?.()?.undo?.()
    );
    await page.waitForTimeout(200);

    // ── Test 15: Persistence — IndexedDB has data ──
    const hasIDB = await page.evaluate(async () => {
      try {
        const dbs = await indexedDB.databases();
        return dbs.some(
          (db: any) =>
            db.name?.includes("moduhome") || db.name?.includes("keyval")
        );
      } catch {
        return false;
      }
    });
    hasIDB
      ? pass("persistence-indexeddb")
      : fail("persistence-indexeddb", "no IndexedDB found");

    // ── Test 16: __inspectStore returns valid data ──
    const storeInspect = await page.evaluate(
      () => (window as any).__inspectStore?.()
    );
    if (
      storeInspect &&
      typeof storeInspect.containerCount === "number" &&
      storeInspect.viewMode
    ) {
      pass("inspect-store-works");
    } else {
      fail("inspect-store-works", JSON.stringify(storeInspect));
    }
  } catch (err: any) {
    fail("FATAL", err.message);
  }

  // ── Print results ──
  console.log("\n=== E2E WORKFLOW REGRESSION RESULTS ===\n");
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    const icon = r.status === "PASS" ? "\u2713" : "\u2717";
    const detail = r.detail ? ` (${r.detail})` : "";
    console.log(`  ${icon} ${r.name}: ${r.status}${detail}`);
    if (r.status === "PASS") passed++;
    else failed++;
  }
  console.log(
    `\n  Total: ${passed} passed, ${failed} failed out of ${results.length}\n`
  );

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("E2E suite crashed:", err);
  process.exit(1);
});
