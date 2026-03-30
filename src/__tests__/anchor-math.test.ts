import { describe, it, expect } from 'vitest';
import {
  anchorToLocalPosition,
  anchorToLocalRotation,
  localToWorld,
  localRotToWorld,
} from '@/utils/anchorMath';
import { ContainerSize, CONTAINER_DIMENSIONS } from '@/types/container';
import { createContainer } from '@/types/factories';
import type { SceneObject } from '@/types/sceneObject';

type Anchor = SceneObject['anchor'];
const CID = 'test-container';

const HC40 = ContainerSize.HighCube40;
const dims = CONTAINER_DIMENSIONS[HC40];
const colPitch = dims.length / 6;
const rowPitch = dims.width / 2;
const vHeight = dims.height / 2; // 2 levels

function makeContainer(rotation = 0, x = 0, z = 0) {
  const c = createContainer(HC40, { x, y: 0, z });
  c.rotation = rotation;
  return c;
}

describe('anchorToLocalPosition', () => {
  const container = makeContainer();

  it('floor anchor at voxel 0 (row=0, col=0, level=0)', () => {
    const anchor: Anchor = { containerId: CID, voxelIndex: 0, type: 'floor' };
    const [x, y, z] = anchorToLocalPosition(anchor, container);
    // col=0 → X = -(0-3.5)*colPitch = 3.5*colPitch
    expect(x).toBeCloseTo(3.5 * colPitch);
    // floor Y = level * vHeight = 0
    expect(y).toBeCloseTo(0);
    // row=0 → Z = (0-1.5)*rowPitch = -1.5*rowPitch
    expect(z).toBeCloseTo(-1.5 * rowPitch);
  });

  it('ceiling anchor at level 0', () => {
    const anchor: Anchor = { containerId: CID, voxelIndex: 0, type: 'ceiling' };
    const [, y] = anchorToLocalPosition(anchor, container);
    expect(y).toBeCloseTo(vHeight);
  });

  it('floor anchor with offset', () => {
    const anchor: Anchor = { containerId: CID, voxelIndex: 0, type: 'floor', offset: [0.5, -0.3] };
    const [x, , z] = anchorToLocalPosition(anchor, container);
    expect(x).toBeCloseTo(3.5 * colPitch + 0.5);
    expect(z).toBeCloseTo(-1.5 * rowPitch - 0.3);
  });

  it('level 1 voxel (index 32+) has elevated Y', () => {
    // Level 1 starts at index 32 (= 1 * 4 * 8)
    const anchor: Anchor = { containerId: CID, voxelIndex: 32, type: 'floor' };
    const [, y] = anchorToLocalPosition(anchor, container);
    expect(y).toBeCloseTo(vHeight);
  });

  it('face anchor on north wall', () => {
    // voxel index 9 = row 1, col 1
    const anchor: Anchor = { containerId: CID, voxelIndex: 9, type: 'face', face: 'n' };
    const [x, y, z] = anchorToLocalPosition(anchor, container);
    // col=1 → cx = -(1-3.5)*colPitch = 2.5*colPitch
    expect(x).toBeCloseTo(2.5 * colPitch);
    // center Y for level 0
    expect(y).toBeCloseTo(vHeight / 2);
    // row=1 → cz = (1-1.5)*rowPitch = -0.5*rowPitch, then -rowPitch/2 for north face
    expect(z).toBeCloseTo(-0.5 * rowPitch - rowPitch / 2);
  });

  it('face anchor with slot=2 (center)', () => {
    const anchor: Anchor = { containerId: CID, voxelIndex: 9, type: 'face', face: 'n', slot: 2 };
    const [x] = anchorToLocalPosition(anchor, container);
    // slot offset = (2-1) * (colPitch/3) = colPitch/3
    expect(x).toBeCloseTo(2.5 * colPitch + colPitch / 3);
  });

  it('face anchor south wall', () => {
    const anchor: Anchor = { containerId: CID, voxelIndex: 9, type: 'face', face: 's' };
    const [, , z] = anchorToLocalPosition(anchor, container);
    expect(z).toBeCloseTo(-0.5 * rowPitch + rowPitch / 2);
  });

  it('face anchor east wall', () => {
    const anchor: Anchor = { containerId: CID, voxelIndex: 9, type: 'face', face: 'e' };
    const [x] = anchorToLocalPosition(anchor, container);
    expect(x).toBeCloseTo(2.5 * colPitch + colPitch / 2);
  });

  it('face anchor west wall', () => {
    const anchor: Anchor = { containerId: CID, voxelIndex: 9, type: 'face', face: 'w' };
    const [x] = anchorToLocalPosition(anchor, container);
    expect(x).toBeCloseTo(2.5 * colPitch - colPitch / 2);
  });
});

describe('anchorToLocalRotation', () => {
  it('floor/ceiling return [0,0,0]', () => {
    expect(anchorToLocalRotation({ containerId: CID, voxelIndex: 0, type: 'floor' })).toEqual([0, 0, 0]);
    expect(anchorToLocalRotation({ containerId: CID, voxelIndex: 0, type: 'ceiling' })).toEqual([0, 0, 0]);
  });

  it('face directions map to correct Y rotations', () => {
    const n = anchorToLocalRotation({ containerId: CID, voxelIndex: 0, type: 'face', face: 'n' });
    const s = anchorToLocalRotation({ containerId: CID, voxelIndex: 0, type: 'face', face: 's' });
    const e = anchorToLocalRotation({ containerId: CID, voxelIndex: 0, type: 'face', face: 'e' });
    const w = anchorToLocalRotation({ containerId: CID, voxelIndex: 0, type: 'face', face: 'w' });

    expect(n[1]).toBeCloseTo(0);
    expect(s[1]).toBeCloseTo(Math.PI);
    expect(e[1]).toBeCloseTo(-Math.PI / 2);
    expect(w[1]).toBeCloseTo(Math.PI / 2);
  });
});

describe('localToWorld', () => {
  it('zero rotation passes through with offset', () => {
    const c = makeContainer(0, 5, 3);
    const [wx, wy, wz] = localToWorld([1, 2, 3], c);
    expect(wx).toBeCloseTo(6);
    expect(wy).toBeCloseTo(2);
    expect(wz).toBeCloseTo(6);
  });

  it('90-degree rotation swaps X/Z', () => {
    const c = makeContainer(Math.PI / 2, 0, 0);
    const [wx, , wz] = localToWorld([1, 0, 0], c);
    // cos(π/2)≈0, sin(π/2)≈1 → wx = 1*0 - 0*1 = 0, wz = 1*1 + 0*0 = 1
    expect(wx).toBeCloseTo(0);
    expect(wz).toBeCloseTo(1);
  });
});

describe('localRotToWorld', () => {
  it('adds container rotation to Y', () => {
    const c = makeContainer(Math.PI / 4);
    const [rx, ry, rz] = localRotToWorld([0.1, 0.5, 0.2], c);
    expect(rx).toBeCloseTo(0.1);
    expect(ry).toBeCloseTo(0.5 + Math.PI / 4);
    expect(rz).toBeCloseTo(0.2);
  });
});
