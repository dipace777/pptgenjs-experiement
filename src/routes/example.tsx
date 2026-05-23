/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SlideEditor } from "../components/slide-editor";
import { TEMPLATES } from "../templates";

export const Route = createFileRoute("/example")({
  component: ExamplePage,
});

function ExamplePage() {
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];

  const templatePicker = (
    <select
      value={templateId}
      onChange={(event) => setTemplateId(event.target.value)}
      style={pickerSelectStyle}
      aria-label="Template"
    >
      {TEMPLATES.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label} · {t.deck.slides.length} slides
        </option>
      ))}
    </select>
  );

  return (
    <SlideEditor
      key={template.id}
      initialDeck={template.deck}
      toolbarLeading={templatePicker}
    />
  );
}

const pickerSelectStyle = {
  height: 30,
  padding: "0 8px",
  borderRadius: 6,
  border: "1px solid #2b3448",
  background: "#0a0d14",
  color: "#e6ebf5",
  fontSize: 12,
  fontWeight: 700,
  outline: "none",
  cursor: "pointer",
} as const;
