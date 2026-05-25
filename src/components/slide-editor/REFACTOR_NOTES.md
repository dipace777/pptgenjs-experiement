# Slide Editor Refactor Notes

## Completed

- Split the editor shell into focused components for the thumbnail rail, topbar,
  workspace, slide drawer, deck theme drawer, presentation overlay, and hidden
  export stages.
- Moved deck title and deck theme updates into Jotai actions so they participate
  in undo/redo history.
- Extracted image upload, SVG prompt generation, and delete keyboard behavior
  into hooks.
- Added an element registry for element labels, addable capabilities, and default
  element factories.
- Expanded the element registry to declare toolbar, inspector, renderer, and
  export capabilities for each element type.
- Routed selected-element toolbars and drawer inspectors through the element
  registry instead of hardcoding per-kind checks in workspace/drawer components.
- Routed Konva element rendering and DOM overlay rendering through registry-backed
  renderer bridges.
- Moved the pure element registry to `src/lib/slide-elements.ts` and routed PPTX
  element export selection through its export metadata.
- Added rich drawer inspectors for text, bullets, image, shape, table, and SVG
  elements.
- Added semantic theme roles to the deck schema, theme engine, editor theme
  drawer, and generated decks while keeping legacy hex matching as fallback.
- Added shared image/SVG export asset loading so raster PPTX and PDF export wait
  for async Konva assets before capture.
- Added shared SVG sanitization for AI output, local fallback output, manual SVG
  edits, DOM rendering, Konva rendering, and PPTX/PDF export paths.
- Split layout, workspace, and drawer-owned styles out of `editorStyles.ts`.
- Moved dense inline toolbar/editor styles to `inline/inlineStyles.ts` and
  presentation mode styles to `presentationStyles.ts`.
- Grouped the growing editor surface into ownership folders: `shell`,
  `workspace`, `panels`, and `registry`.
- Split workspace-level selected-element toolbars and inline editors out of the
  slide canvas wrapper.
- Replaced chart-only drawer selection behavior with a general selected-element
  drawer model plus a basic geometry inspector for non-chart elements.
- Added `ChartToolbar` for selected-chart type, value labels, colors, opacity,
  and quick data-point adjustments.
- Added `SvgToolbar` for selected-SVG name, markup editing, opacity, sizing
  presets, and reset actions.
- Added `ChartInlineEditor` so double-clicking a chart opens a canvas overlay
  for title and CSV-style data edits.
- Added `SvgInlineEditor` so double-clicking an SVG opens a canvas overlay for
  name and sanitized markup edits.
- Added a registry-backed `ElementToolbar` bridge so `WorkspaceToolbars`
  delegates selected-element toolbar rendering instead of hardcoding every
  toolbar branch.
- Split shared editor form/button primitives into `shared/FormControls.tsx`,
  re-exported them for inspectors, and reused them in chart inspection and the
  slide drawer.

## Remaining Refactors

- No immediate slide editor refactors are queued.

## Missing Editor Components

- No missing editor components are currently tracked.

## Test Fixtures

- Keep `src/templates/layout-kit.ts` updated with a dedicated editor feature
  test slide whenever a new element workflow is introduced. The slide should
  include representative text, bullets, shape, image, table, chart, and SVG
  elements so each toolbar, inspector, inline editor, renderer, and export path
  can be checked quickly.
