# How a slide is generated

User input → LLM outline → deterministic layout → typed `Deck` → Konva preview / pptxgenjs export.

## Files involved

| File | Role |
| --- | --- |
| [src/routes/generate.tsx](../src/routes/generate.tsx) | Form + `createServerFn` that calls the LLM. |
| [src/lib/deck-generator.ts](../src/lib/deck-generator.ts) | Outline schema, layout logic, fallback. |
| [src/lib/company-url-template.ts](../src/lib/company-url-template.ts) | Company URL brand research, logo/theme extraction, and deterministic branded template deck creation. |
| [src/lib/slide-schema.ts](../src/lib/slide-schema.ts) | Zod schema for a `Deck`. Consumed by both preview and exporter. |
| [src/routes/preview.tsx](../src/routes/preview.tsx) | Reads the deck from `sessionStorage`, mounts the editor. |
| [src/components/slide-editor/SlideEditor.tsx](../src/components/slide-editor/SlideEditor.tsx) | Konva editor, export trigger. |
| [src/slide/generatePptx.ts](../src/slide/generatePptx.ts) | `Deck` → `.pptx` via pptxgenjs. |

## 1. Form input

[/generate](../src/routes/generate.tsx) supports three sources:

- **Generate from prompt** collects `title`, `description`, `slideCount`, and `theme`, then calls the LLM outline flow.
- **Import from PPTX** parses the uploaded `.pptx`, validates it as a `Deck`, extracts reusable design elements, and opens the preview.
- **Company URL** accepts a public company URL, uses website metadata plus OpenAI web search when available, then creates an editable placeholder-only brand template deck with reusable design elements.

Prompt generation collects:

- `title` (≤ 90 chars)
- `description` (≤ 1200 chars)
- `slideCount` (5-20)
- `theme`: `background`, `surface`, `primary`, `secondary`, `accent`, `text`, `muted` (hex)

