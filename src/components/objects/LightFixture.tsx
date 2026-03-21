"use client";

import * as THREE from 'three';

const LIGHT_MAT = new THREE.MeshStandardMaterial({
  color: 0xf5f5f0, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide,
});
const METAL_MAT = new THREE.MeshStandardMaterial({
  color: 0x404040, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide,
});
const BULB_MAT = new THREE.MeshStandardMaterial({
  color: 0xfff8e7, emissive: 0xfff8e7, emissiveIntensity: 0.8,
});

const LIGHT_COLOR_MAP: Record<string, string> = {
  warm: '#FFE4B5', cool: '#F0F8FF', daylight: '#FFFFF0', amber: '#FFBF00',
};

const _pendantCylinder = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8);
const _pendantCone = new THREE.ConeGeometry(0.12, 0.1, 12, 1, true);
const _flushDisc = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 16);
const _trackRail = new THREE.BoxGeometry(0.6, 0.02, 0.03);
const _spotCone = new THREE.ConeGeometry(0.04, 0.06, 8);
const _recessedRing = new THREE.TorusGeometry(0.08, 0.015, 8, 24);
const _bulbSphere = new THREE.SphereGeometry(0.03, 8, 8);

interface LightFixtureProps {
  type: string;
  lightColor?: string;
  colPitch: number;
  rowPitch: number;
  vHeight: number;
}

export default function LightFixture({ type, lightColor, colPitch: _colPitch, rowPitch: _rowPitch, vHeight }: LightFixtureProps) {
  const color = LIGHT_COLOR_MAP[lightColor || 'warm'] || '#FFE4B5';
  const intensity = 2.0;
  const ceilingY = 0;

  switch (type) {
    case 'pendant':
      return (
        <group position={[0, ceilingY, 0]}>
          <mesh geometry={_pendantCylinder} material={METAL_MAT} position={[0, -0.075, 0]} raycast={() => {}} />
          <mesh geometry={_pendantCone} material={LIGHT_MAT} position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]} raycast={() => {}} />
          <mesh geometry={_bulbSphere} material={BULB_MAT} position={[0, -0.18, 0]} raycast={() => {}} />
          <pointLight color={color} intensity={intensity} distance={vHeight * 2} position={[0, -0.2, 0]} />
        </group>
      );
    case 'flush':
      return (
        <group position={[0, ceilingY, 0]}>
          <mesh geometry={_flushDisc} material={LIGHT_MAT} position={[0, -0.015, 0]} raycast={() => {}} />
          <pointLight color={color} intensity={intensity * 0.8} distance={vHeight * 1.5} position={[0, -0.05, 0]} />
        </group>
      );
    case 'track':
      return (
        <group position={[0, ceilingY, 0]}>
          <mesh geometry={_trackRail} material={METAL_MAT} position={[0, -0.01, 0]} raycast={() => {}} />
          {[-0.2, 0, 0.2].map((x, i) => (
            <group key={i} position={[x, -0.04, 0]}>
              <mesh geometry={_spotCone} material={METAL_MAT} rotation={[0, 0, 0]} raycast={() => {}} />
              <pointLight color={color} intensity={intensity * 0.6} distance={vHeight * 2} position={[0, -0.06, 0]} />
            </group>
          ))}
        </group>
      );
    case 'recessed':
      return (
        <group position={[0, ceilingY, 0]}>
          <mesh geometry={_recessedRing} material={METAL_MAT} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => {}} />
          <pointLight color={color} intensity={intensity * 0.7} distance={vHeight * 1.5} position={[0, -0.02, 0]} />
        </group>
      );
    default:
      return null;
  }
}
