/**
 * unitFormat.ts -- Length formatting helpers (imperial vs metric).
 *
 * The codebase stores all dimensions in meters (SI). This module is the
 * single place where we render those numbers as user-facing labels.
 *
 * Notation: ASCII only -- uses 'ft' / 'in' / 'm' (not the prime/double-prime
 * unicode characters). Bruce round-3 feedback: imperial by default,
 * switchable via Settings.
 */

export type Units = 'imperial' | 'metric';

const M_PER_FT = 0.3048;
const IN_PER_FT = 12;

/**
 * Long-form length label.
 * Imperial:
 *   >= 1 ft -> "40 ft 0 in" (zero-inch suffix kept for parity with construction docs)
 *   <  1 ft -> "8 in"
 * Metric:
 *   "12.2 m" -- one decimal place for sub-100m readability.
 */
export function formatLength(meters: number, units: Units): string {
  if (units === 'imperial') {
    const totalInches = (meters / M_PER_FT) * IN_PER_FT;
    const roundedInches = Math.round(totalInches);
    const feet = Math.trunc(roundedInches / IN_PER_FT);
    const inches = Math.abs(roundedInches - feet * IN_PER_FT);
    if (feet === 0) {
      return `${roundedInches} in`;
    }
    return `${feet} ft ${inches} in`;
  }
  // metric
  return `${meters.toFixed(1)} m`;
}

/**
 * Compact length label for tight UI (BP labels, voxel labels, library tiles).
 * Imperial: feet only, rounded -- "40 ft".
 * Metric: one decimal -- "12.2 m".
 */
export function formatLengthShort(meters: number, units: Units): string {
  if (units === 'imperial') {
    const feet = Math.round(meters / M_PER_FT);
    return `${feet} ft`;
  }
  return `${meters.toFixed(1)} m`;
}
