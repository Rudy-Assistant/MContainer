'use client';

interface IsometricItemSVGProps {
  itemId: string;
  size?: number;
}

export function IsometricItemSVG({ itemId, size = 64 }: IsometricItemSVGProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {renderItem(itemId)}
    </svg>
  );
}

function renderItem(itemId: string): React.ReactNode {
  switch (itemId) {
    case 'switch':
      return (
        <g>
          {/* Wall plate */}
          <rect x="20" y="15" width="20" height="30" rx="2" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
          {/* Toggle lever — up position */}
          <rect x="27" y="19" width="6" height="10" rx="1" fill="#2563eb" />
          <rect x="27" y="33" width="6" height="8" rx="1" fill="#94a3b8" />
        </g>
      );

    case 'double_switch':
      return (
        <g>
          {/* Wall plate */}
          <rect x="15" y="15" width="30" height="30" rx="2" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
          {/* Left toggle */}
          <rect x="18" y="19" width="11" height="9" rx="1" fill="#2563eb" />
          <rect x="18" y="31" width="11" height="7" rx="1" fill="#94a3b8" />
          {/* Right toggle */}
          <rect x="31" y="19" width="11" height="9" rx="1" fill="#94a3b8" />
          <rect x="31" y="31" width="11" height="7" rx="1" fill="#2563eb" />
        </g>
      );

    case 'outlet':
      return (
        <g>
          {/* Wall plate */}
          <rect x="18" y="14" width="24" height="32" rx="2" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
          {/* Upper socket slots */}
          <rect x="22" y="19" width="4" height="7" rx="1" fill="#64748b" />
          <rect x="34" y="19" width="4" height="7" rx="1" fill="#64748b" />
          {/* Lower socket slots */}
          <rect x="22" y="32" width="4" height="7" rx="1" fill="#64748b" />
          <rect x="34" y="32" width="4" height="7" rx="1" fill="#64748b" />
        </g>
      );

    case 'dimmer':
      return (
        <g>
          {/* Wall plate */}
          <rect x="20" y="13" width="20" height="34" rx="2" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
          {/* Slider track */}
          <rect x="28" y="18" width="4" height="24" rx="2" fill="#cbd5e1" />
          {/* Slider thumb — mid position */}
          <rect x="24" y="27" width="12" height="6" rx="2" fill="#2563eb" />
        </g>
      );

    case 'pendant':
      return (
        <g>
          {/* Cord from ceiling */}
          <line x1="30" y1="5" x2="30" y2="22" stroke="#475569" strokeWidth="1.5" />
          {/* Cone shade */}
          <polygon points="30,22 20,42 40,42" fill="#f59e0b" stroke="#92400e" strokeWidth="1" />
          {/* Bulb glow */}
          <circle cx="30" cy="40" r="3" fill="#fef08a" />
          {/* Light rays */}
          <line x1="30" y1="44" x2="30" y2="50" stroke="#fef08a" strokeWidth="1" opacity="0.6" />
          <line x1="24" y1="46" x2="21" y2="51" stroke="#fef08a" strokeWidth="1" opacity="0.4" />
          <line x1="36" y1="46" x2="39" y2="51" stroke="#fef08a" strokeWidth="1" opacity="0.4" />
        </g>
      );

    case 'flush':
      return (
        <g>
          {/* Ceiling disc outer */}
          <ellipse cx="30" cy="22" rx="16" ry="6" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
          {/* Diffuser inner */}
          <ellipse cx="30" cy="22" rx="10" ry="4" fill="#fef9c3" stroke="#ca8a04" strokeWidth="0.8" />
          {/* Light cone downward */}
          <polygon points="20,28 40,28 35,50 25,50" fill="#fef08a" opacity="0.3" />
          <line x1="30" y1="28" x2="30" y2="50" stroke="#fef08a" strokeWidth="0.8" opacity="0.5" />
        </g>
      );

    case 'track':
      return (
        <g>
          {/* Track bar mounted to ceiling */}
          <rect x="8" y="18" width="44" height="6" rx="2" fill="#475569" stroke="#334155" strokeWidth="0.8" />
          {/* Three track heads */}
          <ellipse cx="16" cy="28" rx="4" ry="5" fill="#64748b" stroke="#334155" strokeWidth="0.8" />
          <ellipse cx="30" cy="28" rx="4" ry="5" fill="#64748b" stroke="#334155" strokeWidth="0.8" />
          <ellipse cx="44" cy="28" rx="4" ry="5" fill="#64748b" stroke="#334155" strokeWidth="0.8" />
          {/* Light spots */}
          <circle cx="16" cy="33" r="2" fill="#fef08a" opacity="0.8" />
          <circle cx="30" cy="33" r="2" fill="#fef08a" opacity="0.8" />
          <circle cx="44" cy="33" r="2" fill="#fef08a" opacity="0.8" />
        </g>
      );

    case 'recessed':
      return (
        <g>
          {/* Ceiling surround ring */}
          <ellipse cx="30" cy="20" rx="14" ry="5" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
          {/* Can housing */}
          <ellipse cx="30" cy="20" rx="9" ry="3.5" fill="#94a3b8" />
          {/* Lamp aperture glow */}
          <ellipse cx="30" cy="20" rx="5" ry="2" fill="#fef9c3" />
          {/* Light cone */}
          <polygon points="21,25 39,25 36,50 24,50" fill="#fef08a" opacity="0.25" />
          <ellipse cx="30" cy="50" rx="7" ry="2" fill="#fef08a" opacity="0.3" />
        </g>
      );

    default:
      return (
        <g>
          <circle cx="30" cy="30" r="20" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
          <text
            x="30"
            y="35"
            textAnchor="middle"
            fontSize="18"
            fill="#64748b"
            fontFamily="sans-serif"
            fontWeight="bold"
          >
            ?
          </text>
        </g>
      );
  }
}
