export function resolveSkin(
  formDefaults: Record<string, string>,
  userOverrides: Record<string, string>,
  styleDefaults?: Record<string, string>,
): Record<string, string> {
  return {
    ...formDefaults,
    ...(styleDefaults ?? {}),
    ...userOverrides,
  };
}
