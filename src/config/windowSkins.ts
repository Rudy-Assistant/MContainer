/**
 * windowSkins.ts — Window finish/skin catalog.
 *
 * Frame material + frame colour + glass tint + sash style. Decoupled from
 * window TEMPLATES (geometry/motion) so the same Picture Window can wear an
 * industrial steel frame OR a natural-wood frame independently.
 */

export type WindowSkinId =
  | 'aluminum_black'
  | 'aluminum_white'
  | 'steel_industrial'
  | 'wood_natural'
  | 'wood_dark'
  | 'painted_white_window'
  | 'painted_black_window';

export interface WindowSkin {
  id: WindowSkinId;
  label: string;
  /** Frame colour (HTML hex). */
  frameColor: string;
  /** Mullion colour (the bars between glass panes). Falls back to frameColor. */
  mullionColor?: string;
  /** Glass tint colour. */
  glassColor: string;
  /** Light transmission of the glass (0..1). */
  glassTransmission: number;
  swatchHint: 'metal' | 'wood' | 'painted';
}

export const WINDOW_SKINS: WindowSkin[] = [
  {
    id: 'aluminum_black',
    label: 'Black Aluminium',
    frameColor: '#1c1c1c',
    mullionColor: '#1c1c1c',
    glassColor: '#dbe4ee',
    glassTransmission: 0.96,
    swatchHint: 'metal',
  },
  {
    id: 'aluminum_white',
    label: 'White Aluminium',
    frameColor: '#e8e8e6',
    mullionColor: '#d6d4d0',
    glassColor: '#dbe4ee',
    glassTransmission: 0.96,
    swatchHint: 'metal',
  },
  {
    id: 'steel_industrial',
    label: 'Steel Industrial',
    frameColor: '#2c333b',
    mullionColor: '#2c333b',
    glassColor: '#cdd5dd',
    glassTransmission: 0.88,
    swatchHint: 'metal',
  },
  {
    id: 'wood_natural',
    label: 'Natural Wood',
    frameColor: '#a07043',
    mullionColor: '#7a532f',
    glassColor: '#e3eaf3',
    glassTransmission: 0.94,
    swatchHint: 'wood',
  },
  {
    id: 'wood_dark',
    label: 'Dark-Stained Wood',
    frameColor: '#3a2620',
    mullionColor: '#241612',
    glassColor: '#cdd5dd',
    glassTransmission: 0.92,
    swatchHint: 'wood',
  },
  {
    id: 'painted_white_window',
    label: 'Painted White',
    frameColor: '#f5f5f4',
    mullionColor: '#e7e5e4',
    glassColor: '#e3eaf3',
    glassTransmission: 0.95,
    swatchHint: 'painted',
  },
  {
    id: 'painted_black_window',
    label: 'Painted Black',
    frameColor: '#1a1a1a',
    mullionColor: '#0c0c0c',
    glassColor: '#cdd5dd',
    glassTransmission: 0.92,
    swatchHint: 'painted',
  },
];

export const DEFAULT_WINDOW_SKIN: WindowSkinId = 'aluminum_black';

export function getWindowSkin(id: WindowSkinId): WindowSkin {
  const s = WINDOW_SKINS.find((k) => k.id === id);
  if (!s) return WINDOW_SKINS[0];
  return s;
}
