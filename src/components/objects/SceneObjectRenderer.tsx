'use client';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { formRegistry } from '@/config/formRegistry';
import { resolveSkin } from '@/utils/skinResolver';
import { getStyle } from '@/config/styleRegistry';
import { getMaterial } from '@/config/materialRegistry';
import { applyStyleEffects, applyEmberWarmth } from '@/utils/styleEffects';
import { anchorToLocalPosition, anchorToLocalRotation, localToWorld, localRotToWorld } from '@/utils/anchorMath';
import { getProceduralGeometry } from '@/utils/proceduralGeometry';
import { Suspense, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { SceneObject, StyleId, StyleEffect, FormDefinition } from '@/types/sceneObject';
import type { Container } from '@/types/container';

// Module-level constant to avoid per-render allocation (Fix 6)
const WHITE = new THREE.Color('#ffffff');

import { nullRaycast } from '@/utils/nullRaycast';

export function SceneObjectRenderer() {
  const objectIds = useStore(useShallow((s) => Object.keys(s.sceneObjects)));
  const activeStyle = useStore((s) => s.activeStyle);

  if (objectIds.length === 0) return null;

  return (
    <group>
      {objectIds.map((id) => (
        <SceneObjectMesh key={id} objectId={id} styleId={activeStyle} />
      ))}
    </group>
  );
}

/**
 * Wrapper component: reads store, guards nulls, then delegates to SceneObjectMeshInner.
 * This pattern ensures all hooks in the inner component run unconditionally (Fix 3).
 */
function SceneObjectMesh({ objectId, styleId }: { objectId: string; styleId: StyleId }) {
  const object = useStore((s) => s.sceneObjects[objectId]);
  const container = useStore((s) =>
    object ? s.containers[object.anchor.containerId] : undefined,
  );
  const placementMode = useStore((s) => s.placementMode);
  const selectObject = useStore((s) => s.selectObject);

  if (!object || !container) return null;

  const form = formRegistry.get(object.formId);
  if (!form) return null;

  return (
    <SceneObjectMeshInner
      object={object}
      container={container}
      form={form}
      objectId={objectId}
      styleId={styleId}
      placementMode={placementMode}
      selectObject={selectObject}
    />
  );
}

function SceneObjectMeshInner({
  object,
  container,
  form,
  objectId,
  styleId,
  placementMode,
  selectObject,
}: {
  object: SceneObject;
  container: Container;
  form: FormDefinition;
  objectId: string;
  styleId: StyleId;
  placementMode: boolean;
  selectObject: (id: string | null) => void;
}) {
  const style = getStyle(styleId);
  const resolvedSkin = resolveSkin(form.defaultSkin, object.skin, style?.defaultMaterials);

  const position = useMemo(
    () => anchorToLocalPosition(object.anchor, container),
    [object.anchor, container],
  );
  const rotation = useMemo(() => anchorToLocalRotation(object.anchor), [object.anchor]);

  const worldPosition = useMemo(
    () => localToWorld(position, container),
    [position, container],
  );

  const worldRotation = useMemo(
    () => localRotToWorld(rotation, container),
    [rotation, container],
  );

  // GLB branch: load model and apply skin materials
  if (form.geometry === 'glb' && form.glbPath) {
    return (
      <Suspense fallback={
        <ProceduralFormMesh
          form={form}
          resolvedSkin={resolvedSkin}
          worldPosition={worldPosition}
          worldRotation={worldRotation}
          style={style}
          objectId={objectId}
          placementMode={placementMode}
          selectObject={selectObject}
        />
      }>
        <GlbFormMesh
          glbPath={form.glbPath}
          form={form}
          resolvedSkin={resolvedSkin}
          worldPosition={worldPosition}
          worldRotation={worldRotation}
          style={style}
          objectId={objectId}
          placementMode={placementMode}
          selectObject={selectObject}
        />
        {form.category === 'light' && (
          <group position={worldPosition} rotation={worldRotation}>
            <LightSource object={object} form={form} effects={style?.effects} />
          </group>
        )}
      </Suspense>
    );
  }

  // Procedural branch: improved category-specific placeholder shapes
  return (
    <>
      <ProceduralFormMesh
        form={form}
        resolvedSkin={resolvedSkin}
        worldPosition={worldPosition}
        worldRotation={worldRotation}
        style={style}
        objectId={objectId}
        placementMode={placementMode}
        selectObject={selectObject}
      />
      {form.category === 'light' && (
        <group position={worldPosition} rotation={worldRotation}>
          <LightSource object={object} form={form} effects={style?.effects} />
        </group>
      )}
    </>
  );
}

/** Procedural placeholder mesh with category-specific geometry. */
function ProceduralFormMesh({
  form,
  resolvedSkin,
  worldPosition,
  worldRotation,
  style,
  objectId,
  placementMode,
  selectObject,
}: {
  form: FormDefinition;
  resolvedSkin: Record<string, string>;
  worldPosition: [number, number, number];
  worldRotation: [number, number, number];
  style: ReturnType<typeof getStyle>;
  objectId: string;
  placementMode: boolean;
  selectObject: (id: string | null) => void;
}) {
  // Look up material for the primary skin slot
  const primarySlot = form.skinSlots[0]?.id ?? 'frame';
  const matId = resolvedSkin[primarySlot] ?? 'raw_steel';
  const matDef = getMaterial(matId);

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: matDef?.color ?? '#888888',
      metalness: matDef?.metalness ?? 0.5,
      roughness: matDef?.roughness ?? 0.5,
    });
    if (style?.effects?.length) {
      applyStyleEffects(mat, style.effects);
    }
    return mat;
  }, [matDef?.color, matDef?.metalness, matDef?.roughness, style?.effects]);

  // Dispose material when it changes or component unmounts (Fix 4)
  useEffect(() => () => { material.dispose(); }, [material]);

  const geometry = useMemo(
    () => getProceduralGeometry(form.id, form.category, form.dimensions),
    [form.id, form.category, form.dimensions],
  );

  return (
    <group position={worldPosition} rotation={worldRotation}>
      <mesh
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        {...(placementMode ? { raycast: nullRaycast } : {})}
        onClick={(e) => {
          if (placementMode) return;
          e.stopPropagation();
          selectObject(objectId);
        }}
      />
    </group>
  );
}

