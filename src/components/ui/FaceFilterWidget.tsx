"use client";

/**
 * FaceFilterWidget — isometric mini-cube that filters 3D viewport pointer events
 * to a single face category.
 *
 * The motivating problem: ceiling and floor tiles are hard to hover/click in a
 * dense scene because walls intercept the pointer first. By picking the **top**
 * face on this cube, the user tells the canvas "only let me interact with
 * ceiling faces". Same for floors and walls.
 *
 * Visual: an isometric SVG cube with 3 visible face polygons — top (roof),
 * front-left (walls), front-right (also walls). Below it, two text chips:
 * "Floor" (sets bottom filter — bottom face is hidden in iso projection) and
 * "All" (clears the filter).
 *
 * Clicking the same face that's already active deactivates the filter.
 */

import { useStore } from "@/store/useStore";

type FaceFilter = 'all' | 'top' | 'bottom' | 'walls';

interface FacePoly {
  filter: 'top' | 'walls';
  points: string;            // SVG polygon points
  label: string;
  labelXY: [number, number]; // local SVG coords for the text
}

const SIZE = 96;

// Cube face geometry — manually-computed isometric projection of a unit cube,
// scaled to fit the SIZE viewBox with a small bottom margin for the chip row.
// Center the cube around (48, 38) so the bottom edge sits well above 80.
const FACES: FacePoly[] = [
  // Top (rhombus)
  {
    filter: 'top',
    points: '48,8  84,24  48,40  12,24',
    label: 'Roof',
    labelXY: [48, 27],
  },
  // Front-left wall (parallelogram)
  {
    filter: 'walls',
    points: '12,24  48,40  48,72  12,56',
    label: 'Walls',
    labelXY: [30, 52],
  },
];

// Front-right wall — same filter as front-left, just a separate polygon for hit/render.
const RIGHT_WALL: FacePoly = {
  filter: 'walls',
  points: '48,40  84,24  84,56  48,72',
  label: '', // already labelled on the left wall
  labelXY: [0, 0],
};

export default function FaceFilterWidget() {
  const filter = useStore((s) => s.faceFilter);
  const setFilter = useStore((s) => s.setFaceFilter);

  const onPick = (next: FaceFilter) => {
    // Same face clicked twice clears the filter, like a toggle.
    setFilter(filter === next ? 'all' : next);
  };

  // Per-face fill colour: dimmed when filter excludes this face, accent when active.
  const fillFor = (faceFilter: 'top' | 'walls'): string => {
    if (filter === 'all') return '#e5e7eb';
    if (filter === faceFilter) return '#3b82f6';
    return '#cbd5e1';
  };

  const labelFillFor = (faceFilter: 'top' | 'walls'): string => {
    if (filter === faceFilter) return '#ffffff';
    return '#475569';
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '8px',
        zIndex: 10,
        pointerEvents: 'auto',
        background: 'rgba(255,255,255,0.55)',
        borderRadius: 12,
        boxShadow: '0 2px 10px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        backdropFilter: 'blur(8px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(8px) saturate(1.2)',
      }}
      title="Face filter — restrict pointer events to a face category"
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} 80`} style={{ display: 'block' }}>
        {/* Wireframe outline behind the faces for depth — drawn first, faces overlay it. */}
        <polygon
          points="48,8 84,24 84,56 48,72 12,56 12,24"
          fill="none"
          stroke="rgba(0,0,0,0.15)"
          strokeWidth={1}
        />

        {FACES.map((f) => (
          <g
            key={f.filter}
            onClick={() => onPick(f.filter)}
            style={{ cursor: 'pointer' }}
          >
            <polygon
              points={f.points}
              fill={fillFor(f.filter)}
              stroke="rgba(0,0,0,0.25)"
              strokeWidth={1}
              style={{ transition: 'fill 150ms ease-out' }}
            />
            {f.label && (
              <text
                x={f.labelXY[0]}
                y={f.labelXY[1]}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                fontWeight={700}
                fill={labelFillFor(f.filter)}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {f.label}
              </text>
            )}
          </g>
        ))}

        {/* Front-right wall — shares the 'walls' filter with the left polygon. */}
        <g onClick={() => onPick('walls')} style={{ cursor: 'pointer' }}>
          <polygon
            points={RIGHT_WALL.points}
            fill={fillFor('walls')}
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={1}
            style={{ transition: 'fill 150ms ease-out' }}
          />
        </g>
      </svg>

      {/* Chip row for the bottom face (no isometric polygon — the floor is
          hidden under the cube) plus an "All" reset chip. */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => onPick('bottom')}
          style={chipStyle(filter === 'bottom')}
          title="Floor faces only"
        >
          Floor
        </button>
        <button
          onClick={() => setFilter('all')}
          style={{
            ...chipStyle(filter === 'all'),
            background: filter === 'all' ? 'var(--text-main, #111827)' : 'transparent',
            color: filter === 'all' ? '#fff' : 'var(--text-muted, #6b7280)',
            borderColor: filter === 'all' ? 'var(--text-main, #111827)' : 'var(--btn-border, #e5e7eb)',
          }}
          title="No filter — all faces interactive"
        >
          All
        </button>
      </div>
    </div>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 6,
    border: `1px solid ${active ? '#3b82f6' : 'var(--btn-border, #e5e7eb)'}`,
    background: active ? '#3b82f6' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted, #6b7280)',
    cursor: 'pointer',
    transition: 'all 150ms ease-out',
    letterSpacing: '0.02em',
  };
}
