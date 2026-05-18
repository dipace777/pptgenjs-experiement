/* eslint-disable react-refresh/only-export-components */
import { standardComponents } from "@json-render/image/render";
import type { Spec } from "@json-render/core";
import {
  ActionProvider,
  Renderer,
  StateProvider,
  VisibilityProvider,
  type ComponentRegistry,
} from "@json-render/react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import PptxGenJS from "pptxgenjs";
import { type FormEvent, useMemo, useState } from "react";
import {
  SVG_THEMES,
  generateSvgDeck,
  type SvgDeck,
  type SvgThemeId,
} from "../slide/generateSvgDeck";
import { SLIDE_H, SLIDE_W } from "../slide/spec";

export const Route = createFileRoute("/svg")({
  component: RouteComponent,
});

const registry = standardComponents as unknown as ComponentRegistry;

const defaultPrompt =
  "A polished launch landing page deck for an AI product called Atlas Notes. Make it feel like a premium SaaS homepage with sharp sections, big headline slides, proof points, and a final CTA.";

function svgDataUri(svg: string) {
  return `data:image/svg+xml;base64,${window.btoa(
    unescape(encodeURIComponent(svg)),
  )}`;
}

function filenameFromTitle(title: string) {
  return `${title.toLowerCase().replace(/\W+/g, "-").replace(/^-|-$/g, "") || "svg-deck"}.pptx`;
}

async function exportSvgDeck(deck: SvgDeck) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "SVG_16X9", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "SVG_16X9";
  pptx.author = "ppty";
  pptx.subject = "Generated SVG deck";
  pptx.title = deck.title;

  for (const slide of deck.slides) {
    const pptSlide = pptx.addSlide();
    pptSlide.addImage({
      data: svgDataUri(slide.svg),
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: SLIDE_H,
      altText: slide.title ?? deck.title,
    });
  }

  await pptx.writeFile({ fileName: filenameFromTitle(deck.title) });
}

