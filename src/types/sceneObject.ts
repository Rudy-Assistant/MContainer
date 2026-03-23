// src/types/sceneObject.ts

// --- Enums & Unions ---

export type FormCategory = 'door' | 'window' | 'light' | 'electrical';
export type AnchorType = 'face' | 'floor' | 'ceiling';
export type WallDirection = 'n' | 's' | 'e' | 'w';

/** Type guard for wall direction strings. */
export function isWallDirection(face: string): face is WallDirection {
  return face === 'n' || face === 's' || face === 'e' || face === 'w';
}

export type StyleId =
  | 'modern' | 'industrial' | 'japanese' | 'desert_brutalist'
  | 'coastal' | 'noir_glass' | 'solarpunk' | 'frontier_rustic'
  | 'retro_capsule' | 'neo_tropical' | 'cyberpunk' | 'maker_raw'
  | 'art_deco' | 'arctic_bunker' | 'terra_adobe' | 'memphis_pop'
  | 'stealth';

export type StyleEffectType =
  | 'patina_tint' | 'paper_glow' | 'heat_shimmer' | 'salt_frost'
  | 'reflection_tint' | 'moss_glow' | 'ember_warmth' | 'soft_bloom'
  | 'dappled_light' | 'edge_glow' | 'layer_lines' | 'gold_gleam'
  | 'frost_rim' | 'clay_warmth' | 'color_punch' | 'matte_absorb';

// --- Form Definition (static catalog data) ---

export interface SkinSlot {
  id: string;
  label: string;
  materialOptions: string[];
}

export interface FormConstraints {
  requiresExteriorFace?: boolean;
  minClearanceBelow?: number;
  incompatibleWith?: string[];
}

export interface FormDefinition {
  id: string;
  category: FormCategory;
  name: string;
  description: string;
  styles: StyleId[];
  anchorType: AnchorType;
  slotWidth: 1 | 2 | 3;
  dimensions: { w: number; h: number; d: number };
  skinSlots: SkinSlot[];
  defaultSkin: Record<string, string>;
  geometry: 'procedural' | 'glb';
  glbPath?: string;
  costEstimate: number;
  constraints?: FormConstraints;
}

// --- Scene Object (placed instance, stored in Zustand) ---

export interface ObjectAnchor {
  containerId: string;
  voxelIndex: number;
  type: AnchorType;
  face?: WallDirection;
  slot?: number;
  offset?: [number, number];
}

export interface SceneObject {
  id: string;
  formId: string;
  skin: Record<string, string>;
  anchor: ObjectAnchor;
  state?: Record<string, unknown>;
}

// --- Style Definition (static catalog data) ---

export interface StyleEffect {
  type: StyleEffectType;
  targets?: string[];
  color?: string;
  intensity?: number;
}

export interface StyleDefinition {
  id: StyleId;
  label: string;
  description: string;
  defaultMaterials: Record<string, string>;
  defaultWallSurface: string;
  effects: StyleEffect[];
}

// --- Material Option (static catalog data) ---

export interface MaterialOption {
  id: string;
  label: string;
  color: string;
  metalness: number;
  roughness: number;
  applicableTo: string[];
}

// --- Quick Skin Preset ---

export interface QuickSkinPreset {
  id: string;
  styleId: StyleId;
  label: string;
  slots: Record<string, string>;
}
