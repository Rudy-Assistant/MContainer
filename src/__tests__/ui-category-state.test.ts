import { describe, it, expect } from 'vitest';
import { useStore } from '@/store/useStore';

const s = () => useStore.getState();

describe('category selection state', () => {
  it('showHotbar defaults to false', () => {
    expect(s().showHotbar).toBe(false);
  });

  it('toggleHotbar flips showHotbar', () => {
    s().toggleHotbar();
    expect(s().showHotbar).toBe(true);
    s().toggleHotbar();
    expect(s().showHotbar).toBe(false);
  });

  it('selectedWallCategory defaults to null', () => {
    expect(s().selectedWallCategory).toBeNull();
  });

  it('setSelectedWallCategory sets and clears', () => {
    s().setSelectedWallCategory('door');
    expect(s().selectedWallCategory).toBe('door');
    s().setSelectedWallCategory(null);
    expect(s().selectedWallCategory).toBeNull();
  });

  it('selectedFloorCategory and selectedCeilingCategory work', () => {
    s().setSelectedFloorCategory('solid');
    expect(s().selectedFloorCategory).toBe('solid');
    s().setSelectedCeilingCategory('skylight');
    expect(s().selectedCeilingCategory).toBe('skylight');
    s().setSelectedFloorCategory(null);
    s().setSelectedCeilingCategory(null);
  });
});
