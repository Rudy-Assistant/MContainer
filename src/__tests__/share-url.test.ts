import { describe, it, expect, vi } from 'vitest';
import { encodeDesign, decodeDesign, buildShareUrl } from '@/utils/shareUrl';
import { createContainer } from '@/types/factories';
import { ContainerSize } from '@/types/container';

function makeContainerRecord(...containers: ReturnType<typeof createContainer>[]) {
  const record: Record<string, ReturnType<typeof createContainer>> = {};
  for (const c of containers) {
    record[c.id] = c;
  }
  return record;
}

describe('shareUrl', () => {
  describe('encodeDesign / decodeDesign round-trip', () => {
    it('handles empty containers', () => {
      const encoded = encodeDesign({});
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = decodeDesign(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded!.v).toBe(1);
      expect(decoded!.containers).toEqual([]);
      expect(decoded!.stacking).toEqual([]);
    });

    it('round-trips a single container', () => {
      const c = createContainer(ContainerSize.Standard20, { x: 1, y: 0, z: 2 });
      const record = makeContainerRecord(c);

      const encoded = encodeDesign(record);
      const decoded = decodeDesign(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.containers).toHaveLength(1);

      const sc = decoded!.containers[0];
      expect(sc.size).toBe(ContainerSize.Standard20);
      expect(sc.position).toEqual({ x: 1, y: 0, z: 2 });
      expect(sc.rotation).toBe(0);
      expect(sc.level).toBe(0);
      expect(sc.voxelGrid).toBeDefined();
    });

    it('round-trips multiple containers', () => {
      const c1 = createContainer(ContainerSize.Standard20, { x: 0, y: 0, z: 0 });
      const c2 = createContainer(ContainerSize.HighCube40, { x: 10, y: 0, z: 0 });
      const record = makeContainerRecord(c1, c2);

      const decoded = decodeDesign(encodeDesign(record));

      expect(decoded).not.toBeNull();
      expect(decoded!.containers).toHaveLength(2);
      expect(decoded!.stacking).toEqual([]);
    });

    it('preserves stacking relationships', () => {
      const bottom = createContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 'Bottom', 0);
      const top = createContainer(ContainerSize.HighCube40, { x: 0, y: 2.9, z: 0 }, 'Top', 1);
      top.stackedOn = bottom.id;
      bottom.supporting = [top.id];

      const record = makeContainerRecord(bottom, top);
      const decoded = decodeDesign(encodeDesign(record));

      expect(decoded).not.toBeNull();
      expect(decoded!.stacking).toHaveLength(1);

      const rel = decoded!.stacking[0];
      // bottom is index 0, top is index 1 (insertion order)
      expect(rel.topIndex).toBe(1);
      expect(rel.bottomIndex).toBe(0);
    });

    it('preserves interiorFinish when set', () => {
      const c = createContainer(ContainerSize.Standard40);
      (c as any).interiorFinish = 'plywood';
      const record = makeContainerRecord(c);

      const decoded = decodeDesign(encodeDesign(record));
      expect(decoded!.containers[0].interiorFinish).toBe('plywood');
    });

    it('omits interiorFinish when not set', () => {
      const c = createContainer(ContainerSize.Standard40);
      const record = makeContainerRecord(c);

      const decoded = decodeDesign(encodeDesign(record));
      expect(decoded!.containers[0].interiorFinish).toBeUndefined();
    });

    it('strips non-shared fields (id, walls, furniture, etc.)', () => {
      const c = createContainer(ContainerSize.HighCube40);
      const record = makeContainerRecord(c);

      const decoded = decodeDesign(encodeDesign(record));
      const sc = decoded!.containers[0] as any;

      expect(sc.id).toBeUndefined();
      expect(sc.walls).toBeUndefined();
      expect(sc.furniture).toBeUndefined();
      expect(sc.stackedOn).toBeUndefined();
      expect(sc.supporting).toBeUndefined();
    });
  });

  describe('decodeDesign error handling', () => {
    it('returns null for empty string', () => {
      expect(decodeDesign('')).toBeNull();
    });

    it('returns null for random garbage', () => {
      expect(decodeDesign('not-valid-lz-data!!!')).toBeNull();
    });

    it('returns null for valid LZ but invalid JSON structure', () => {
      // Encode a non-design object
      const LZString = require('lz-string');
      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify({ foo: 'bar' }));
      expect(decodeDesign(encoded)).toBeNull();
    });

    it('returns null for valid LZ with non-JSON content', () => {
      const LZString = require('lz-string');
      const encoded = LZString.compressToEncodedURIComponent('not json at all');
      expect(decodeDesign(encoded)).toBeNull();
    });
  });

  describe('buildShareUrl', () => {
    it('includes the encoded design as ?d= parameter', () => {
      vi.stubGlobal('window', {
        location: { origin: 'https://moduhome.app', pathname: '/editor' },
      });

      const c = createContainer(ContainerSize.Standard20);
      const url = buildShareUrl(makeContainerRecord(c));

      expect(url).toMatch(/^https:\/\/moduhome\.app\/editor\?d=.+/);

      // The d= param should decode back to the same design
      const dParam = url.split('?d=')[1];
      const decoded = decodeDesign(dParam);
      expect(decoded).not.toBeNull();
      expect(decoded!.containers).toHaveLength(1);

      vi.unstubAllGlobals();
    });

    it('uses empty base when window is undefined', () => {
      vi.stubGlobal('window', undefined);

      const url = buildShareUrl({});
      expect(url).toMatch(/^\?d=.+/);

      vi.unstubAllGlobals();
    });
  });
});
