'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BLOCK_PRESETS } from '@/config/blockPresets';
import { getMaterialForFace } from '@/config/materialCache';
import { useStore } from '@/store/useStore';
import { CONTAINER_DIMENSIONS, ContainerSize } from '@/types/container';
import { BlockThumbnailProvider } from './BlockThumbnailContext';

const THUMB_SIZE = 128;

function ThumbnailScene({ onCapture }: { onCapture: (id: string, url: string) => void }) {
  const { gl, scene, camera } = useThree();
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    captured.current = true;

    const themeId = useStore.getState().currentTheme ?? 'industrial';
    const dims = CONTAINER_DIMENSIONS[ContainerSize.Standard20];
    const voxW = dims.length / 6;
    const voxD = dims.width / 2;
    const vH = dims.height / 2;

    // Create lights once — reused across all presets
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 4, 2);
    scene.add(ambient, dir);

    for (const preset of BLOCK_PRESETS) {
      // Remove previous voxel group (keep lights)
      for (let i = scene.children.length - 1; i >= 0; i--) {
        if (scene.children[i] instanceof THREE.Group) scene.remove(scene.children[i]);
      }

      // Build voxel box from 6 face planes
      const group = new THREE.Group();
      const faceKeys = ['top', 'bottom', 'n', 's', 'e', 'w'] as const;
      for (const fk of faceKeys) {
        const st = preset.faces[fk];
        if (st === 'Open') continue;
        // getMaterialForFace takes 3 args: (surface, finish, theme)
        const mat = getMaterialForFace(st, undefined, themeId);
        const mesh = new THREE.Mesh();
        let plane: THREE.PlaneGeometry;
        switch (fk) {
          case 'top':
          case 'bottom':
            plane = new THREE.PlaneGeometry(voxW, voxD);
            mesh.geometry = plane;
            mesh.material = mat;
            mesh.rotation.x = fk === 'top' ? -Math.PI / 2 : Math.PI / 2;
            mesh.position.y = fk === 'top' ? vH / 2 : -vH / 2;
            break;
          case 'n':
          case 's':
            plane = new THREE.PlaneGeometry(voxW, vH);
            mesh.geometry = plane;
            mesh.material = mat;
            mesh.position.z = fk === 'n' ? -voxD / 2 : voxD / 2;
            if (fk === 's') mesh.rotation.y = Math.PI;
            break;
          case 'e':
          case 'w':
            plane = new THREE.PlaneGeometry(voxD, vH);
            mesh.geometry = plane;
            mesh.material = mat;
            mesh.position.x = fk === 'e' ? voxW / 2 : -voxW / 2;
            mesh.rotation.y = fk === 'e' ? Math.PI / 2 : -Math.PI / 2;
            break;
        }
        group.add(mesh);
      }
      scene.add(group);
      gl.render(scene, camera);
      const url = gl.domElement.toDataURL('image/png');
      onCapture(preset.id, url);
      // Dispose geometries to prevent memory leak
      group.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
      });
    }
  }, [gl, scene, camera, onCapture]);

  return null;
}

export default function BlockThumbnailRenderer({ children }: { children: React.ReactNode }) {
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const currentTheme = useStore((s) => s.currentTheme);
  const key = currentTheme ?? 'industrial';

  const handleCapture = useCallback((id: string, url: string) => {
    setThumbnails(prev => {
      const next = new Map(prev);
      next.set(id, url);
      return next;
    });
  }, []);

  return (
    <BlockThumbnailProvider thumbnails={thumbnails}>
      {children}
      <div style={{ position: 'absolute', left: -9999, top: -9999, width: THUMB_SIZE, height: THUMB_SIZE, overflow: 'hidden' }}>
        <Canvas
          key={key}
          frameloop="never"
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          camera={{ position: [2.5, 2, 2.5], fov: 35, near: 0.1, far: 50 }}
          style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
        >
          <ThumbnailScene onCapture={handleCapture} />
        </Canvas>
      </div>
    </BlockThumbnailProvider>
  );
}
