/**
 * DevSceneExpose — Exposes scene graph diagnostics on window for Playwright and dev tools.
 * Only active in development mode.
 */

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type * as THREE from "three";
import type { StoreState } from "@/store/useStore";

declare global {
  interface Window {
    __threeScene?: THREE.Scene;
    __threeRenderer?: THREE.WebGLRenderer;
    __inspectScene?: () => Record<string, unknown>;
    __inspectStore?: () => Record<string, unknown>;
    __store?: typeof import("../../store/useStore").useStore;
  }
}

export function DevSceneExpose() {
  const { scene, gl } = useThree();

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    window.__threeScene = scene;
    window.__threeRenderer = gl;

    window.__inspectScene = () => {
      const info = gl.info;
      const results: Record<string, unknown> = {
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        texturesLoaded: info.memory.textures,
        geometries: info.memory.geometries,
        shadowMapEnabled: gl.shadowMap.enabled,
        meshCount: 0,
        meshesWithCastShadow: 0,
        meshesWithReceiveShadow: 0,
        materialTypes: {} as Record<string, number>,
        environmentMapPresent: !!scene.environment,
        contactShadowsPresent: false,
        cloudsPresent: false,
        fogPresent: !!scene.fog,
        lightsCount: 0,
        lightTypes: [] as string[],
        physicalMaterials: [] as Array<Record<string, unknown>>,
        normalMapsCount: 0,
        propCount: 0,
      };

      const matTypes = results.materialTypes as Record<string, number>;
      const lightTypes = results.lightTypes as string[];
      const physMats = results.physicalMaterials as Array<
        Record<string, unknown>
      >;

      scene.traverse((obj) => {
        const inspectable = obj as THREE.Object3D & {
          isMesh?: boolean;
          isLight?: boolean;
          isGroup?: boolean;
          material?: THREE.Material | THREE.Material[];
        };
        if (inspectable.isMesh) {
          (results.meshCount as number)++;
          if (inspectable.castShadow) (results.meshesWithCastShadow as number)++;
          if (inspectable.receiveShadow)
            (results.meshesWithReceiveShadow as number)++;
          const material = inspectable.material;
          const materials = Array.isArray(material) ? material : material ? [material] : [];
          for (const mat of materials) {
            const type = mat.constructor.name;
            matTypes[type] = (matTypes[type] || 0) + 1;
            if ("isMeshPhysicalMaterial" in mat && mat.isMeshPhysicalMaterial) {
              const physicalMat = mat as THREE.MeshPhysicalMaterial;
              physMats.push({
                transmission: physicalMat.transmission,
                ior: physicalMat.ior,
                hasEnvMap: !!physicalMat.envMap,
                envMapIntensity: physicalMat.envMapIntensity,
              });
            }
            if ("normalMap" in mat && mat.normalMap) (results.normalMapsCount as number)++;
          }
          if (obj.userData?.isProp || obj.userData?.isFurniture)
            (results.propCount as number)++;
        }
        if (inspectable.isLight) {
          (results.lightsCount as number)++;
          lightTypes.push(obj.constructor.name);
        }
        // Position-based cloud detection (drei Clouds don't set name)
        if (
          obj.position &&
          obj.position.y > 20 &&
          (obj.name?.includes?.("Cloud") || inspectable.isGroup)
        ) {
          results.cloudsPresent = true;
        }
        if (
          obj.name?.includes?.("ContactShadow") ||
          obj.userData?.isContactShadow
        ) {
          results.contactShadowsPresent = true;
        }
      });

      return results;
    };

    window.__inspectStore = () => {
      const s: StoreState | undefined = window.__store?.getState?.();
      if (!s) return { error: "No store" };
      const containers = s.containers || {};
      const ids = Object.keys(containers);
      return {
        containerCount: ids.length,
        containers: ids.map((id: string) => ({
          id: id.slice(0, 8),
          size: containers[id].size,
          level: containers[id].level,
          position: containers[id].position,
          role: containers[id].appliedRole,
          voxelCount: containers[id].voxelGrid?.length || 0,
        })),
        viewMode: s.viewMode,
        theme: s.currentTheme,
        timeOfDay: s.environment?.timeOfDay,
        libraryHomeDesigns: s.libraryHomeDesigns?.length || 0,
        libraryContainers: s.libraryContainers?.length || 0,
        libraryBlocks: s.libraryBlocks?.length || 0,
      };
    };

    return () => {
      delete window.__inspectScene;
      delete window.__inspectStore;
      delete window.__threeScene;
      delete window.__threeRenderer;
    };
  }, [scene, gl]);

  return null;
}
