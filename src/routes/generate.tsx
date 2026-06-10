/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useRef, useState, type ChangeEvent } from "react";
import {
  DeckGenerationInputSchema,
  MAX_SLIDE_COUNT,
  MIN_SLIDE_COUNT,
  SlideOutlineSchema,
  deckFromOutline,
  fallbackOutline,
  generateFallbackDeck,
  type DeckGenerationInput,
} from "../lib/deck-generator";
import {
  extractDesignElementTemplates,
  type ExtractedDesignElementTemplate,
} from "../lib/design-element-extraction";
import { savePreviewDeck } from "../lib/deck-storage";
import { DECK_THEME_PRESETS, type DeckTheme } from "../lib/deck-theme";
import { DeckSchema, type Deck } from "../lib/slide-schema";

type GenerateMode = "prompt" | "pptx";

const MODE_OPTIONS: Array<{ value: GenerateMode; label: string }> = [
  { value: "prompt", label: "Generate from prompt" },
  { value: "pptx", label: "Import from PPTX" },
];

const AI_GENERATION_TIMEOUT_MS = 20_000;

const defaultInput: DeckGenerationInput = {
  title: "AI Operating Plan",
  description:
    "A concise executive deck explaining how a team can adopt AI tools responsibly across product, operations, and customer workflows.",
  slideCount: 6,
  theme: {
    background: "#F7F8FB",
    surface: "#FFFFFF",
    primary: "#16324F",
    secondary: "#3E78B2",
    accent: "#D4A24C",
    text: "#172033",
    muted: "#68748A",
  },
};

const generateDeck = createServerFn({ method: "POST" })
  .inputValidator((data: DeckGenerationInput) =>
    DeckGenerationInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const [{ chat }, { openaiText }] = await Promise.all([
        import("@tanstack/ai"),
        import("@tanstack/ai-openai"),
      ]);
      const adapter = openaiText(
        (process.env.OPENAI_MODEL ?? "gpt-4.1-mini") as Parameters<
          typeof openaiText
        >[0],
      );
      const sectionCount = data.slideCount - 2;
      const abortController = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        abortController.abort();
      }, AI_GENERATION_TIMEOUT_MS);

      const outline = await (async () => {
        try {
          return await chat({
            adapter,
            outputSchema: SlideOutlineSchema,
            abortController,
            systemPrompts: [
              "You create tight executive slide outlines. Return concrete, non-generic slide structure only.",
            ],
            messages: [
              {
                role: "user",
                content: [
                  `Title: ${data.title}`,
                  `Description: ${data.description}`,
                  `Create exactly ${sectionCount} sections. Mix visual types across bullets, chart, and table.`,
                  "Each section should have practical bullets that can be rendered directly on a slide.",
                ].join("\n"),
              },
            ],
          });
        } catch (error) {
          if (timedOut) {
            throw new Error(
              `AI generation timed out after ${AI_GENERATION_TIMEOUT_MS / 1000} seconds`,
            );
          }
          throw error;
        } finally {
          clearTimeout(timeout);
        }
      })();

      return {
        deck: deckFromOutline(data, outline),
        outline,
        source: "ai" as const,
      };
    } catch (error) {
      const outline = fallbackOutline(data);
      return {
        deck: generateFallbackDeck(data),
        outline,
        source: "fallback" as const,
        message:
          error instanceof Error ? error.message : "AI generation failed",
      };
    }
  });

export const Route = createFileRoute("/generate")({
  component: GeneratePage,
});

