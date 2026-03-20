/**
 * validation.ts — Shared types for the design validation engine.
 *
 * Pure type definitions — no React, no Three.js, no runtime code.
 */

import type { Container } from '@/types/container';

/** Warning categories for design validation */
export type WarningCategory = 'safety' | 'accessibility' | 'weather' | 'structural' | 'budget';

/** Warning severity levels */
export type WarningSeverity = 'error' | 'warning' | 'info';

/** A single design validation warning */
export interface DesignWarning {
  /** Deterministic ID: "{category}-{containerId}-{voxelIdx}-{face}" */
  id: string;
  category: WarningCategory;
  severity: WarningSeverity;
  /** Human-readable warning message */
  message: string;
  /** Container this warning relates to */
  containerId: string;
  /** Affected voxel indices (for 3D highlight) */
  voxelIndices: number[];
  /** Affected face directions (for edge highlights) */
  faces?: string[];
}

/** A validation rule function — pure, no React/Three dependencies */
export type ValidationRule = (
  containers: Record<string, Container>,
  options?: { budgetThreshold?: number }
) => DesignWarning[];
