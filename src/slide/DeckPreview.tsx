import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { SlidePreview } from "./SlidePreview";
import type { GenerateDeckInput } from "./generateDeck";
import type { Deck } from "./spec";

interface Props {
  deck: Deck;
  onDownload: () => void;
  onGenerate: (input: GenerateDeckInput) => Promise<void>;
}

const SIDEBAR_W = 240;
const THUMB_W = 188;

export function DeckPreview({ deck, onDownload, onGenerate }: Props) {
  const [active, setActive] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [form, setForm] = useState<GenerateDeckInput>({
    topic: "Lionel Messi career profile",
    audience: "football fans and sports media editors",
    tone: "polished, confident, documentary-style",
    slideCount: 6,
    visualStyle: "modern editorial sports deck with navy, sky blue, gold, and crisp statistical layouts",
  });
  const total = deck.slides.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        setActive((i) => Math.min(total - 1, i + 1));
        e.preventDefault();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setActive((i) => Math.max(0, i - 1));
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsGenerating(true);
    setGenerateError(null);
    try {
      await onGenerate(form);
      setDrawerOpen(false);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Could not generate the deck.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        background: "#0a0d14",
        color: "#e6ebf5",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      }}
    >
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside
        style={{
          width: SIDEBAR_W,
          flexShrink: 0,
          background: "#10141e",
          borderRight: "1px solid #1d2433",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #1d2433",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 2,
              color: "#6a7894",
            }}
          >
            DECK
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 15,
              fontWeight: 600,
              color: "#f4f6fa",
            }}
          >
            {deck.title}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: "#6a7894" }}>
            {total} slides
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 0",
          }}
        >
          {deck.slides.map((slide, i) => {
            const isActive = i === active;
            return (
              <button
                key={i}
                onClick={() => setActive(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "8px 16px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "inherit",
                }}
              >
                <span
                  style={{
                    width: 18,
                    fontSize: 11,
                    color: isActive ? "#d4a24c" : "#6a7894",
                    fontWeight: 600,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div
                  style={{
                    padding: 3,
                    borderRadius: 5,
                    background: isActive ? "#d4a24c" : "transparent",
                    transition: "background 120ms",
                  }}
                >
                  <div
                    style={{
                      borderRadius: 3,
                      overflow: "hidden",
                      display: "block",
                      lineHeight: 0,
                    }}
                  >
                    <SlidePreview
                      slide={slide}
                      width={THUMB_W}
                      framed={false}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            borderBottom: "1px solid #1d2433",
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "#9aa7bd",
            }}
          >
            <span style={{ color: "#e6ebf5", fontWeight: 600 }}>
              {deck.slides[active]?.title ?? `Slide ${active + 1}`}
            </span>
            <span style={{ margin: "0 10px", color: "#3a4358" }}>·</span>
            <span>
              Slide {active + 1} of {total}
            </span>
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "#e6ebf5",
                background: "#1d2433",
                border: "1px solid #2b3448",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Generate Template
            </button>
            <button
              type="button"
              onClick={onDownload}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "#0b1f3a",
                background: "#d4a24c",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              <span>↓</span>
              Download .pptx
            </button>
          </div>
        </div>

        {/* Stage */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            minHeight: 0,
          }}
        >
          <ResponsiveSlide deck={deck} active={active} />
        </div>

        {/* Bottom controls */}
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            borderTop: "1px solid #1d2433",
          }}
        >
          <NavButton
            disabled={active === 0}
            onClick={() => setActive((i) => Math.max(0, i - 1))}
          >
            ←
          </NavButton>
          <div
            style={{
              minWidth: 72,
              textAlign: "center",
              fontSize: 13,
              color: "#9aa7bd",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span style={{ color: "#e6ebf5", fontWeight: 600 }}>
              {active + 1}
            </span>{" "}
            / {total}
          </div>
          <NavButton
            disabled={active === total - 1}
            onClick={() => setActive((i) => Math.min(total - 1, i + 1))}
          >
            →
          </NavButton>
        </div>
      </main>

      {drawerOpen ? (
        <div
          aria-modal="true"
          role="dialog"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(3, 7, 18, 0.58)",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isGenerating) {
              setDrawerOpen(false);
            }
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              width: 420,
              maxWidth: "calc(100vw - 32px)",
              height: "100%",
              background: "#10141e",
              borderLeft: "1px solid #273044",
              boxShadow: "-24px 0 60px rgba(0,0,0,0.38)",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 2,
                    color: "#6a7894",
                  }}
                >
                  GENERATOR
                </div>
                <h2
                  style={{
                    margin: "5px 0 0",
                    fontSize: 20,
                    lineHeight: 1.15,
                    color: "#f4f6fa",
                  }}
                >
                  Generate Template
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close drawer"
                disabled={isGenerating}
                onClick={() => setDrawerOpen(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 7,
                  border: "1px solid #2b3448",
                  background: "#161b27",
                  color: "#9aa7bd",
                  cursor: isGenerating ? "not-allowed" : "pointer",
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>

            <Field label="Topic">
              <textarea
                required
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                rows={3}
                style={inputStyle}
              />
            </Field>

            <Field label="Audience">
              <input
                required
                value={form.audience}
                onChange={(e) =>
                  setForm({ ...form, audience: e.target.value })
                }
                style={inputStyle}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 12 }}>
              <Field label="Tone">
                <input
                  required
                  value={form.tone}
                  onChange={(e) => setForm({ ...form, tone: e.target.value })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Slides">
                <input
                  required
                  min={3}
                  max={8}
                  type="number"
                  value={form.slideCount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      slideCount: Number(e.target.value),
                    })
                  }
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="Visual style">
              <textarea
                required
                value={form.visualStyle}
                onChange={(e) =>
                  setForm({ ...form, visualStyle: e.target.value })
                }
                rows={4}
                style={inputStyle}
              />
            </Field>

            {generateError ? (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  background: "#351b22",
                  color: "#ffb4c1",
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                {generateError}
              </div>
            ) : null}

            <div style={{ flex: 1 }} />

            <button
              type="submit"
              disabled={isGenerating}
              style={{
                height: 42,
                borderRadius: 6,
                border: "none",
                background: isGenerating ? "#6f5b36" : "#d4a24c",
                color: "#0b1f3a",
                fontSize: 14,
                fontWeight: 700,
                cursor: isGenerating ? "wait" : "pointer",
              }}
            >
              {isGenerating ? "Generating..." : "Generate and Preview"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 6,
  border: "1px solid #2b3448",
  background: "#0a0d14",
  color: "#e6ebf5",
  padding: "10px 11px",
  fontSize: 13,
  lineHeight: 1.4,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  outline: "none",
  resize: "vertical",
} as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        fontSize: 12,
        fontWeight: 600,
        color: "#9aa7bd",
      }}
    >
      {label}
      {children}
    </label>
  );
}

function NavButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: disabled ? "#161b27" : "#1d2433",
        color: disabled ? "#3a4358" : "#e6ebf5",
        border: "1px solid #232b3d",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 16,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}

// Picks a slide width that fits the available stage area, keeping 16:9.
function ResponsiveSlide({ deck, active }: { deck: Deck; active: number }) {
  const [size, setSize] = useState({ w: 960, h: 540 });

  useEffect(() => {
    const measure = () => {
      const stageW = window.innerWidth - SIDEBAR_W - 64; // padding 32 x2
      const stageH = window.innerHeight - 56 - 64 - 64; // topbar, bottombar, padding
      const widthByH = stageH * (16 / 9);
      const w = Math.max(320, Math.min(stageW, widthByH));
      setSize({ w, h: w * (9 / 16) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div style={{ width: size.w, height: size.h }}>
      <SlidePreview slide={deck.slides[active]} width={size.w} />
    </div>
  );
}
