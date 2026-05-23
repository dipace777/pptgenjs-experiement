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

## Remaining Refactors

- Consider splitting shared editor form/button primitives if inspector and
  drawer controls continue to diverge.
