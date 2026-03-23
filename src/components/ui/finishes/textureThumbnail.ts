export interface SwatchItem {
  id: string;
  label: string;
  color: string;
  textureFolder?: string;
}

/** Returns the runtime URL for a texture thumbnail, or null if no texture folder */
export function getSwatchSrc(item: SwatchItem): string | null {
  if (!item.textureFolder) return null;
  return `/assets/materials/${item.textureFolder}/color.jpg`;
}

const _cache = new Map<string, string>();

/** Generate a canvas data URL with noise pattern from a hex color. Cached by id. */
export function generateNoiseSwatch(id: string, hex: string, size = 64): string {
  const key = `${id}:${hex}`;
  const cached = _cache.get(key);
  if (cached) return cached;

  const canvas = typeof document !== 'undefined'
    ? document.createElement('canvas')
    : { width: size, height: size, getContext: () => null, toDataURL: () => '' } as unknown as HTMLCanvasElement;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = `data:image/png;base64,`;
    _cache.set(key, fallback);
    return fallback;
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const imageData = ctx.createImageData(size, size);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const noise = Math.random() * 20 - 10;
    d[i]     = Math.max(0, Math.min(255, r + noise));
    d[i + 1] = Math.max(0, Math.min(255, g + noise));
    d[i + 2] = Math.max(0, Math.min(255, b + noise));
    d[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  const dataUrl = canvas.toDataURL('image/png');
  _cache.set(key, dataUrl);
  return dataUrl;
}
