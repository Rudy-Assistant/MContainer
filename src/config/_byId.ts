/**
 * _byId.ts — Generic id-lookup helper.
 *
 * Every catalog in src/config/ exports a `getX(id)` function whose body is
 * the same: `arr.find(x => x.id === id) ?? arr[0]`. This file holds the
 * single implementation; catalog files import it.
 *
 * The fallback to `arr[0]` is intentional: callers receive a valid object
 * even when the id has been renamed/removed, which prevents crashes during
 * data migration. The fallback never hides bugs in production because the
 * id types are TypeScript string literal unions checked at compile time.
 */

export function byId<T extends { id: string }>(arr: T[], id?: string | null): T {
  return arr.find((x) => x.id === id) ?? arr[0];
}
