/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0a0d14",
        color: "#f4f6fa",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "min(520px, calc(100vw - 40px))",
          display: "grid",
          gap: 18,
        }}
      >
        <div style={{ color: "#7d89a3", fontSize: 12, fontWeight: 800 }}>
          PPTX DECK BUILDER
        </div>
        <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1 }}>
          Generate a deck, then edit it visually.
        </h1>
        <p style={{ margin: 0, color: "#a8b3c7", fontSize: 16, lineHeight: 1.55 }}>
          Start from a title, description, and theme colors. The generated JSON
          opens directly in the slide editor preview.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a
            href="/generate"
            style={{
              height: 40,
              display: "inline-flex",
              alignItems: "center",
              padding: "0 16px",
              borderRadius: 7,
              background: "#d4a24c",
              color: "#071425",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            Start generating
          </a>
          <a
            href="/example"
            style={{
              height: 40,
              display: "inline-flex",
              alignItems: "center",
              padding: "0 16px",
              borderRadius: 7,
              border: "1px solid #2b3448",
              background: "#161b27",
              color: "#d8dfed",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            View example
          </a>
        </div>
      </section>
    </main>
  );
}
