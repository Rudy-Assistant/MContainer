"use client";

import * as THREE from 'three';

const PLATE_MAT = new THREE.MeshStandardMaterial({
  color: 0xf5f5f5, metalness: 0.0, roughness: 0.6, side: THREE.DoubleSide,
});
const SLOT_MAT = new THREE.MeshStandardMaterial({
  color: 0x2a2a2e, metalness: 0.3, roughness: 0.5,
});

const _plate = new THREE.BoxGeometry(0.07, 0.11, 0.005);
const _switchSlot = new THREE.BoxGeometry(0.015, 0.04, 0.003);
const _outletSlot = new THREE.CylinderGeometry(0.008, 0.008, 0.003, 8);
const _dimmerKnob = new THREE.CylinderGeometry(0.015, 0.015, 0.006, 12);

interface ElectricalPlateProps {
  type: string;
  dir: 'n' | 's' | 'e' | 'w';
}

export default function ElectricalPlate({ type, dir }: ElectricalPlateProps) {
  const isNS = dir === 'n' || dir === 's';
  const sign = (dir === 's' || dir === 'e') ? 1 : -1;
  const offset = 0.01 * sign;
  const px = isNS ? 0 : offset;
  const pz = isNS ? offset : 0;
  const dOff: [number, number, number] = isNS ? [0, 0, 0.003 * sign] : [0.003 * sign, 0, 0];
  const rot: [number, number, number] = isNS ? [0, 0, 0] : [0, Math.PI / 2, 0];

  return (
    <group position={[px, -0.3, pz]}>
      <mesh geometry={_plate} material={PLATE_MAT} raycast={() => {}} rotation={rot} />
      {type === 'switch' && (
        <mesh geometry={_switchSlot} material={SLOT_MAT} position={dOff} rotation={rot} raycast={() => {}} />
      )}
      {type === 'double_switch' && (
        <>
          <mesh geometry={_switchSlot} material={SLOT_MAT} position={[dOff[0], 0.02, dOff[2]]} rotation={rot} raycast={() => {}} />
          <mesh geometry={_switchSlot} material={SLOT_MAT} position={[dOff[0], -0.02, dOff[2]]} rotation={rot} raycast={() => {}} />
        </>
      )}
      {type === 'outlet' && (
        <>
          <mesh geometry={_outletSlot} material={SLOT_MAT} position={[isNS ? -0.012 : dOff[0], 0.015, isNS ? dOff[2] : -0.012]} rotation={[Math.PI / 2, 0, 0]} raycast={() => {}} />
          <mesh geometry={_outletSlot} material={SLOT_MAT} position={[isNS ? 0.012 : dOff[0], 0.015, isNS ? dOff[2] : 0.012]} rotation={[Math.PI / 2, 0, 0]} raycast={() => {}} />
          <mesh geometry={_outletSlot} material={SLOT_MAT} position={[isNS ? 0 : dOff[0], -0.01, isNS ? dOff[2] : 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => {}} />
        </>
      )}
      {type === 'dimmer' && (
        <mesh geometry={_dimmerKnob} material={SLOT_MAT} position={dOff} rotation={[Math.PI / 2, 0, 0]} raycast={() => {}} />
      )}
    </group>
  );
}
