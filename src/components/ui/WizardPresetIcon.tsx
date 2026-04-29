"use client";

/**
 * WizardPresetIcon — stylized SVG icons for the Quick Setup wizard.
 *
 * These replace the previous emoji icons (🔲 🏗️ 📐 etc.) which read as cartoonish.
 * Each icon is an isometric line drawing of a container shape, drawn in two
 * tones: a darker outline (var(--text-main)) and a soft accent fill that
 * shifts based on the preset's character (glass = sky-blue, wood = warm tan,
 * steel = neutral gray). The visual language is consistent with the building
 * being designed — every icon shows a recognisable architectural form.
 *
 * Pure SVG, no external icon library — keeps bundle small and lets the icon
 * adapt to the active theme.
 */

import type { WizardPresetIcon as IconKind } from "@/config/wizardPresets";

interface Props {
  kind: IconKind;
  size?: number;
}

// Shared palette
const STROKE   = "#1f2937";     // dark slate, for outlines
const FILL_BG  = "#f8fafc";     // bone, for opaque body
const FILL_GLASS = "#bfdbfe";   // sky-200, for glass walls/voids
const FILL_WOOD  = "#d4a373";   // warm tan, for decks
const FILL_STEEL = "#cbd5e1";   // slate-300, for steel
const ACCENT     = "#3b82f6";   // cobalt, for highlights
const STROKE_W   = 1.5;

