/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  DeckGenerationInputSchema,
  SlideOutlineSchema,
  deckFromOutline,
  fallbackOutline,
  generateFallbackDeck,
  type DeckGenerationInput,
} from "../lib/deck-generator";
import type { Deck } from "../lib/slide-schema";

const defaultInput: DeckGenerationInput = {
  title: "AI Operating Plan",
  description:
    "A concise executive deck explaining how a team can adopt AI tools responsibly across product, operations, and customer workflows.",
  theme: {
    background: "#F7F8FB",
    primary: "#16324F",
    accent: "#D4A24C",
    text: "#172033",
  },
};

const generateDeck = createServerFn({ method: "POST" })
  .inputValidator((data: DeckGenerationInput) => DeckGenerationInputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const [{ chat }, { openaiText }] = await Promise.all([
        import("@tanstack/ai"),
        import("@tanstack/ai-openai"),
      ]);
      const adapter = openaiText(
        (process.env.OPENAI_MODEL ?? "gpt-4.1-mini") as Parameters<typeof openaiText>[0],
      );
      const outline = await chat({
        adapter,
        outputSchema: SlideOutlineSchema,
        systemPrompts: [
          "You create tight executive slide outlines. Return concrete, non-generic slide structure only.",
        ],
        messages: [
          {
            role: "user",
            content: [
              `Title: ${data.title}`,
              `Description: ${data.description}`,
              "Create 4 sections. Mix visual types across bullets, chart, grid, and table.",
              "Each section should have practical bullets that can be rendered directly on a slide.",
            ].join("\n"),
          },
        ],
      });

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
        message: error instanceof Error ? error.message : "AI generation failed",
      };
    }
  });

export const Route = createFileRoute("/generate")({
  component: GeneratePage,
});

function GeneratePage() {
  const generateDeckFn = useServerFn(generateDeck);
  const [input, setInput] = useState<DeckGenerationInput>(defaultInput);
  const [status, setStatus] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const patchTheme = (key: keyof DeckGenerationInput["theme"], value: string) => {
    setInput((current) => ({
      ...current,
      theme: { ...current.theme, [key]: value },
    }));
  };

  const saveAndPreview = (deck: Deck) => {
    window.sessionStorage.setItem("ppty:generatedDeck", JSON.stringify(deck));
    window.location.href = "/preview";
  };

  return (
    <main style={pageStyle}>
      <form
        style={panelStyle}
        onSubmit={async (event) => {
          event.preventDefault();
          setIsGenerating(true);
          setStatus("Generating outline...");
          try {
            const result = await generateDeckFn({ data: input });
            setStatus(
              result.source === "ai"
                ? "Generated with TanStack AI."
                : `Using local fallback. ${result.message ?? ""}`,
            );
            saveAndPreview(result.deck);
          } finally {
            setIsGenerating(false);
          }
        }}
      >
        <div>
          <div style={eyebrowStyle}>GENERATE DECK</div>
          <h1 style={titleStyle}>Describe the deck</h1>
        </div>

        <label style={fieldStyle}>
          <span>Title</span>
          <input
            value={input.title}
            onChange={(event) =>
              setInput((current) => ({ ...current, title: event.target.value }))
            }
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          <span>Description</span>
          <textarea
            value={input.description}
            rows={7}
            onChange={(event) =>
              setInput((current) => ({ ...current, description: event.target.value }))
            }
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.45 }}
          />
        </label>

        <div style={colorGridStyle}>
          <ColorInput
            label="Background"
            value={input.theme.background}
            onChange={(value) => patchTheme("background", value)}
          />
          <ColorInput
            label="Primary"
            value={input.theme.primary}
            onChange={(value) => patchTheme("primary", value)}
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
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="submit" disabled={isGenerating} style={primaryButtonStyle}>
            {isGenerating ? "Generating..." : "Generate preview"}
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
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
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
