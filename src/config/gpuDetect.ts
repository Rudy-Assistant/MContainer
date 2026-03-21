import type { QualityPresetId } from './qualityPresets';

export interface GPUInfo {
  maxTextureSize: number;
  maxCubemapSize: number;
  maxTextureUnits: number;
  rendererName?: string;
}

const WEAK_GPU_PATTERNS = [
  /Intel.*HD\s*(Graphics\s*)?[234]/i,
  /Mali-[234]/i,
  /Adreno\s*(3[012]|4[01])/i,
  /PowerVR\s*SGX/i,
  /GMA\s*\d/i,
];

function isWeakGPU(name: string): boolean {
  return WEAK_GPU_PATTERNS.some(p => p.test(name));
}

export function detectQualityPreset(info: GPUInfo): QualityPresetId {
  let tier: QualityPresetId;

  if (info.maxTextureSize < 4096) {
    tier = 'low';
  } else if (info.maxTextureSize >= 8192) {
    tier = 'high';
  } else {
    tier = 'medium';
  }

  if (info.rendererName && isWeakGPU(info.rendererName)) {
    if (tier === 'high') tier = 'medium';
    else if (tier === 'medium') tier = 'low';
  }

  return tier;
}

export function extractGPUInfo(gl: WebGLRenderingContext | WebGL2RenderingContext): GPUInfo {
  const info: GPUInfo = {
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxCubemapSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
    maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
  };

  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (ext) {
    info.rendererName = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  }

  return info;
}