/** GLB model mesh with per-mesh skin material application. */
function GlbFormMesh({
  glbPath,
  form,
  resolvedSkin,
  worldPosition,
  worldRotation,
  style,
  objectId,
  placementMode,
  selectObject,
}: {
  glbPath: string;
  form: FormDefinition;
  resolvedSkin: Record<string, string>;
  worldPosition: [number, number, number];
  worldRotation: [number, number, number];
  style: ReturnType<typeof getStyle>;
  objectId: string;
  placementMode: boolean;
  selectObject: (id: string | null) => void;
}) {
  const { scene } = useGLTF(glbPath);

  // Clone the scene so each instance gets its own materials.
  // Convention: mesh names in the GLB match skin slot IDs (e.g., "frame", "panel", "glass").
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);

    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Apply skin material if this mesh name matches a skin slot
        if (child.name) {
          const skinMatId = resolvedSkin[child.name];
          if (skinMatId) {
            const matDef = getMaterial(skinMatId);
            if (matDef) {
              const mat = new THREE.MeshStandardMaterial({
                color: matDef.color,
                metalness: matDef.metalness,
                roughness: matDef.roughness,
              });
              if (style?.effects?.length) {
                applyStyleEffects(mat, style.effects);
              }
              child.material = mat;
            }
          }
        }
        child.castShadow = true;
        child.receiveShadow = true;
        // Suppress raycasts on individual meshes — clicks handled by the group onClick
        child.raycast = nullRaycast;
      }
    });

    return clone;
  }, [scene, resolvedSkin, style?.effects]);

  // Dispose cloned materials AND geometries on unmount or when clone changes
  useEffect(() => {
    return () => {
      clonedScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) (child.material as THREE.Material).dispose();
          if (child.geometry) child.geometry.dispose();
        }
      });
    };
  }, [clonedScene]);

  return (
    <group
      position={worldPosition}
      rotation={worldRotation}
      onClick={placementMode ? undefined : (e) => { e.stopPropagation(); selectObject(objectId); }}
      {...(placementMode ? { raycast: nullRaycast } : {})}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

function LightSource({
  object,
  form,
  effects,
}: {
  object: SceneObject;
  form: FormDefinition;
  effects?: StyleEffect[];
}) {
  const brightness = (object.state?.brightness as number) ?? 75;
  const intensity = (brightness / 100) * 2; // 0-2 range

  // Memoize color computation to avoid allocating a new THREE.Color per render
  const { lightColor, lightDistance } = useMemo(() => {
    const base = WHITE.clone();
    const em = effects?.length ? applyEmberWarmth(effects, base, 5) : null;
    return { lightColor: em?.color ?? base, lightDistance: em?.distance ?? 5 };
  }, [effects]);

  if (form.anchorType === 'ceiling') {
    return (
      <spotLight
        color={lightColor}
        intensity={intensity}
        angle={Math.PI / 4}
        penumbra={0.5}
        distance={lightDistance}
        position={[0, -0.1, 0]}
      />
    );
  }
  if (form.anchorType === 'face') {
    return (
      <spotLight
        color={lightColor}
        intensity={intensity}
        angle={Math.PI / 3}
        penumbra={0.7}
        distance={lightDistance * 0.8}
        position={[0, 0, 0.1]}
      />
    );
  }
  // Floor lights (lamps)
  return (
    <pointLight
      color={lightColor}
      intensity={intensity}
      distance={lightDistance * 0.8}
      position={[0, form.dimensions.h, 0]}
    />
  );
}
