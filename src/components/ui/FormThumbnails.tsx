/**
 * FormThumbnails.tsx — Inline SVG silhouettes for form cards.
 *
 * Each form gets a monochrome SVG outline using currentColor.
 * Renders at the given `size` (default 32px). Falls back to a generic
 * rectangle for unknown formIds.
 */

import type { CSSProperties } from 'react';

interface Props {
  formId: string;
  size?: number;
}

const svgStyle = (size: number): CSSProperties => ({
  width: size,
  height: size,
  display: 'block',
});

/** Shared SVG wrapper — viewBox 0 0 32 32, stroke currentColor */
function Svg({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={svgStyle(size)}
    >
      {children}
    </svg>
  );
}

// ── Door silhouettes ──────────────────────────────────────────

function DoorSingleSwing({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="8" y="4" width="16" height="24" rx="1" />
      <circle cx="21" cy="17" r="1.2" />
      <line x1="8" y1="4" x2="18" y2="10" />
    </Svg>
  );
}

function DoorDoubleSwing({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="24" height="24" rx="1" />
      <line x1="16" y1="4" x2="16" y2="28" />
      <circle cx="13" cy="17" r="1" />
      <circle cx="19" cy="17" r="1" />
    </Svg>
  );
}

function DoorBarnSlide({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <line x1="4" y1="6" x2="28" y2="6" />
      <rect x="6" y="7" width="14" height="21" rx="1" />
      <line x1="10" y1="7" x2="10" y2="28" />
      <line x1="13" y1="7" x2="13" y2="28" />
      <circle cx="8" cy="6" r="1.2" fill="currentColor" />
      <circle cx="18" cy="6" r="1.2" fill="currentColor" />
    </Svg>
  );
}

function DoorPocketSlide({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="24" height="24" rx="1" />
      <rect x="6" y="6" width="10" height="20" rx="0.5" strokeDasharray="2 1" />
      <line x1="20" y1="6" x2="20" y2="26" strokeDasharray="3 2" />
    </Svg>
  );
}

function DoorFrench({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="24" height="24" rx="1" />
      <line x1="16" y1="4" x2="16" y2="28" />
      <rect x="6" y="7" width="8" height="6" rx="0.5" />
      <rect x="6" y="15" width="8" height="6" rx="0.5" />
      <rect x="18" y="7" width="8" height="6" rx="0.5" />
      <rect x="18" y="15" width="8" height="6" rx="0.5" />
    </Svg>
  );
}

function DoorGlassSlide({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="24" height="24" rx="1" />
      <rect x="5" y="5" width="11" height="22" rx="0.5" strokeWidth={1} />
      <line x1="4" y1="27" x2="28" y2="27" strokeWidth={2} />
    </Svg>
  );
}

function DoorBifold({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="24" height="24" rx="1" />
      <path d="M10 4 L6 16 L10 28" />
      <path d="M16 4 L12 16 L16 28" />
      <path d="M22 4 L26 16 L22 28" />
    </Svg>
  );
}

function DoorShoji({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="6" y="4" width="20" height="24" rx="1" />
      <line x1="11" y1="4" x2="11" y2="28" />
      <line x1="16" y1="4" x2="16" y2="28" />
      <line x1="21" y1="4" x2="21" y2="28" />
      <line x1="6" y1="12" x2="26" y2="12" />
      <line x1="6" y1="20" x2="26" y2="20" />
    </Svg>
  );
}

// ── Window silhouettes ────────────────────────────────────────

function WindowStandard({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="6" y="6" width="20" height="20" rx="1" />
      <line x1="16" y1="6" x2="16" y2="26" />
      <line x1="6" y1="16" x2="26" y2="16" />
      <rect x="6" y="24" width="20" height="2" rx="0.5" fill="currentColor" opacity={0.3} />
    </Svg>
  );
}

function WindowPicture({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="3" y="8" width="26" height="16" rx="1" />
    </Svg>
  );
}

function WindowHalf({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="6" y="12" width="20" height="10" rx="1" />
      <line x1="16" y1="12" x2="16" y2="22" />
    </Svg>
  );
}

function WindowClerestory({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="10" width="24" height="6" rx="1" />
      <line x1="12" y1="10" x2="12" y2="16" />
      <line x1="20" y1="10" x2="20" y2="16" />
    </Svg>
  );
}

function WindowPorthole({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <circle cx="16" cy="16" r="9" />
      <circle cx="16" cy="16" r="7" />
      <line x1="16" y1="9" x2="16" y2="7" />
      <line x1="16" y1="23" x2="16" y2="25" />
    </Svg>
  );
}

function WindowShojiScreen({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="6" y="4" width="20" height="24" rx="1" />
      <line x1="13" y1="4" x2="13" y2="28" />
      <line x1="20" y1="4" x2="20" y2="28" />
      <line x1="6" y1="11" x2="26" y2="11" />
      <line x1="6" y1="18" x2="26" y2="18" />
    </Svg>
  );
}

function WindowDoubleHung({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="8" y="4" width="16" height="24" rx="1" />
      <line x1="8" y1="16" x2="24" y2="16" strokeWidth={2} />
      <line x1="16" y1="4" x2="16" y2="16" />
      <line x1="16" y1="16" x2="16" y2="28" />
    </Svg>
  );
}

// ── Light silhouettes ─────────────────────────────────────────

