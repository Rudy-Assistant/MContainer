/**
 * Time-of-day phase classification helpers.
 *
 * Centralized so all time-dependent systems (sky, fog, lighting, HDRI,
 * glass emissive) use consistent thresholds. If you need to tune when
 * "night" begins, change it here — not in 4 different files.
 */

// ── Phase Predicates ──────────────────────────────────────────

/** Full dark (stars, no sun contribution). 0-5 and 21-24. */
export function isNight(t: number) { return t < 5 || t > 21; }

/** Golden hour / blue hour (warm light, long shadows). 5-8 and 17-21. */
export function isGoldenHour(t: number) { return (t >= 5 && t < 8) || (t > 17 && t <= 21); }

/** Deep twilight (very dim, near-night). 0-6 and 20-24. */
export function isDeepTwilight(t: number) { return t < 6 || t > 20; }

/** Twilight (dim enough for stars to be visible). 0-6.5 and 19.5-24. */
export function isTwilight(t: number) { return t < 6.5 || t > 19.5; }

/** Sun low enough that interior lights should be prominent. 0-7 and 17-24. */
export function isSunLow(t: number) { return t < 7 || t > 17; }

// ── HDRI Selection ────────────────────────────────────────────

/** Select bundled HDRI file path based on time bracket. */
export function getHdriFile(t: number): string {
  if (t >= 5 && t < 8) return '/assets/hdri/dawn.hdr';
  if (t >= 8 && t < 17) return '/assets/hdri/day.hdr';
  if (t >= 17 && t < 20) return '/assets/hdri/sunset.hdr';
  return '/assets/hdri/night.hdr';
}

// ── Light Intensity ───────────────────────────────────────────

/**
 * Interior light intensity based on time of day.
 * Daytime: 0.3 (ambient dominates), Night: 2.0, dawn/dusk linear ramp.
 */
export function getLightIntensity(t: number): number {
  if (t >= 8 && t <= 16) return 0.3;
  if (t >= 18 || t <= 5) return 2.0;
  if (t < 8) return 0.3 + (8 - t) / 3 * 1.7;
  return 0.3 + (t - 16) / 2 * 1.7;
}
