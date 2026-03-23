'use client';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { formRegistry } from '@/config/formRegistry';
import { resolveSkin } from '@/utils/skinResolver';
import { getStyle } from '@/config/styleRegistry';
import { getMaterial } from '@/config/materialRegistry';
import { applyStyleEffects, applyEmberWarmth } from '@/utils/styleEffects';
import { anchorToLocalPosition, anchorToLocalRotation, localToWorld, localRotToWorld } from '@/utils/anchorMath';
import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import type { SceneObject, StyleId, StyleEffect, FormDefinition } from '@/types/sceneObject';
import type { Container } from '@/types/container';

// Module-level constant to avoid per-render allocation (Fix 6)
const WHITE = new THREE.Color('#ffffff');

// Suppress raycasts on non-interactive meshes (project anti-pattern rule)
const nullRaycast = () => {};

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

  const worldPosition = useMemo(
    () => localToWorld(position, container),
    [position, container],
  );

  const worldRotation = useMemo(
    () => localRotToWorld(rotation, container),
    [rotation, container],
  );

  return (
    <group position={worldPosition} rotation={worldRotation}>
      {/* Procedural placeholder box — replaced with GLB models in art pipeline sprint */}
      <mesh
        material={material}
        castShadow
        receiveShadow
        {...(placementMode ? { raycast: nullRaycast } : {})}
        onClick={(e) => {
          if (placementMode) return;
          e.stopPropagation();
          selectObject(objectId);
        }}
      >
        <boxGeometry args={[form.dimensions.w, form.dimensions.h, form.dimensions.d]} />
      </mesh>
      {/* Light sources for light-category forms */}
      {form.category === 'light' && (
        <LightSource object={object} form={form} effects={style?.effects} />
      )}
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

  // Use module-level WHITE constant instead of allocating per render (Fix 6)
  const baseColor = WHITE.clone();
  const ember = effects?.length ? applyEmberWarmth(effects, baseColor, 5) : null;
  const lightColor = ember?.color ?? baseColor;

  if (form.anchorType === 'ceiling') {
    const dist = ember ? ember.distance : 5;
    return (
      <spotLight
        color={lightColor}
        intensity={intensity}
        angle={Math.PI / 4}
        penumbra={0.5}
        distance={dist}
        position={[0, -0.1, 0]}
      />
    );
  }
  if (form.anchorType === 'face') {
    const dist = ember ? ember.distance * (4 / 5) : 4;
    return (
      <spotLight
        color={lightColor}
        intensity={intensity}
        angle={Math.PI / 3}
        penumbra={0.7}
        distance={dist}
        position={[0, 0, 0.1]}
      />
    );
  }
  // Floor lights (lamps)
  const dist = ember ? ember.distance * (4 / 5) : 4;
  return (
    <pointLight
      color={lightColor}
      intensity={intensity}
      distance={dist}
      position={[0, form.dimensions.h, 0]}
    />
  );
}
