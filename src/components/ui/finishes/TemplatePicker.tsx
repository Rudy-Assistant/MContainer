"use client";

/**
 * TemplatePicker — door + window template/skin picker shown in the Inspector
 * Walls tab when a face is selected.
 *
 * Two-column layout:
 *   • Left: TEMPLATE list (single swing, double swing, sliding, … OR
 *     picture window, casement, awning, …) — defines the shape.
 *   • Right: SKIN list (oak, walnut, painted white, … OR aluminium black,
 *     wood natural, …) — defines the finish.
 *
 * Skins are filtered by the active template's `recommendedSkins`, with an
 * "All skins" toggle to show the full catalog.
 *
 * No 3D rendering yet — selecting a template/skin writes to the voxel's
 * doorConfig/windowConfig; renderer reads those when it grows per-template
 * geometry. Until then the surface (Door / Window_*) drives the visible
 * shape and the swatch hint drives the colour. The data is correctly
 * captured for the future renderer.
 */

import { useStore } from "@/store/useStore";
import {
  DOOR_TEMPLATES,
  DEFAULT_DOOR_TEMPLATE,
  type DoorTemplateId,
  getDoorTemplate,
} from "@/config/doorTemplates";
import {
  WINDOW_TEMPLATES,
  DEFAULT_WINDOW_TEMPLATE,
  type WindowTemplateId,
  getWindowTemplate,
} from "@/config/windowTemplates";
import { DOOR_SKINS, DEFAULT_DOOR_SKIN, type DoorSkinId, getDoorSkin } from "@/config/doorSkins";
import { WINDOW_SKINS, DEFAULT_WINDOW_SKIN, type WindowSkinId, getWindowSkin } from "@/config/windowSkins";
import {
  SHELF_TEMPLATES,
  DEFAULT_SHELF_TEMPLATE,
  type ShelfTemplateId,
  getShelfTemplate,
} from "@/config/shelfTemplates";
import {
  CABINET_TEMPLATES,
  DEFAULT_CABINET_TEMPLATE,
  type CabinetTemplateId,
  getCabinetTemplate,
} from "@/config/cabinetTemplates";
import {
  CABINETRY_SKINS,
  DEFAULT_CABINETRY_SKIN,
  type CabinetrySkinId,
  getCabinetrySkin,
} from "@/config/cabinetrySkins";
import {
  COUNTER_TOP_MATERIALS,
  type CounterTopMaterialId,
  getCounterTopMaterial,
} from "@/config/counterTopMaterials";
import {
  FIXTURE_TEMPLATES,
  DEFAULT_FIXTURE_TEMPLATE,
  type FixtureTemplateId,
  getFixtureTemplate,
} from "@/config/fixtureTemplates";
import {
  DECOR_TEMPLATES,
  DECOR_PALETTES,
  DEFAULT_DECOR_TEMPLATE,
  DEFAULT_DECOR_PALETTE,
  type DecorTemplateId,
  type DecorPaletteId,
  getDecorTemplate,
  getDecorPalette,
} from "@/config/decorTemplates";
import type { VoxelFaces } from "@/types/container";
import { useState, type CSSProperties, type ReactNode } from "react";
import { PresetCard } from "./PresetCard";

interface Props {
  containerId: string;
  voxelIndex: number;
  face: keyof VoxelFaces;
  /** Which mode to show. The walls tab usually knows whether the face holds a
   *  Door or a Window (based on the face's SurfaceType) and passes that in.
   *  Shelf and cabinet modes are category-gated, not surface-gated — they
   *  render whenever the user picks the Shelf or Cabinet category chip. */
  mode: 'door' | 'window' | 'shelf' | 'cabinet' | 'fixture' | 'decor';
}

const TILE_BG = 'var(--bg-panel, #fff)';
const TILE_BORDER = 'var(--border, #e2e8f0)';
const ACCENT = 'var(--accent, #2563eb)';