function LightPendant({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <line x1="16" y1="4" x2="16" y2="14" />
      <path d="M10 14 L16 14 L22 14 L20 24 L12 24 Z" />
      <line x1="12" y1="24" x2="20" y2="24" strokeWidth={2} />
    </Svg>
  );
}

function LightFlushMount({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <ellipse cx="16" cy="16" rx="10" ry="4" />
      <line x1="6" y1="14" x2="26" y2="14" />
    </Svg>
  );
}

function LightTrack({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <line x1="4" y1="10" x2="28" y2="10" strokeWidth={2} />
      <rect x="7" y="11" width="4" height="8" rx="1" />
      <rect x="14" y="11" width="4" height="8" rx="1" />
      <rect x="21" y="11" width="4" height="8" rx="1" />
    </Svg>
  );
}

function LightRecessed({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <line x1="4" y1="12" x2="28" y2="12" />
      <circle cx="16" cy="12" r="6" />
      <circle cx="16" cy="12" r="3" />
    </Svg>
  );
}

function LightWallSconce({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <line x1="8" y1="4" x2="8" y2="28" strokeWidth={2} />
      <path d="M8 12 L16 10 L18 16 L16 22 L8 20 Z" />
    </Svg>
  );
}

function LightStripLed({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="14" width="24" height="4" rx="2" />
      <circle cx="9" cy="16" r="1" fill="currentColor" />
      <circle cx="14" cy="16" r="1" fill="currentColor" />
      <circle cx="19" cy="16" r="1" fill="currentColor" />
      <circle cx="24" cy="16" r="1" fill="currentColor" />
    </Svg>
  );
}

function LightFloorLamp({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <line x1="16" y1="10" x2="16" y2="26" />
      <path d="M10 4 L16 10 L22 4 Z" />
      <line x1="12" y1="26" x2="20" y2="26" strokeWidth={2} />
    </Svg>
  );
}

function LightTableLamp({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <path d="M10 8 L16 4 L22 8 L20 16 L12 16 Z" />
      <rect x="14" y="16" width="4" height="8" rx="0.5" />
      <line x1="11" y1="24" x2="21" y2="24" strokeWidth={2} />
    </Svg>
  );
}

// ── Electrical silhouettes ────────────────────────────────────

function ElectricalOutlet({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="8" y="6" width="16" height="20" rx="3" />
      <line x1="14" y1="11" x2="14" y2="14" />
      <line x1="18" y1="11" x2="18" y2="14" />
      <line x1="14" y1="18" x2="14" y2="21" />
      <line x1="18" y1="18" x2="18" y2="21" />
    </Svg>
  );
}

function ElectricalSwitch({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="8" y="6" width="16" height="20" rx="3" />
      <rect x="12" y="10" width="8" height="12" rx="2" />
      <line x1="16" y1="12" x2="16" y2="16" strokeWidth={2} />
    </Svg>
  );
}

function ElectricalDimmer({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="8" y="6" width="16" height="20" rx="3" />
      <circle cx="16" cy="16" r="5" />
      <line x1="16" y1="11" x2="16" y2="13" strokeWidth={2} />
    </Svg>
  );
}

function ElectricalUsbOutlet({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="8" y="6" width="16" height="20" rx="3" />
      <line x1="14" y1="10" x2="14" y2="13" />
      <line x1="18" y1="10" x2="18" y2="13" />
      <rect x="12" y="17" width="8" height="4" rx="1" />
    </Svg>
  );
}

// ── Fallback ──────────────────────────────────────────────────

function FallbackThumbnail({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="6" y="6" width="20" height="20" rx="2" strokeDasharray="3 2" />
      <circle cx="16" cy="16" r="3" />
    </Svg>
  );
}

// ── Registry ──────────────────────────────────────────────────

const THUMBNAIL_MAP: Record<string, React.ComponentType<{ size: number }>> = {
  // Doors
  door_single_swing: DoorSingleSwing,
  door_double_swing: DoorDoubleSwing,
  door_barn_slide: DoorBarnSlide,
  door_pocket_slide: DoorPocketSlide,
  door_french: DoorFrench,
  door_glass_slide: DoorGlassSlide,
  door_bifold: DoorBifold,
  door_shoji: DoorShoji,
  // Windows
  window_standard: WindowStandard,
  window_picture: WindowPicture,
  window_half: WindowHalf,
  window_clerestory: WindowClerestory,
  window_porthole: WindowPorthole,
  window_shoji_screen: WindowShojiScreen,
  window_double_hung: WindowDoubleHung,
  // Lights
  light_pendant: LightPendant,
  light_flush_mount: LightFlushMount,
  light_track: LightTrack,
  light_recessed: LightRecessed,
  light_wall_sconce: LightWallSconce,
  light_strip_led: LightStripLed,
  light_floor_lamp: LightFloorLamp,
  light_table_lamp: LightTableLamp,
  // Electrical
  electrical_outlet: ElectricalOutlet,
  electrical_switch: ElectricalSwitch,
  electrical_dimmer: ElectricalDimmer,
  electrical_usb_outlet: ElectricalUsbOutlet,
};

export default function FormThumbnail({ formId, size = 32 }: Props) {
  const Component = THUMBNAIL_MAP[formId] ?? FallbackThumbnail;
  return <Component size={size} />;
}
