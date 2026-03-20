import { vi } from 'vitest';

// Polyfill requestAnimationFrame for Node test environment
(globalThis as any).requestAnimationFrame = (cb: () => void) => {
  cb();
  return 0;
};
(globalThis as any).cancelAnimationFrame = () => {};

// Global idb-keyval mock — no need to repeat vi.mock('idb-keyval') in every test file
vi.mock('idb-keyval', () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve(); }),
    del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
    keys: vi.fn(() => Promise.resolve([...store.keys()])),
    createStore: vi.fn(),
  };
});
