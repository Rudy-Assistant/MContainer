/**
 * Automatic mock for idb-keyval.
 * Vitest picks this up via module resolution — no vi.mock() call needed in test files.
 * Each test file gets its own module instance, so stores are isolated.
 */
import { vi } from 'vitest';

const store = new Map<string, unknown>();

export const get = vi.fn((key: string) => Promise.resolve(store.get(key) ?? null));
export const set = vi.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve(); });
export const del = vi.fn((key: string) => { store.delete(key); return Promise.resolve(); });
export const keys = vi.fn(() => Promise.resolve([...store.keys()]));
export const createStore = vi.fn();
