import { useEffect, useState } from "react";
import { SlidePreview } from "./SlidePreview";
import type { Deck } from "./spec";

interface Props {
  deck: Deck;
  onDownload: () => void;
}

const SIDEBAR_W = 240;
const THUMB_W = 188;

export function DeckPreview({ deck, onDownload }: Props) {
  const [active, setActive] = useState(0);
  const total = deck.slides.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
    </div>
  );
}

function NavButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
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
