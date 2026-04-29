/**
 * doorSkins.ts — Door finish/skin catalog.
 *
 * A "skin" is the visual treatment applied on top of a door TEMPLATE: frame
 * material + frame colour + panel infill (solid wood, painted, glazed, …) +
 * hardware tint. Skins are decoupled from templates so the same Single-Swing
 * door can be styled as walnut, painted white, steel industrial, or full glass.
 *
 * Renderer reads skin properties to choose materials + colours; geometry comes
 * from the template.
 */

export type DoorSkinId =
  | 'oak_solid'
  | 'oak_reclaimed'
  | 'walnut_dark'
  | 'walnut_glazed'
  | 'painted_white'
  | 'painted_black'
  | 'painted_white_glazed'
  | 'steel_industrial'
  | 'aluminum_black_glazed'
  | 'aluminum_white_glazed'
  | 'hinoki_natural';

export interface DoorSkin {
  id: DoorSkinId;
  label: string;
  /** Body / panel colour (HTML hex). */
  panelColor: string;
  /** Frame colour. Falls back to panelColor when absent. */
  frameColor?: string;
  /** Hardware tint (handle, hinge, track). */
  hardwareColor: string;
  /** True = panel is glazed (allow transparency / glass shader). */
  glazed: boolean;
  /** Transmission used when `glazed` is true. */
  glassTransmission?: number;
  /** Hint that pickers can use to draw a swatch icon. */
  swatchHint: 'wood' | 'painted' | 'metal' | 'glass';
}

export const DOOR_SKINS: DoorSkin[] = [
  {
    id: 'oak_solid',
    label: 'Solid Oak',
    panelColor: '#a07043',
    frameColor: '#7a532f',
    hardwareColor: '#3a2410',
    glazed: false,
    swatchHint: 'wood',
  },
  {
    id: 'oak_reclaimed',
    label: 'Reclaimed Oak',
    panelColor: '#8a5a30',
    frameColor: '#5e3d20',
    hardwareColor: '#1c1a18',
    glazed: false,
    swatchHint: 'wood',
  },
  {
    id: 'walnut_dark',
    label: 'Dark Walnut',
    panelColor: '#3a2620',
    frameColor: '#241612',
    hardwareColor: '#0f0a08',
    glazed: false,
    swatchHint: 'wood',
  },
  {
    id: 'walnut_glazed',
    label: 'Walnut + Glass',
    panelColor: '#3a2620',
    frameColor: '#241612',
    hardwareColor: '#0f0a08',
    glazed: true,
    glassTransmission: 0.85,
    swatchHint: 'glass',
  },
  {
    id: 'painted_white',
    label: 'Painted White',
    panelColor: '#f5f5f4',
    frameColor: '#e7e5e4',
    hardwareColor: '#3a3a3a',
    glazed: false,
    swatchHint: 'painted',
  },
  {
    id: 'painted_black',
    label: 'Painted Black',
    panelColor: '#1a1a1a',
    frameColor: '#0c0c0c',
    hardwareColor: '#9c9c9c',
    glazed: false,
    swatchHint: 'painted',
  },
  {
    id: 'painted_white_glazed',
    label: 'White + Glass',
    panelColor: '#f5f5f4',
    frameColor: '#e7e5e4',
    hardwareColor: '#3a3a3a',
    glazed: true,
    glassTransmission: 0.92,
    swatchHint: 'glass',
  },
  {
    id: 'steel_industrial',
    label: 'Steel Industrial',
    panelColor: '#5a6470',
    frameColor: '#2c333b',
    hardwareColor: '#9aa3ad',
    glazed: false,
    swatchHint: 'metal',
  },
  {
    id: 'aluminum_black_glazed',
    label: 'Black Aluminium + Glass',
    panelColor: '#1c1c1c',
    frameColor: '#1c1c1c',
    hardwareColor: '#3a3a3a',
    glazed: true,
    glassTransmission: 0.95,
    swatchHint: 'glass',
  },
  {
    id: 'aluminum_white_glazed',
    label: 'White Aluminium + Glass',
    panelColor: '#e8e8e6',
    frameColor: '#d6d4d0',
    hardwareColor: '#9c9a96',
    glazed: true,
    glassTransmission: 0.95,
    swatchHint: 'glass',
  },
  {
    id: 'hinoki_natural',
    label: 'Hinoki Cedar',
    panelColor: '#d4b896',
    frameColor: '#b8956a',
    hardwareColor: '#6b4f30',
    glazed: false,
    swatchHint: 'wood',
  },
];

export const DEFAULT_DOOR_SKIN: DoorSkinId = 'oak_solid';

export function getDoorSkin(id: DoorSkinId): DoorSkin {
  const s = DOOR_SKINS.find((k) => k.id === id);
  if (!s) return DOOR_SKINS[0];
  return s;
}
