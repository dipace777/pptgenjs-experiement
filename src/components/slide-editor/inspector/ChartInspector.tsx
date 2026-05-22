import type { ReactNode } from "react";
import type { ChartElement, SlideElement } from "../../../lib/slide-schema";
import { styles } from "../editorStyles";
import { withHash, withoutHash } from "../editorUtils";

export function ChartInspector({
  element,
  onPatch,
  onReplace,
}: {
  element: ChartElement;
  onPatch: (patch: Partial<SlideElement>) => void;
  onReplace: (next: ChartElement) => void;
}) {
  return (
    <form onSubmit={(event) => event.preventDefault()} style={styles.form}>
      <div style={styles.grid2}>
        <NumberField label="X" value={element.x} onChange={(x) => onPatch({ x })} />
        <NumberField label="Y" value={element.y} onChange={(y) => onPatch({ y })} />
        <NumberField label="W" value={element.w} onChange={(w) => onPatch({ w })} />
        <NumberField label="H" value={element.h} onChange={(h) => onPatch({ h })} />
      </div>

      <div style={styles.grid2}>
        <Field label="Chart type">
          <select
            value={element.chartType}
            onChange={(event) =>
              onPatch({
                chartType: event.target.value as "bar" | "line" | "donut",
              })
            }
            style={styles.input}
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="donut">Donut</option>
          </select>
        </Field>
        <ColorField
          label="Color"
          value={element.color}
          onChange={(color) => onPatch({ color })}
        />
      </div>
      <Field label="Title">
        <input
          value={element.title ?? ""}
          onChange={(event) => onPatch({ title: event.target.value })}
          style={styles.input}
        />
      </Field>
      <Field label="Data">
        <textarea
          value={element.data
            .map(
              (datum) =>
                `${datum.label}, ${datum.value}${datum.color ? `, ${datum.color}` : ""}`,
            )
            .join("\n")}
          rows={5}
          onChange={(event) => {
            const data = event.target.value
              .split("\n")
              .map((line) => {
                const [label, value, color] = line
                  .split(",")
                  .map((part) => part.trim());
                return {
                  label,
                  value: Number(value) || 0,
                  color: color ? withoutHash(color) : undefined,
                };
              })
              .filter((datum) => datum.label)
              .slice(0, 8);
            if (data.length > 0) onReplace({ ...element, data });
          }}
          style={styles.textarea}
        />
      </Field>
      <label style={styles.checkLabel}>
        <input
          type="checkbox"
          checked={element.showValues ?? false}
          onChange={(event) => onPatch({ showValues: event.target.checked })}
        />
        Show values
      </label>

      <NumberField
        label="Opacity"
        value={element.opacity ?? 1}
        min={0}
        max={1}
        step={0.05}
        onChange={(opacity) => onPatch({ opacity })}
      />
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  min = 0,
  max = 99,
  step = 0.05,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={styles.input}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      <input
        type="color"
        value={withHash(value)}
        onChange={(event) => onChange(withoutHash(event.target.value))}
        style={styles.colorInput}
      />
    </label>
  );
}
