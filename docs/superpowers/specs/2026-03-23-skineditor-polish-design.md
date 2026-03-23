# SkinEditor Polish — Design Spec

**Date:** 2026-03-23
**Status:** Design
**Scope:** CSS variable migration + FormThumbnail header in SkinEditor

---

## Problem Statement

SkinEditor uses 12 hardcoded dark-theme color values (`#e2e8f0`, `#94a3b8`, `rgba(255,255,255,...)`) while the rest of the Sidebar uses CSS variables (`var(--text-main)`, `var(--border)`, etc.) defined in `globals.css` with both light and dark theme definitions. This means SkinEditor looks wrong in light mode. Additionally, the SkinEditor header is text-only — adding a FormThumbnail SVG gives visual continuity with the bottom bar cards.

## Changes

### 1. CSS Variable Migration (SkinEditor.tsx)

Add CSS variable constants matching the Sidebar pattern:

```ts
const TEXT     = "var(--text-main, #1e293b)";
const TEXT_DIM = "var(--text-muted, #64748b)";
const BORDER   = "var(--border, #e2e8f0)";
const SURFACE  = "var(--surface-alt, #f8fafc)";
const CARD     = "var(--btn-bg, #ffffff)";
```

Color mapping:

| Hardcoded Value | Used In | Replacement |
|---|---|---|
| `#e2e8f0` | panelStyle.color, selectStyle.color, quickBtnStyle.color, actionBtnStyle.color | `TEXT` |
| `#94a3b8` | sectionLabelStyle.color, style label inline, slider readout inlines | `TEXT_DIM` |
| `rgba(255,255,255,0.1)` | dividerStyle.background | `BORDER` |
| `rgba(255,255,255,0.15)` | selectStyle.border, quickBtnStyle.border, actionBtnStyle.border | `BORDER` |
| `rgba(255,255,255,0.08)` | selectStyle.background | `SURFACE` |
| `rgba(255,255,255,0.06)` | actionBtnStyle.background | `SURFACE` |
| `rgba(255,255,255,0.2)` | swatch border inline | `BORDER` |

**Preserved as-is:**
- `#fca5a5` / `rgba(239,68,68,0.4)` on removeBtnStyle — semantic danger color, not theme-dependent

### 2. FormThumbnail in Header (SkinEditor.tsx)

Import `FormThumbnail` from `@/components/ui/FormThumbnails`.

Replace the header block with a flex row:

```
┌──────────────────────────────┐
│ [SVG 36px]  Form Name        │
│             Style Label       │
└──────────────────────────────┘
```

- `display: flex`, `alignItems: center`, `gap: 10`
- FormThumbnail rendered at `size={36}`, tinted with `var(--accent)`
- Form name and style label stack vertically to the right

---

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `src/components/ui/SkinEditor.tsx` | Modify | Replace 12 hardcoded colors with CSS variable constants; add FormThumbnail to header |

**No new files. No new dependencies. No store changes. One file modified.**

---

## Testing

1. **Existing tests** — all 676 must continue passing (no behavioral changes)
2. **Anti-pattern test** — existing `position:fixed` guard in `selection-mutual-exclusion.test.ts` still passes
3. **Visual verification** — confirm SkinEditor renders correctly in both light and dark mode themes

## Out of Scope

- Dark/light mode toggle UX improvements
- SkinEditor layout redesign beyond header
- Theme-aware form card thumbnails in BottomPanel (already uses currentColor)