On submit, [generate.tsx:103-110](../src/routes/generate.tsx#L103-L110) calls the `generateDeck` server function.

## 2. Input validation

`createServerFn` runs `DeckGenerationInputSchema.parse(data)` ([deck-generator.ts:4-13](../src/lib/deck-generator.ts#L4-L13)) before the handler. Malformed payloads fail here; the LLM is not called.

## 3. LLM call

The handler dynamically imports `@tanstack/ai` and `@tanstack/ai-openai` (server-only), uses the model from `OPENAI_MODEL` env var (default `gpt-4.1-mini`), and calls `chat()` with `outputSchema: SlideOutlineSchema`.

`SlideOutlineSchema` ([deck-generator.ts:15-29](../src/lib/deck-generator.ts#L15-L29)):

```ts
{
  title: string,           // ≤ 90
  subtitle: string,        // ≤ 140
  sections: [              // 3–5 items
    {
      title: string,       // ≤ 60
      summary: string,     // ≤ 180
      bullets: string[],   // 2–5 items, each ≤ 110
      visual: "bullets" | "chart" | "grid" | "table",
    }
  ],
}
```

The LLM returns content + a `visual` intent per section. No coordinates, colors, or fonts.

User prompt: `Create 4 sections. Mix visual types across bullets, chart, grid, and table.`

## 4. Fallback path

The `chat()` call is wrapped in try/catch. On any failure (no API key, network error, schema mismatch), the handler calls `fallbackOutline(data)` and `generateFallbackDeck(data)` ([deck-generator.ts:53-96](../src/lib/deck-generator.ts#L53-L96)). The outline is a fixed "Context / Momentum / Operating Model / Plan" template seeded with keywords from the description.

The response includes `source: "ai" | "fallback"` and, on fallback, `message: error.message`.

## 5. Outline → Deck

`deckFromOutline()` ([deck-generator.ts:358-373](../src/lib/deck-generator.ts#L358-L373)) is deterministic:

1. `palette(input)` ([deck-generator.ts:41-51](../src/lib/deck-generator.ts#L41-L51)) — strips `#`, validates hex, falls back to defaults for invalid values, derives `muted`/`white`/`line`.
2. Slides built in fixed order:
   - `titleSlide` ([deck-generator.ts:127-170](../src/lib/deck-generator.ts#L127-L170)) — accent bar, title, subtitle, accent ellipse, footer.
   - `agendaSlide` ([deck-generator.ts:172-215](../src/lib/deck-generator.ts#L172-L215)) — 2-column grid of numbered section titles.
   - `sectionSlide` ([deck-generator.ts:217-356](../src/lib/deck-generator.ts#L217-L356)) per outline section.
3. Total slide count = `sections.length + 2`, stamped into each footer.

`sectionSlide` maps `visual` to a layout:

- `chart` → bar chart titled "Signal strength", bullets become labels, values = `35 + i * 17`.
- `grid` → 2-column card grid, every third card is a donut chart.
- `table` → 3-column "Phase / Focus / Output" table from bullets.
- `bullets` → styled bulleted list.

Returns `DeckSchema.parse({ title, slides })` — throws if layout produced anything invalid.

## Company URL Template Path

The URL source calls `generateCompanyTemplateFromUrl()` in [company-url-template.ts](../src/lib/company-url-template.ts). It normalizes missing schemes to `https://`, blocks obvious local/private hosts, fetches the HTML with a short timeout, and uses OpenAI Responses web search when `OPENAI_API_KEY` is available.

The brand profile combines:

- brand name from `og:site_name`, application metadata, title, or hostname;
- logo URLs from metadata, favicons, logo-like page images, and web-search image results;
- description from meta description/OG/Twitter metadata;
- brand colors from meta theme color, inline styles, HTML, up to four linked stylesheets, and web-search brand research;
- typeface/design keywords from web-search brand research when available.

If the fetch or web search fails, the handler still returns a deterministic fallback template based on the hostname. Both success and fallback produce a normal `Deck`; the richer path also stores reusable design elements, so the editor drawer can insert brand lockups, title lockups, cards, metrics, CTA buttons, image slots, navigation pills, and dividers.

## 6. Client handoff

[generate.tsx:103-114](../src/routes/generate.tsx#L103-L114):

```ts
window.sessionStorage.setItem("ppty:generatedDeck", JSON.stringify(deck));
window.location.href = "/preview";
```

Full navigation, not client-side route change.

## 7. Preview

[preview.tsx](../src/routes/preview.tsx) runs `DeckSchema.safeParse` on the stored JSON. On failure, falls back to `messiDeck` from [src/slide/spec.ts](../src/slide/spec.ts). The parsed deck is passed to `<SlideEditor initialDeck={deck} />`, which holds it in `useState`. Edits are local state updates.

## 8. Export

[SlideEditor.tsx:243-279](../src/components/slide-editor/SlideEditor.tsx#L243-L279) has two modes:

- **Native** — `generatePptx(deck, filename)` walks `Deck` elements and emits pptxgenjs primitives. Charts are drawn as primitive shapes (not pptxgenjs chart objects) for cross-app consistency.
- **Raster** — exports each Konva stage as PNG, embeds full-slide images.

`blendHex()` ([generatePptx.ts:23-35](../src/slide/generatePptx.ts#L23-L35)) bakes text opacity into a solid color because Google Slides ignores alpha on text runs but honors it on shape fills.

## Pipeline

```
/generate form
    │
    ▼ submit
createServerFn handler
    ├─ DeckGenerationInputSchema.parse()       (Zod)
    ├─ chat({ outputSchema: SlideOutlineSchema })
    │     └─ catch → fallbackOutline()
    └─ deckFromOutline()
         ├─ palette()
         ├─ titleSlide / agendaSlide / sectionSlide × N
         └─ DeckSchema.parse()                  (Zod)
    │
    ▼ sessionStorage["ppty:generatedDeck"] + navigate
/preview
    ├─ DeckSchema.safeParse()                   (Zod)
    └─ <SlideEditor>
         ├─ KonvaSlide rendering
         ├─ Inspector edits
         └─ Export → generatePptx(deck) | raster PNGs
```

## Zod boundaries

| Location | Schema |
| --- | --- |
| Server fn input | `DeckGenerationInputSchema` |
| LLM output | `SlideOutlineSchema` (via `chat()` `outputSchema`) |
| End of `deckFromOutline` | `DeckSchema` |
| Preview load from sessionStorage | `DeckSchema` (safeParse) |
| Per-element types | `SlideElementSchema` (discriminated union on `kind`) |

## Element kinds

`SlideElementSchema` discriminates on `kind`:

| Kind | Source of truth | Konva render | PPTX export |
| --- | --- | --- | --- |
| `text` | `TextElementSchema` | `Text` | `addText` |
| `rect` | `RectElementSchema` | `Rect` | `addShape(rect/roundRect)` |
| `ellipse` | `EllipseElementSchema` | `Ellipse` | `addShape(ellipse)` |
| `bullets` | `BulletsElementSchema` | `Text` per item | `addText` with bullet runs |
| `chart` | `ChartElementSchema` | Custom group | Shape primitives |
| `table` | `TableElementSchema` | Rect/Text grid | Shape + text per cell |
| `grid` | `GridElementSchema` | Card grid | Shape + text per cell |
| `image` | `ImageElementSchema` | `Image` (loaded from `data` URL) | `addImage` |

### Image element

`ImageElementSchema` ([slide-schema.ts](../src/lib/slide-schema.ts)):

```ts
{
  kind: "image",
  data: string | null | undefined,    // data URL; empty → placeholder
  name: string | null | undefined,    // original filename (≤ 120)
  fit: "contain" | "cover" | "fill" | null | undefined,  // default "contain"
  ...box + opacity,
}
```

Upload flow: Inspector file input → `FileReader.readAsDataURL` → `data` is set to the resulting `data:` URL. Stored in the `Deck` like any other element, so it survives sessionStorage round-trip and native PPTX export. No backend, no asset folder.

`fit` semantics — `contain` letterboxes inside the box, `cover` fills and crops, `fill` stretches. Konva applies it via offset/size math + clipping group; pptxgenjs gets it via the `sizing` option on `addImage`.
