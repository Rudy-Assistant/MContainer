import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

/**
 * SSR-safe IndexedDB storage adapter for zustand persist middleware.
 *
 * idb-keyval's get/set/del access the global `indexedDB` object, which
 * does NOT exist during Next.js server-side rendering. Without this guard,
 * the persist middleware calls getItem() during store creation on the server,
 * triggering `ReferenceError: indexedDB is not defined` which crashes
 * hydration and can prevent the entire React tree from mounting.
 *
 * The guard checks `typeof indexedDB !== 'undefined'` (not `typeof window`)
 * because some edge runtimes have `window` but not `indexedDB`.
 */
const hasIndexedDB = typeof indexedDB !== 'undefined';

export function sanitizePersistedStorageValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.trim() === '') return null;

  try {
    JSON.parse(value);
    return value;
  } catch {
    return null;
  }
}

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    if (!hasIndexedDB) return null;
    const value = await get(name);
    const sanitized = sanitizePersistedStorageValue(value);
    if (value !== null && sanitized === null) {
      await del(name);
    }
    return sanitized;
  },
  setItem: async (name, value) => {
    if (!hasIndexedDB) return;
    await set(name, value);
  },
  removeItem: async (name) => {
    if (!hasIndexedDB) return;
    await del(name);
  },
};