function RouteComponent() {
  const generateSvgDeckFn = useServerFn(generateSvgDeck);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [theme, setTheme] = useState<SvgThemeId>("landing");
  const [slideCount, setSlideCount] = useState(6);
  const [deck, setDeck] = useState<SvgDeck | null>(null);
  const [active, setActive] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSlide = deck?.slides[active] ?? null;
  const activeSvg = useMemo(
    () => (activeSlide ? svgDataUri(activeSlide.svg) : null),
    [activeSlide],
  );

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsGenerating(true);
    setError(null);
    try {
      const nextDeck = await generateSvgDeckFn({
        data: {
          topic: prompt,
          theme,
          slideCount,
        },
      });
      setDeck(nextDeck);
      setActive(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate SVG slides.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!deck) return;
    setIsExporting(true);
    setError(null);
    try {
      await exportSvgDeck(deck);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export PPTX.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brandBlock}>
          <div style={styles.eyebrow}>SVG DECK</div>
          <h1 style={styles.title}>Prompt to SVG Slides</h1>
        </div>

        <form onSubmit={handleGenerate} style={styles.form}>
          <label style={styles.label} htmlFor="prompt">
            Prompt
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={9}
            required
            style={styles.textarea}
          />

          <label style={styles.label} htmlFor="theme">
            Theme
          </label>
          <select
            id="theme"
            value={theme}
            onChange={(event) => setTheme(event.target.value as SvgThemeId)}
            style={styles.select}
          >
            {Object.entries(SVG_THEMES).map(([id, option]) => (
              <option key={id} value={id}>
                {option.label}
              </option>
            ))}
          </select>
          <div style={styles.swatches}>
            {SVG_THEMES[theme].swatches.map((color) => (
              <span
                key={color}
                aria-hidden="true"
                style={{ ...styles.swatch, background: color }}
              />
            ))}
          </div>

          <label style={styles.label} htmlFor="slide-count">
            Slides
          </label>
          <input
            id="slide-count"
            type="number"
            min={3}
            max={8}
            value={slideCount}
            onChange={(event) =>
              setSlideCount(
                Math.min(8, Math.max(3, Number(event.target.value) || 3)),
              )
            }
            style={styles.numberInput}
          />

          <button type="submit" disabled={isGenerating} style={styles.primaryButton}>
            {isGenerating ? "Generating SVG..." : "Generate SVG"}
          </button>
        </form>

        <button
          type="button"
          disabled={!deck || isExporting}
          onClick={handleExport}
          style={{
            ...styles.exportButton,
            opacity: !deck || isExporting ? 0.45 : 1,
            cursor: !deck || isExporting ? "not-allowed" : "pointer",
          }}
        >
          {isExporting ? "Exporting..." : "Export to ppt"}
        </button>

        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.thumbs}>
          {deck?.slides.map((slide, index) => (
            <button
              type="button"
              key={index}
              onClick={() => setActive(index)}
              style={{
                ...styles.thumbButton,
                borderColor: active === index ? "#e2b85c" : "#283244",
              }}
            >
              <span style={styles.thumbNumber}>{String(index + 1).padStart(2, "0")}</span>
              <img src={svgDataUri(slide.svg)} alt={slide.title ?? `Slide ${index + 1}`} style={styles.thumbImage} />
            </button>
          ))}
        </div>
      </aside>

      <main style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.currentLabel}>
              {activeSlide?.title ?? "Landing page SVG example"}
            </div>
            <div style={styles.meta}>
              {deck ? `${deck.slides.length} generated SVG slides` : "Generate from a prompt, then export the SVGs into PPTX"}
            </div>
          </div>
        </div>

        <section style={styles.stage}>
          {activeSvg ? (
            <img src={activeSvg} alt={activeSlide?.title ?? "SVG slide"} style={styles.slideImage} />
          ) : (
            <div style={styles.emptyStage}>
              <div style={styles.emptyKicker}>ATLAS NOTES</div>
              <div style={styles.emptyHeadline}>Landing-page style SVG slides</div>
              <div style={styles.emptyCopy}>
                Generate a prompt-driven deck, preview each SVG, then export those SVG slides into a PowerPoint file.
              </div>
            </div>
          )}
        </section>

        {activeSlide ? (
          <section style={styles.jsonPreview}>
            <div style={styles.previewLabel}>@json-render/react preview</div>
            <div style={styles.reactFrame}>
              <StateProvider>
                <ActionProvider>
                  <VisibilityProvider>
                    <Renderer
                      spec={activeSlide.spec as Spec}
                      registry={registry}
                    />
                  </VisibilityProvider>
                </ActionProvider>
              </StateProvider>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

const font =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const styles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    width: "100vw",
    background: "#080b10",
    color: "#eef3fb",
    fontFamily: font,
  },
  sidebar: {
    width: 330,
    flexShrink: 0,
    borderRight: "1px solid #202838",
    background: "#0d1119",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  brandBlock: {
    paddingBottom: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 2,
    color: "#e2b85c",
  },
  title: {
    margin: "8px 0 0",
    fontSize: 22,
    lineHeight: 1.1,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: "#9da8ba",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    border: "1px solid #2a3548",
    borderRadius: 6,
    background: "#070a0f",
    color: "#eef3fb",
    padding: 12,
    fontSize: 13,
    lineHeight: 1.45,
    fontFamily: font,
    outline: "none",
  },
  select: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #2a3548",
    borderRadius: 6,
    background: "#070a0f",
    color: "#eef3fb",
    padding: "10px 12px",
    fontSize: 13,
    fontFamily: font,
    outline: "none",
  },
  numberInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #2a3548",
    borderRadius: 6,
    background: "#070a0f",
    color: "#eef3fb",
    padding: "10px 12px",
    fontSize: 13,
    fontFamily: font,
    outline: "none",
  },
  swatches: {
    display: "flex",
    gap: 8,
    marginTop: -2,
    marginBottom: 2,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    border: "1px solid rgba(255,255,255,0.18)",
  },
  primaryButton: {
    height: 42,
    border: "none",
    borderRadius: 6,
    background: "#4aa3ff",
    color: "#06111f",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  exportButton: {
    height: 42,
    border: "none",
    borderRadius: 6,
    background: "#e2b85c",
    color: "#120d04",
    fontSize: 14,
    fontWeight: 800,
  },
  error: {
    padding: "10px 12px",
    borderRadius: 6,
    background: "#341820",
    color: "#ffb7c4",
    fontSize: 12,
    lineHeight: 1.4,
  },
  thumbs: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflowY: "auto",
    minHeight: 0,
  },
  thumbButton: {
    display: "grid",
    gridTemplateColumns: "30px 1fr",
    gap: 10,
    alignItems: "center",
    padding: 8,
    border: "1px solid #283244",
    borderRadius: 6,
    background: "#111724",
    cursor: "pointer",
  },
  thumbNumber: {
    color: "#9da8ba",
    fontSize: 11,
    fontWeight: 800,
  },
  thumbImage: {
    width: "100%",
    aspectRatio: "16 / 9",
    objectFit: "cover",
    borderRadius: 4,
    background: "#fff",
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  topbar: {
    height: 68,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 28px",
    borderBottom: "1px solid #202838",
  },
  currentLabel: {
    fontSize: 15,
    fontWeight: 800,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: "#8f9bae",
  },
  stage: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  slideImage: {
    width: "min(100%, 1120px)",
    aspectRatio: "16 / 9",
    objectFit: "contain",
    borderRadius: 6,
    boxShadow: "0 28px 80px rgba(0,0,0,0.52)",
    background: "#fff",
  },
  emptyStage: {
    width: "min(100%, 1120px)",
    aspectRatio: "16 / 9",
    borderRadius: 6,
    padding: 64,
    boxSizing: "border-box",
    background: "linear-gradient(135deg, #f8fbff 0%, #dfe8f3 48%, #10243d 49%, #08111e 100%)",
    color: "#08111e",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxShadow: "0 28px 80px rgba(0,0,0,0.52)",
  },
  emptyKicker: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 3,
    color: "#2b74c7",
  },
  emptyHeadline: {
    marginTop: 18,
    maxWidth: 620,
    fontSize: 58,
    lineHeight: 0.95,
    fontWeight: 900,
  },
  emptyCopy: {
    marginTop: 22,
    maxWidth: 520,
    color: "#41516a",
    fontSize: 18,
    lineHeight: 1.45,
  },
  jsonPreview: {
    borderTop: "1px solid #202838",
    padding: "14px 28px 18px",
    background: "#0b0f17",
  },
  previewLabel: {
    marginBottom: 10,
    fontSize: 11,
    fontWeight: 800,
    color: "#8f9bae",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  reactFrame: {
    width: 320,
    height: 180,
    overflow: "hidden",
    transform: "scale(0.2)",
    transformOrigin: "top left",
    borderRadius: 6,
    background: "#fff",
  },
} as const;