function GeneratePage() {
  const generateDeckFn = useServerFn(generateDeck);
  const [mode, setMode] = useState<GenerateMode>("prompt");
  const [input, setInput] = useState<DeckGenerationInput>(defaultInput);
  const [status, setStatus] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pptxFile, setPptxFile] = useState<File | null>(null);
  const pptxInputRef = useRef<HTMLInputElement | null>(null);

  const patchTheme = (
    key: keyof DeckGenerationInput["theme"],
    value: string,
  ) => {
    setInput((current) => ({
      ...current,
      theme: { ...current.theme, [key]: value },
    }));
  };

  const applyPresetToInput = (theme: DeckTheme) => {
    setInput((current) => ({
      ...current,
      theme: {
        background: hashed(theme.background),
        surface: hashed(theme.surface ?? "FFFFFF"),
        primary: hashed(theme.primary),
        secondary: hashed(theme.secondary),
        accent: hashed(theme.accent),
        text: hashed(theme.text),
        muted: hashed(theme.muted ?? "6A7894"),
      },
    }));
  };

  const saveAndPreview = async (
    deck: Deck,
    componentTemplates?: ReadonlyArray<ExtractedDesignElementTemplate>,
  ) => {
    setStatus("Opening preview...");
    await savePreviewDeck(deck, componentTemplates);
    window.location.href = "/preview";
  };

  const onPptxFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPptxFile(file);
    setStatus(null);
  };

  const submitPptx = async () => {
    if (!pptxFile) {
      setStatus("Pick a .pptx file first.");
      return;
    }
    setIsGenerating(true);
    setStatus("Parsing PPTX...");
    try {
      const { importPptxFile } = await import("../lib/pptx-import-v2");
      const { deck: importedDeck, warnings } = await importPptxFile(pptxFile, {
        preferSidecar: false,
      });
      const validated = DeckSchema.safeParse(importedDeck);
      if (!validated.success) {
        setStatus(
          `Imported deck didn't validate: ${validated.error.issues[0]?.message ?? "unknown reason"}`,
        );
        return;
      }
      if (warnings.length > 0) {
        // Surface the first warning so the user knows what was dropped;
        // full list is logged in dev tools for inspection.
        // eslint-disable-next-line no-console
        console.warn("PPTX import warnings:", warnings);
      }
      const componentTemplates = extractDesignElementTemplates(validated.data);
      setStatus(
        `Imported ${validated.data.slides.length} slide(s)${
          warnings.length > 0 ? ` (${warnings.length} warnings)` : ""
        }${
          componentTemplates.length > 0
            ? ` Found ${componentTemplates.length} reusable design element(s).`
            : ""
        }.`,
      );
      await saveAndPreview(validated.data, componentTemplates);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Import failed: ${error.message}`
          : "Import failed.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const submitPrompt = async () => {
    setIsGenerating(true);
    setStatus("Generating outline...");
    try {
      const result = await generateDeckFn({ data: input });
      setStatus(
        result.source === "ai"
          ? "Generated with TanStack AI."
          : `Using local fallback. ${result.message ?? ""}`,
      );
      await saveAndPreview(result.deck);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Generation failed: ${error.message}`
          : "Generation failed.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main style={pageStyle}>
      <form
        style={panelStyle}
        onSubmit={async (event) => {
          event.preventDefault();
          if (mode === "pptx") await submitPptx();
          else await submitPrompt();
        }}
      >
        <div>
          <div style={eyebrowStyle}>NEW DECK</div>
          <h1 style={titleStyle}>
            {mode === "pptx" ? "Import a PPTX" : "Describe the deck"}
          </h1>
        </div>

        <label style={fieldStyle}>
          <span>Source</span>
          <select
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as GenerateMode);
              setStatus(null);
            }}
            style={inputStyle}
          >
            {MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {mode === "prompt" ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px",
                gap: 12,
              }}
            >
              <label style={fieldStyle}>
                <span>Title</span>
                <input
                  value={input.title}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                <span>Slides</span>
                <input
                  type="number"
                  min={MIN_SLIDE_COUNT}
                  max={MAX_SLIDE_COUNT}
                  step={1}
                  value={input.slideCount}
                  onChange={(event) => {
                    const next = Number.parseInt(event.target.value, 10);
                    if (!Number.isFinite(next)) return;
                    const clamped = Math.max(
                      MIN_SLIDE_COUNT,
                      Math.min(MAX_SLIDE_COUNT, next),
                    );
                    setInput((current) => ({
                      ...current,
                      slideCount: clamped,
                    }));
                  }}
                  style={inputStyle}
                />
              </label>
            </div>

            <label style={fieldStyle}>
              <span>Description</span>
              <textarea
                value={input.description}
                rows={7}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.45 }}
              />
            </label>

            <div style={fieldStyle}>
              <span>Theme preset</span>
              <div style={presetRowStyle}>
                {DECK_THEME_PRESETS.map((preset) => {
                  const isActive = isThemePresetActive(
                    preset.theme,
                    input.theme,
                  );
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      title={preset.label}
                      aria-pressed={isActive}
                      onClick={() => applyPresetToInput(preset.theme)}
                      style={{
                        ...presetButtonStyle,
                        borderColor: isActive ? "#d4a24c" : "#2b3448",
                        boxShadow: isActive
                          ? "0 0 0 1px #d4a24c inset"
                          : "none",
                      }}
                    >
                      <PresetSwatch theme={preset.theme} />
                      <span style={presetLabelStyle}>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={colorGridStyle}>
              <ColorInput
                label="Background"
                value={input.theme.background}
                onChange={(value) => patchTheme("background", value)}
              />
              <ColorInput
                label="Surface"
                value={input.theme.surface}
                onChange={(value) => patchTheme("surface", value)}
              />
              <ColorInput
                label="Primary"
                value={input.theme.primary}
                onChange={(value) => patchTheme("primary", value)}
              />
              <ColorInput
                label="Secondary"
                value={input.theme.secondary}
                onChange={(value) => patchTheme("secondary", value)}
              />
              <ColorInput
                label="Accent"
                value={input.theme.accent}
                onChange={(value) => patchTheme("accent", value)}
              />
              <ColorInput
                label="Text"
                value={input.theme.text}
                onChange={(value) => patchTheme("text", value)}
              />
              <ColorInput
                label="Muted"
                value={input.theme.muted}
                onChange={(value) => patchTheme("muted", value)}
              />
            </div>
          </>
        ) : (
          <div style={fieldStyle}>
            <span>PPTX file</span>
            <input
              ref={pptxInputRef}
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={onPptxFile}
              style={{ display: "none" }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 10,
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => pptxInputRef.current?.click()}
                style={{
                  ...primaryButtonStyle,
                  background: "#1a1f2c",
                  color: "#d8dfed",
                  border: "1px solid #2b3448",
                }}
              >
                {pptxFile ? "Choose another" : "Choose file"}
              </button>
              <span
                style={{
                  color: pptxFile ? "#e6ebf5" : "#7d89a3",
                  fontWeight: 600,
                }}
              >
                {pptxFile?.name ?? "No file selected"}
              </span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="submit"
            disabled={isGenerating || (mode === "pptx" && !pptxFile)}
            style={primaryButtonStyle}
          >
            {isGenerating
              ? mode === "pptx"
                ? "Importing..."
                : "Generating..."
              : mode === "pptx"
                ? "Import preview"
                : "Generate preview"}
          </button>
          <a href="/" style={secondaryLinkStyle}>
            Back
          </a>
        </div>

        {status ? <div style={statusStyle}>{status}</div> : null}
      </form>
    </main>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={fieldStyle}>
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ ...inputStyle, height: 42, padding: 4 }}
      />
    </label>
  );
}