function StyledSvg({ children, size = 40 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export default function WizardPresetIcon({ kind, size = 40 }: Props) {
  // All shapes are in isometric-style projection on a 64×64 grid centered roughly
  // around (32, 38) so every icon reads at the same visual weight.
  switch (kind) {
    case "box-glass": {
      // Pure glass box — translucent walls, visible far edges.
      return (
        <StyledSvg size={size}>
          <polygon points="32,12 52,22 52,46 32,56 12,46 12,22" fill={FILL_GLASS} fillOpacity={0.55} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          <polyline points="12,22 32,32 52,22" fill="none" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          <line x1="32" y1="32" x2="32" y2="56" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
        </StyledSvg>
      );
    }
    case "box": {
      // Solid steel box.
      return (
        <StyledSvg size={size}>
          <polygon points="32,12 52,22 52,46 32,56 12,46 12,22" fill={FILL_STEEL} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          <polyline points="12,22 32,32 52,22" fill="none" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          <line x1="32" y1="32" x2="32" y2="56" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
        </StyledSvg>
      );
    }
    case "open-plan": {
      // Top-down plan: a square room with no internal divisions.
      return (
        <StyledSvg size={size}>
          <rect x="10" y="14" width="44" height="36" rx="3" fill={FILL_BG} stroke={STROKE} strokeWidth={STROKE_W} />
          <line x1="10" y1="22" x2="54" y2="22" stroke={STROKE} strokeWidth={STROKE_W} strokeOpacity={0.35} />
          <circle cx="20" cy="42" r="2" fill={ACCENT} />
          <rect x="38" y="38" width="8" height="6" rx="1" fill="none" stroke={ACCENT} strokeWidth={STROKE_W} />
        </StyledSvg>
      );
    }
    case "atrium": {
      // Solid box with a square void punched through the roof.
      return (
        <StyledSvg size={size}>
          <polygon points="32,12 52,22 52,46 32,56 12,46 12,22" fill={FILL_STEEL} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          <polygon points="32,16 46,23 32,30 18,23" fill={STROKE} fillOpacity={0.85} />
          <polyline points="12,22 32,32 52,22" fill="none" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" strokeOpacity={0.6} />
        </StyledSvg>
      );
    }
    case "atrium-glass": {
      // Glass box + atrium void.
      return (
        <StyledSvg size={size}>
          <polygon points="32,12 52,22 52,46 32,56 12,46 12,22" fill={FILL_GLASS} fillOpacity={0.55} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          <polygon points="32,16 46,23 32,30 18,23" fill={STROKE} fillOpacity={0.85} />
          <polyline points="12,22 32,32 52,22" fill="none" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" strokeOpacity={0.5} />
          <line x1="32" y1="32" x2="32" y2="56" stroke={STROKE} strokeWidth={STROKE_W} strokeOpacity={0.5} strokeLinejoin="round" />
        </StyledSvg>
      );
    }
    case "terrace": {
      // Box with railing strip on top and a wooden ring around it.
      return (
        <StyledSvg size={size}>
          {/* Wood terrace ring extends past the body */}
          <polygon points="28,9 56,20 56,24 28,13 4,24 4,20" fill={FILL_WOOD} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          <polygon points="32,18 50,25 50,46 32,56 14,46 14,25" fill={FILL_STEEL} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          {/* Railing posts */}
          <line x1="14" y1="20" x2="14" y2="14" stroke={STROKE} strokeWidth={STROKE_W} />
          <line x1="50" y1="20" x2="50" y2="14" stroke={STROKE} strokeWidth={STROKE_W} />
          <line x1="14" y1="14" x2="50" y2="14" stroke={STROKE} strokeWidth={STROKE_W} strokeOpacity={0.6} />
        </StyledSvg>
      );
    }
    case "terrace-glass": {
      // Same shape, glass body.
      return (
        <StyledSvg size={size}>
          <polygon points="28,9 56,20 56,24 28,13 4,24 4,20" fill={FILL_WOOD} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          <polygon points="32,18 50,25 50,46 32,56 14,46 14,25" fill={FILL_GLASS} fillOpacity={0.55} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          <line x1="14" y1="20" x2="14" y2="14" stroke={STROKE} strokeWidth={STROKE_W} />
          <line x1="50" y1="20" x2="50" y2="14" stroke={STROKE} strokeWidth={STROKE_W} />
          <line x1="14" y1="14" x2="50" y2="14" stroke={STROKE} strokeWidth={STROKE_W} strokeOpacity={0.6} />
          <line x1="32" y1="32" x2="32" y2="56" stroke={STROKE} strokeWidth={STROKE_W} strokeOpacity={0.5} />
        </StyledSvg>
      );
    }
    case "rooftop": {
      // Solid container with a wood deck explicitly on top.
      return (
        <StyledSvg size={size}>
          <polygon points="32,18 52,28 52,52 32,62 12,52 12,28" fill={FILL_STEEL} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          {/* Top deck plank */}
          <polygon points="32,8 54,19 54,23 32,33 10,23 10,19" fill={FILL_WOOD} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          <line x1="32" y1="13" x2="32" y2="33" stroke={STROKE} strokeWidth={STROKE_W} strokeOpacity={0.5} />
          {/* Cable rails */}
          <line x1="10" y1="14" x2="54" y2="14" stroke={ACCENT} strokeWidth={STROKE_W} strokeOpacity={0.7} />
          <line x1="32" y1="3"  x2="10" y2="14" stroke={ACCENT} strokeWidth={STROKE_W} strokeOpacity={0.4} />
          <line x1="32" y1="3"  x2="54" y2="14" stroke={ACCENT} strokeWidth={STROKE_W} strokeOpacity={0.4} />
        </StyledSvg>
      );
    }
    case "tower-stack": {
      // Two stacked boxes — studio + loft / home + roof deck.
      return (
        <StyledSvg size={size}>
          {/* Lower box */}
          <polygon points="32,30 50,38 50,54 32,62 14,54 14,38" fill={FILL_GLASS} fillOpacity={0.55} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          {/* Upper box */}
          <polygon points="32,8 50,16 50,30 32,38 14,30 14,16" fill={FILL_STEEL} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          <polyline points="14,16 32,24 50,16" fill="none" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" strokeOpacity={0.6} />
          <line x1="32" y1="24" x2="32" y2="38" stroke={STROKE} strokeWidth={STROKE_W} strokeOpacity={0.6} />
          {/* Internal stair tick */}
          <polyline points="36,42 30,46 36,50" fill="none" stroke={ACCENT} strokeWidth={STROKE_W} />
        </StyledSvg>
      );
    }
    case "home": {
      // Single-volume glass home with door.
      return (
        <StyledSvg size={size}>
          <polygon points="32,8 54,20 54,46 32,58 10,46 10,20" fill={FILL_GLASS} fillOpacity={0.5} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          <polyline points="10,20 32,32 54,20" fill="none" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" strokeOpacity={0.5} />
          {/* Door */}
          <rect x="29" y="42" width="6" height="12" fill={STROKE} fillOpacity={0.85} />
          <circle cx="34" cy="49" r="0.7" fill={FILL_BG} />
        </StyledSvg>
      );
    }
    case "fortress": {
      // Solid steel bunker — heavy lines, no openings.
      return (
        <StyledSvg size={size}>
          <polygon points="32,10 52,20 52,46 32,56 12,46 12,20" fill="#7d8a99" stroke={STROKE} strokeWidth={STROKE_W + 0.5} strokeLinejoin="round" />
          <polyline points="12,20 32,30 52,20" fill="none" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
          <line x1="32" y1="30" x2="32" y2="56" stroke={STROKE} strokeWidth={STROKE_W} />
          {/* Vent grilles */}
          <line x1="22" y1="40" x2="28" y2="42" stroke={STROKE} strokeWidth={STROKE_W} />
          <line x1="22" y1="44" x2="28" y2="46" stroke={STROKE} strokeWidth={STROKE_W} />
        </StyledSvg>
      );
    }
    default:
      return null;
  }
}
