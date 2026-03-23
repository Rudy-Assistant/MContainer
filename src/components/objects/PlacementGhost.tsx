'use client';

import { useStore } from '@/store/useStore';
import { formRegistry } from '@/config/formRegistry';
import { useRef, useMemo, useState } from 'react';
import * as THREE from 'three';

const VALID_COLOR = new THREE.Color('#22c55e');   // green
const INVALID_COLOR = new THREE.Color('#ef4444'); // red
const GHOST_OPACITY = 0.4;

// Suppress unused-variable lint — INVALID_COLOR will be used in Task 15
void INVALID_COLOR;

export function PlacementGhost() {
  const formId = useStore((s) => s.activePlacementFormId);
  const placeObject = useStore((s) => s.placeObject);

  if (!formId) return null;

  return <PlacementGhostInner formId={formId} placeObject={placeObject} />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PlacementGhostInner({ formId, placeObject }: { formId: string; placeObject: any }) {
  const form = formRegistry.get(formId);
  const meshRef = useRef<THREE.Mesh>(null);
  const [visible, _setVisible] = useState(false);

  // Suppress unused warnings — these will be wired in Task 15 (Placement Flow)
  void placeObject;
  void _setVisible;

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: VALID_COLOR,
    transparent: true,
    opacity: GHOST_OPACITY,
    depthWrite: false,
  }), []);

  const geometry = useMemo(() => {
    if (!form) return new THREE.BoxGeometry(0.5, 1, 0.1);
    return new THREE.BoxGeometry(form.dimensions.w, form.dimensions.h, form.dimensions.d);
  }, [form]);

  // TODO: In a future sprint, add useFrame + raycaster logic to:
  // 1. Cast ray from cursor against container wall faces
  // 2. Determine which voxel face the cursor is over
  // 3. Snap to nearest valid slot using getSlotsForPlacement
  // 4. Update mesh position and material color (green/red)
  // 5. On click, call placeObject with resolved anchor

  // For now, this is a structural placeholder that mounts correctly.
  // The full raycaster interaction will be wired in Task 15 (Placement Flow).

  if (!form) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      visible={visible}
      raycast={() => {}}
    />
  );
}