function PresetSwatch({ theme }: { theme: DeckTheme }) {
  const stops: Array<keyof DeckTheme> = [
    "background",
    "surface",
    "primary",
    "secondary",
    "accent",
    "text",
  ];
  return (
    <div style={swatchRowStyle}>
      {stops.map((key) => (
        <span
          key={key}
          style={{
            ...swatchStopStyle,
            background: hashed(theme[key] ?? "FFFFFF"),
          }}
        />
      ))}
    </div>
  );
}

function hashed(value: string): string {
  return value.startsWith("#") ? value : `#${value}`;
}

function isThemePresetActive(
  preset: DeckTheme,
  input: DeckGenerationInput["theme"],
): boolean {
  const keys: Array<keyof DeckTheme> = [
    "background",
    "surface",
    "primary",
    "secondary",
    "accent",
    "text",
    "muted",
  ];
  return keys.every((key) => {
    const presetValue = (preset[key] ?? "").replace(/^#/, "").toUpperCase();
    const inputValue = (input[key] ?? "").replace(/^#/, "").toUpperCase();
    return presetValue === inputValue;
  });
}

const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const pageStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#0a0d14",
  color: "#f4f6fa",
  fontFamily,
  padding: 24,
  boxSizing: "border-box",
} as const;

const panelStyle = {
  width: "min(720px, 100%)",
  display: "grid",
  gap: 18,
  padding: 24,
  border: "1px solid #20283a",
  borderRadius: 8,
  background: "#10141e",
  boxSizing: "border-box",
} as const;

const eyebrowStyle = {
  color: "#7d89a3",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1.4,
} as const;

const titleStyle = {
  margin: "6px 0 0",
  fontSize: 28,
  lineHeight: 1.1,
} as const;

const fieldStyle = {
  display: "grid",
  gap: 7,
  color: "#9aa7bd",
  fontSize: 12,
  fontWeight: 800,
} as const;

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #2b3448",
  borderRadius: 7,
  background: "#0a0d14",
  color: "#f4f6fa",
  padding: "10px 11px",
  font: `14px ${fontFamily}`,
  outline: "none",
} as const;

const colorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 12,
} as const;

const presetRowStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 8,
} as const;

const presetButtonStyle = {
  display: "grid",
  gap: 6,
  padding: "8px 9px",
  borderRadius: 7,
  border: "1px solid #2b3448",
  background: "#0a0d14",
  color: "#d8dfed",
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
} as const;

const presetLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
} as const;

const swatchRowStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gap: 3,
  height: 16,
  borderRadius: 4,
  overflow: "hidden",
} as const;

const swatchStopStyle = {
  width: "100%",
  height: "100%",
} as const;

const primaryButtonStyle = {
  height: 38,
  padding: "0 15px",
  border: "none",
  borderRadius: 7,
  background: "#d4a24c",
  color: "#071425",
  fontWeight: 800,
  cursor: "pointer",
} as const;

const secondaryLinkStyle = {
  color: "#a8b3c7",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 700,
} as const;

const statusStyle = {
  color: "#a8b3c7",
  fontSize: 13,
} as const;