export default function TemplatePicker({ containerId, voxelIndex, face, mode }: Props) {
  const setDoorConfig = useStore((s) => s.setDoorConfig);
  const setWindowConfig = useStore((s) => s.setWindowConfig);
  const setShelfConfig = useStore((s) => s.setShelfConfig);
  const setCabinetConfig = useStore((s) => s.setCabinetConfig);
  const setFixtureConfig = useStore((s) => s.setFixtureConfig);
  const setDecorConfig = useStore((s) => s.setDecorConfig);
  const containers = useStore((s) => s.containers);

  const voxel = containers[containerId]?.voxelGrid?.[voxelIndex];
  const [showAllSkins, setShowAllSkins] = useState(false);

  if (mode === 'door') {
    const cfg = voxel?.doorConfig?.[face];
    const activeTemplate: DoorTemplateId = cfg?.template ?? DEFAULT_DOOR_TEMPLATE;
    const activeSkin: DoorSkinId = cfg?.skin ?? DEFAULT_DOOR_SKIN;
    const template = getDoorTemplate(activeTemplate);
    const isOpen = cfg?.state === 'open_swing' || cfg?.state === 'open_slide';
    const openState = template.motion === 'slide' || template.motion === 'roll' ? 'open_slide' : 'open_swing';

    const skins = showAllSkins
      ? DOOR_SKINS
      : DOOR_SKINS.filter((s) => template.recommendedSkins.includes(s.id));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <SectionHeader label="Door Template" hint={template.hint} />
          <button
            onClick={() => setDoorConfig(containerId, voxelIndex, face, { state: isOpen ? 'closed' : openState })}
            style={toggleButton(isOpen)}
            aria-pressed={isOpen}
          >
            {isOpen ? 'Open ●' : 'Closed ○'}
          </button>
        </div>
        <TemplateTileGrid
          items={DOOR_TEMPLATES}
          activeId={activeTemplate}
          onSelect={(id) => setDoorConfig(containerId, voxelIndex, face, { template: id })}
          getSubtitle={(t) => `${t.motion} · ${t.panels === 2 ? '2 panels' : '1 panel'}`}
        />

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <SectionHeader label="Door Skin" hint={getDoorSkin(activeSkin).label} />
          <button
            onClick={() => setShowAllSkins((v) => !v)}
            style={linkButton}
          >
            {showAllSkins ? 'Recommended only' : 'Show all'}
          </button>
        </div>
        <div style={grid3}>
          {skins.map((s) => (
            <SkinSwatchCard
              key={s.id}
              swatch={
                <span style={{
                  ...swatchStyle,
                  background: s.glazed
                    ? `linear-gradient(135deg, ${s.panelColor} 0%, ${s.panelColor} 50%, #cbd5e1 50%, #cbd5e1 100%)`
                    : s.panelColor,
                  border: `1px solid ${s.frameColor ?? s.panelColor}`,
                }} />
              }
              label={s.label}
              title={s.label}
              active={s.id === activeSkin}
              onClick={() => setDoorConfig(containerId, voxelIndex, face, { skin: s.id })}
            />
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'shelf') {
    const cfg = voxel?.shelfConfig?.[face];
    const activeTemplate: ShelfTemplateId = cfg?.template ?? DEFAULT_SHELF_TEMPLATE;
    const activeSkin: CabinetrySkinId = cfg?.skin ?? DEFAULT_CABINETRY_SKIN;
    const template = getShelfTemplate(activeTemplate);

    const skins = showAllSkins
      ? CABINETRY_SKINS
      : CABINETRY_SKINS.filter((s) => template.recommendedSkins.includes(s.id));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 14px' }}>
        <SectionHeader label="Shelf Template" hint={template.hint} />
        <TemplateTileGrid
          items={SHELF_TEMPLATES}
          activeId={activeTemplate}
          onSelect={(id) => setShelfConfig(containerId, voxelIndex, face, { template: id })}
          getSubtitle={(t) => `${t.shelves} ${t.shelves === 1 ? 'shelf' : 'shelves'}`}
        />

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <SectionHeader label="Shelf Skin" hint={getCabinetrySkin(activeSkin).label} />
          <button onClick={() => setShowAllSkins((v) => !v)} style={linkButton}>
            {showAllSkins ? 'Recommended only' : 'Show all'}
          </button>
        </div>
        <div style={grid3}>
          {skins.map((s) => (
            <SkinSwatchCard
              key={s.id}
              swatch={<span style={cabinetrySwatchStyle(s)} />}
              label={s.label}
              title={s.label}
              active={s.id === activeSkin}
              onClick={() => setShelfConfig(containerId, voxelIndex, face, { skin: s.id })}
            />
          ))}
        </div>

        <button
          onClick={() => setShelfConfig(containerId, voxelIndex, face, null)}
          style={removeButton}
        >
          Remove shelf
        </button>
      </div>
    );
  }

  if (mode === 'cabinet') {
    const cfg = voxel?.cabinetConfig?.[face];
    const activeTemplate: CabinetTemplateId = cfg?.template ?? DEFAULT_CABINET_TEMPLATE;
    const activeSkin: CabinetrySkinId = cfg?.skin ?? DEFAULT_CABINETRY_SKIN;
    const template = getCabinetTemplate(activeTemplate);
    const cabOpen = (cfg?.openAmount ?? 0) > 0.5;

    const skins = showAllSkins
      ? CABINETRY_SKINS
      : CABINETRY_SKINS.filter((s) => template.recommendedSkins.includes(s.id));

    const doorCount = template.parts.filter((p) => p.kind === 'door').length;
    const drawerCount = template.parts.filter((p) => p.kind === 'drawer').length;
    const partsLabel = [
      doorCount ? `${doorCount} door${doorCount > 1 ? 's' : ''}` : null,
      drawerCount ? `${drawerCount} drawer${drawerCount > 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(' · ');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <SectionHeader label="Cabinet Template" hint={template.hint} />
          <button
            onClick={() => setCabinetConfig(containerId, voxelIndex, face, { openAmount: cabOpen ? 0 : 1 })}
            style={toggleButton(cabOpen)}
            aria-pressed={cabOpen}
          >
            {cabOpen ? 'Open ●' : 'Closed ○'}
          </button>
        </div>
        <TemplateTileGrid
          items={CABINET_TEMPLATES}
          activeId={activeTemplate}
          onSelect={(id) => setCabinetConfig(containerId, voxelIndex, face, { template: id })}
          getSubtitle={(t) => {
            const d = t.parts.filter((p) => p.kind === 'door').length;
            const dr = t.parts.filter((p) => p.kind === 'drawer').length;
            return [d ? `${d}d` : null, dr ? `${dr}dr` : null].filter(Boolean).join(' + ') || ' ';
          }}
        />

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <SectionHeader label={`Cabinet Skin · ${partsLabel}`} hint={getCabinetrySkin(activeSkin).label} />
          <button onClick={() => setShowAllSkins((v) => !v)} style={linkButton}>
            {showAllSkins ? 'Recommended only' : 'Show all'}
          </button>
        </div>
        <div style={grid3}>
          {skins.map((s) => (
            <SkinSwatchCard
              key={s.id}
              swatch={<span style={cabinetrySwatchStyle(s)} />}
              label={s.label}
              title={s.label}
              active={s.id === activeSkin}
              onClick={() => setCabinetConfig(containerId, voxelIndex, face, { skin: s.id })}
            />
          ))}
        </div>

        {/* Counter top — only shown for templates that support it (base
            cabinets + vanity). Adjacent voxels with the same material render
            as a continuous run. */}
        {template.supportsCounterTop && (
          <>
            <SectionHeader
              label="Counter Top"
              hint={
                cfg?.counterTop
                  ? getCounterTopMaterial(cfg.counterTop as CounterTopMaterialId).label
                  : 'No counter top — click to add'
              }
            />
            <div style={grid3}>
              {COUNTER_TOP_MATERIALS.map((m) => (
                <SkinSwatchCard
                  key={m.id}
                  swatch={<span style={counterTopSwatchStyle(m)} />}
                  label={m.label}
                  title={m.label}
                  active={cfg?.counterTop === m.id}
                  onClick={() => setCabinetConfig(containerId, voxelIndex, face, { counterTop: m.id })}
                />
              ))}
            </div>
          </>
        )}

        {/* Lighting toggle — under-cabinet LED. Most useful for upper
            cabinets (wall_*) and tall pantry; harmless on base cabinets. */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <SectionHeader label="Under-Cabinet Light" hint="Cosmetic LED ribbon below the body." />
          <button
            onClick={() => setCabinetConfig(containerId, voxelIndex, face, { underCabinetLight: !cfg?.underCabinetLight })}
            style={toggleButton(!!cfg?.underCabinetLight)}
            aria-pressed={!!cfg?.underCabinetLight}
          >
            {cfg?.underCabinetLight ? 'On ●' : 'Off ○'}
          </button>
        </div>

        <button
          onClick={() => setCabinetConfig(containerId, voxelIndex, face, null)}
          style={removeButton}
        >
          Remove cabinet
        </button>
      </div>
    );
  }

  if (mode === 'decor') {
    const cfg = voxel?.decorConfig?.[face];
    const activeTemplate: DecorTemplateId = cfg?.template ?? DEFAULT_DECOR_TEMPLATE;
    const activePalette: DecorPaletteId = cfg?.palette ?? DEFAULT_DECOR_PALETTE;
    const template = getDecorTemplate(activeTemplate);

    const palettes = showAllSkins
      ? DECOR_PALETTES
      : DECOR_PALETTES.filter((p) => template.recommendedPalettes.includes(p.id));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 14px' }}>
        <SectionHeader label="Decor Template" hint={template.hint} />
        <TemplateTileGrid
          items={DECOR_TEMPLATES}
          activeId={activeTemplate}
          onSelect={(id) => setDecorConfig(containerId, voxelIndex, face, { template: id })}
          getSubtitle={(t) => [t.isTV && 'screen', t.hasGlass && 'glass'].filter(Boolean).join(' · ') || ' '}
        />

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <SectionHeader label="Frame Palette" hint={getDecorPalette(activePalette).label} />
          <button onClick={() => setShowAllSkins((v) => !v)} style={linkButton}>
            {showAllSkins ? 'Recommended only' : 'Show all'}
          </button>
        </div>
        <div style={grid3}>
          {palettes.map((p) => (
            <SkinSwatchCard
              key={p.id}
              swatch={
                <span style={{
                  ...swatchStyle,
                  background: `linear-gradient(135deg, ${p.frameColor} 0%, ${p.frameColor} 28%, ${p.imageColor} 28%, ${p.imageColor} 72%, ${p.frameColor} 72%, ${p.frameColor} 100%)`,
                  border: `1px solid ${p.frameColor}`,
                }} />
              }
              label={p.label}
              title={p.label}
              active={p.id === activePalette}
              onClick={() => setDecorConfig(containerId, voxelIndex, face, { palette: p.id })}
            />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <SectionHeader label="Picture Light" hint="Brass arm + bulb above the frame." />
          <button
            onClick={() => setDecorConfig(containerId, voxelIndex, face, { pictureLight: !cfg?.pictureLight })}
            style={toggleButton(!!cfg?.pictureLight)}
            aria-pressed={!!cfg?.pictureLight}
          >
            {cfg?.pictureLight ? 'On ●' : 'Off ○'}
          </button>
        </div>

        <button
          onClick={() => setDecorConfig(containerId, voxelIndex, face, null)}
          style={removeButton}
        >
          Remove decor
        </button>
      </div>
    );
  }

  if (mode === 'fixture') {
    const cfg = voxel?.fixtureConfig?.[face];
    const activeTemplate: FixtureTemplateId = cfg?.template ?? DEFAULT_FIXTURE_TEMPLATE;
    const template = getFixtureTemplate(activeTemplate);
    const animatable = !!template.hasOpeningDoor;
    const fxOpen = (cfg?.openAmount ?? 0) > 0.5;

    // Group templates by kind for the picker
    const appliances = FIXTURE_TEMPLATES.filter((t) => t.kind === 'appliance');
    const fixtures = FIXTURE_TEMPLATES.filter((t) => t.kind === 'fixture');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <SectionHeader label="Fixture Template" hint={template.hint} />
          {animatable && (
            <button
              onClick={() => setFixtureConfig(containerId, voxelIndex, face, { openAmount: fxOpen ? 0 : 1 })}
              style={toggleButton(fxOpen)}
              aria-pressed={fxOpen}
            >
              {fxOpen ? 'Open ●' : 'Closed ○'}
            </button>
          )}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Appliances
        </div>
        <div style={grid2}>
          {appliances.map((t) => {
            const active = t.id === activeTemplate;
            return (
              <button
                key={t.id}
                onClick={() => setFixtureConfig(containerId, voxelIndex, face, { template: t.id })}
                style={tileStyle(active)}
                title={t.hint}
              >
                <div style={tileTitle(active)}>{t.label}</div>
                <div style={tileSub}>{t.paletteHint}{t.hasOpeningDoor ? ' · door' : ''}</div>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Bathroom Fixtures
        </div>
        <div style={grid2}>
          {fixtures.map((t) => {
            const active = t.id === activeTemplate;
            return (
              <button
                key={t.id}
                onClick={() => setFixtureConfig(containerId, voxelIndex, face, { template: t.id })}
                style={tileStyle(active)}
                title={t.hint}
              >
                <div style={tileTitle(active)}>{t.label}</div>
                <div style={tileSub}>{t.paletteHint}</div>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setFixtureConfig(containerId, voxelIndex, face, null)}
          style={removeButton}
        >
          Remove fixture
        </button>
      </div>
    );
  }

  // Window mode
  const cfg = voxel?.windowConfig?.[face];
  const activeTemplate: WindowTemplateId = cfg?.template ?? DEFAULT_WINDOW_TEMPLATE;
  const activeSkin: WindowSkinId = cfg?.skin ?? DEFAULT_WINDOW_SKIN;
  const template = getWindowTemplate(activeTemplate);
  // Animatable templates respond to openAmount; fixed templates ignore it.
  const animatable = template.motion !== 'fixed';
  const winOpen = (cfg?.openAmount ?? 0) > 0.5;

  const skins = showAllSkins
    ? WINDOW_SKINS
    : WINDOW_SKINS.filter((s) => template.recommendedSkins.includes(s.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <SectionHeader label="Window Template" hint={template.hint} />
        {animatable && (
          <button
            onClick={() => setWindowConfig(containerId, voxelIndex, face, { openAmount: winOpen ? 0 : 1 })}
            style={toggleButton(winOpen)}
            aria-pressed={winOpen}
          >
            {winOpen ? 'Open ●' : 'Closed ○'}
          </button>
        )}
      </div>
      <TemplateTileGrid
        items={WINDOW_TEMPLATES}
        activeId={activeTemplate}
        onSelect={(id) => setWindowConfig(containerId, voxelIndex, face, { template: id })}
        getSubtitle={(t) => `${t.motion} · ${t.coverage}`}
      />

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <SectionHeader label="Window Skin" hint={getWindowSkin(activeSkin).label} />
        <button onClick={() => setShowAllSkins((v) => !v)} style={linkButton}>
          {showAllSkins ? 'Recommended only' : 'Show all'}
        </button>
      </div>
      <div style={grid3}>
        {skins.map((s) => (
          <SkinSwatchCard
            key={s.id}
            swatch={
              <span style={{
                ...swatchStyle,
                background: `linear-gradient(135deg, ${s.frameColor} 0%, ${s.frameColor} 28%, ${s.glassColor} 28%, ${s.glassColor} 72%, ${s.frameColor} 72%, ${s.frameColor} 100%)`,
                border: `1px solid ${s.frameColor}`,
              }} />
            }
            label={s.label}
            title={s.label}
            active={s.id === activeSkin}
            onClick={() => setWindowConfig(containerId, voxelIndex, face, { skin: s.id })}
          />
        ))}
      </div>
    </div>
  );
}

// ── small primitives ──

/** 2-column grid of template tiles. Each tile shows a label + an optional
 *  subtitle. Replaces 6 near-identical inline grid blocks (one per mode). */
function TemplateTileGrid<T extends { id: string; label: string; hint: string }>({
  items, activeId, onSelect, getSubtitle,
}: {
  items: readonly T[];
  activeId: string;
  onSelect: (id: T['id']) => void;
  getSubtitle: (t: T) => React.ReactNode;
}) {
  return (
    <div style={grid2}>
      {items.map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id as T['id'])}
            style={tileStyle(active)}
            title={t.hint}
          >
            <div style={tileTitle(active)}>{t.label}</div>
            <div style={tileSub}>{getSubtitle(t)}</div>
          </button>
        );
      })}
    </div>
  );
}

function SectionHeader({ label, hint }: { label: string; hint: string }) {
  return (
    <div>
      <div style={{
        fontSize: 12, fontWeight: 700, color: 'var(--text-muted, #64748b)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginTop: 3, lineHeight: 1.45 }}>
        {hint}
      </div>
    </div>
  );
}

// Responsive grids — auto-fit collapses to 1 column on narrow viewports
// (mobile / sidebar resize) and grows up to 2 / 3 cols on desktop.
// minmax(MIN, 1fr) sets the breakpoint: tiles never go below MIN px wide.
const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 8,
};

const grid3: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))',
  gap: 8,
};

function tileStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
    padding: '10px 12px',
    borderRadius: 8,
    border: `1.5px solid ${active ? ACCENT : TILE_BORDER}`,
    background: active ? 'rgba(37,99,235,0.06)' : TILE_BG,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 150ms ease-out',
    fontFamily: 'inherit',
  };
}

function tileTitle(active: boolean): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 700,
    color: active ? 'var(--text-main, #0f172a)' : 'var(--text-main, #1e293b)',
    letterSpacing: '-0.005em',
  };
}

const tileSub: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted, #64748b)',
  textTransform: 'capitalize',
};

/** Swatch render style for SkinSwatchCard content — fills the PresetCard image area. */
const swatchStyle: CSSProperties = {
  width: '100%', height: '100%',
  borderRadius: 4,
  display: 'block',
};

/**
 * Shared card for skin/swatch picker rows (door skins, shelf/cabinet skins,
 * counter tops, decor palettes, window skins). Wraps the standard PresetCard
 * with the gradient swatch as the image content. Honors the project's
 * "highlight on image only, label outside" card convention.
 */
function SkinSwatchCard({
  swatch, label, active, onClick, title,
}: {
  swatch: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <PresetCard
      content={<span aria-hidden style={{ width: '100%', height: '100%', display: 'block' }}>{swatch}</span>}
      label={label}
      title={title}
      active={active}
      onClick={onClick}
    />
  );
}

const linkButton: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: ACCENT,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
};

function toggleButton(active: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    color: active ? '#fff' : ACCENT,
    background: active ? ACCENT : 'transparent',
    border: `1.5px solid ${ACCENT}`,
    borderRadius: 6,
    padding: '4px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.02em',
    transition: 'all 120ms ease-out',
  };
}

/** Swatch style for counter top materials. Speckled gradient hints at
 *  natural stone/wood grain; flat color for metals/concrete. */
function counterTopSwatchStyle(m: import('@/config/counterTopMaterials').CounterTopMaterial): React.CSSProperties {
  const accent = m.swatchAccent ?? m.color;
  return {
    ...swatchStyle,
    border: `1px solid ${m.color}`,
    background:
      m.kind === 'stone'
        ? `radial-gradient(circle at 30% 30%, ${accent} 0%, ${m.color} 60%)`
        : `linear-gradient(135deg, ${m.color} 0%, ${accent} 100%)`,
  };
}

/** Swatch style for cabinetry skins. Mirrored skins overlay a metallic
 *  highlight gradient so users can tell which finishes are reflective. */
function cabinetrySwatchStyle(s: import('@/config/cabinetrySkins').CabinetrySkin): React.CSSProperties {
  const base: React.CSSProperties = {
    ...swatchStyle,
    border: `1px solid ${s.bodyColor}`,
  };
  if (s.mirrorDoors) {
    return {
      ...base,
      background:
        `linear-gradient(135deg, #ffffff 0%, ${s.doorColor} 22%, #f0f0f0 50%, ${s.doorColor} 78%, #ffffff 100%)`,
    };
  }
  return {
    ...base,
    background:
      `linear-gradient(135deg, ${s.bodyColor} 0%, ${s.bodyColor} 38%, ${s.doorColor} 38%, ${s.doorColor} 100%)`,
  };
}

const removeButton: React.CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted, #94a3b8)',
  background: 'transparent',
  border: '1px solid var(--border, #e2e8f0)',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  alignSelf: 'flex-start',
};
