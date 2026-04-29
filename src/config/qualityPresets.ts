export type QualityPresetId = 'low' | 'medium' | 'high' | 'photoreal';

export interface QualityConfig {
  postProcessing: boolean;
  aoHalfRes: boolean;
  bloomEnabled: boolean;
  shadowMapSize: number;
  textureQuality: 'flat' | '1k' | '2k';
  useKTX2: boolean;
  usePBRTextures: boolean;
  glassClearcoat: boolean;
  envMap: 'none' | 'hdri' | 'cubeCamera';
  maxLights: number;
  lightShadows: boolean;
  groundTextured: boolean;
  groundAO: boolean;
}

export const QUALITY_PRESETS: Record<QualityPresetId, QualityConfig> = {
  low: {
    postProcessing: false,
    aoHalfRes: false,
    bloomEnabled: false,
    shadowMapSize: 1024,
    textureQuality: 'flat',
    useKTX2: false,
    usePBRTextures: false,
    glassClearcoat: false,
    envMap: 'none',
    maxLights: 4,
    lightShadows: false,
    groundTextured: false,
    groundAO: false,
  },
  medium: {
    postProcessing: true,
    aoHalfRes: true,
    bloomEnabled: true,
    shadowMapSize: 2048,
    textureQuality: '1k',
    useKTX2: false,
    usePBRTextures: true,
    glassClearcoat: false,
    envMap: 'hdri',
    maxLights: 8,
    lightShadows: false,
    groundTextured: true,
    groundAO: false,
  },
  high: {
    postProcessing: true,
    aoHalfRes: false,
    bloomEnabled: true,
    shadowMapSize: 4096,
    textureQuality: '1k',
    useKTX2: false,
    usePBRTextures: true,
    glassClearcoat: true,
    envMap: 'cubeCamera',
    maxLights: 16,
    lightShadows: true,
    groundTextured: true,
    groundAO: true,
  },
  /** Photoreal — for the "Render Hi-Res" capture flow only. Maxes every
   *  knob: 4096 shadows, 2k textures, full env map, all lights cast shadows.
   *  Not a daily-use preset; intended to be applied transiently while the
   *  user renders a still image, then reverted. */
  photoreal: {
    postProcessing: true,
    aoHalfRes: false,
    bloomEnabled: true,
    shadowMapSize: 4096,
    textureQuality: '2k',
    useKTX2: false,
    usePBRTextures: true,
    glassClearcoat: true,
    envMap: 'cubeCamera',
    maxLights: 16,
    lightShadows: true,
    groundTextured: true,
    groundAO: true,
  },
};

export const QUALITY_PRESET_IDS: QualityPresetId[] = ['low', 'medium', 'high', 'photoreal'];
export const DEFAULT_QUALITY_PRESET: QualityPresetId = 'medium';
