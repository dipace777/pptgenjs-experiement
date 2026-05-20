import type { ReactNode } from "react";
import type { SlideElement } from "../slide/spec";
import { styles } from "./editorStyles";
import { withHash, withoutHash } from "./editorUtils";

export function Inspector({
  element,
  onPatch,
  onReplace,
}: {
  element: SlideElement;
  onPatch: (patch: Partial<SlideElement>) => void;
  onReplace: (next: SlideElement) => void;
}) {
  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      style={styles.form}
    >
      <div style={styles.grid2}>
        <NumberField label="X" value={element.x} onChange={(x) => onPatch({ x })} />
        <NumberField label="Y" value={element.y} onChange={(y) => onPatch({ y })} />
        <NumberField label="W" value={element.w} onChange={(w) => onPatch({ w })} />
        <NumberField label="H" value={element.h} onChange={(h) => onPatch({ h })} />
      </div>

      {element.kind === "text" ? (
        <>
          <Field label="Text">
            <textarea
              value={element.text}
              rows={4}
              onChange={(event) => onPatch({ text: event.target.value })}
              style={styles.textarea}
            />
          </Field>
          <div style={styles.grid2}>
            <NumberField
              label="Font"
              value={element.fontSize}
              step={1}
              onChange={(fontSize) => onPatch({ fontSize })}
            />
            <ColorField
              label="Color"
              value={element.color}
              onChange={(color) => onPatch({ color })}
            />
          </div>
          <div style={styles.toggleRow}>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={element.bold ?? false}
                onChange={(event) => onPatch({ bold: event.target.checked })}
              />
              Bold
            </label>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={element.italic ?? false}
                onChange={(event) => onPatch({ italic: event.target.checked })}
              />
              Italic
            </label>
          </div>
        </>
      ) : null}

      {element.kind === "bullets" ? (
        <>
          <Field label="Bullet items">
            <textarea
              value={element.items.join("\n")}
              rows={5}
              onChange={(event) =>
                onReplace({
                  ...element,
                  items: event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 8),
                })
              }
              style={styles.textarea}
            />
          </Field>
          <div style={styles.grid2}>
            <NumberField
              label="Font"
              value={element.fontSize}
              step={1}
              onChange={(fontSize) => onPatch({ fontSize })}
            />
            <ColorField
              label="Color"
              value={element.color}
              onChange={(color) => onPatch({ color })}
            />
          </div>
        </>
      ) : null}

      {element.kind === "chart" ? (
        <>
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
        </>
      ) : null}

      {element.kind === "table" ? (
        <>
          <Field label="Rows">
            <textarea
              value={element.rows.map((row) => row.join(", ")).join("\n")}
              rows={6}
              onChange={(event) => {
                const rows = event.target.value
                  .split("\n")
                  .map((line) =>
                    line
                      .split(",")
                      .map((cell) => cell.trim())
                      .slice(0, 6),
                  )
                  .filter((row) => row.some(Boolean))
                  .slice(0, 8);
                if (rows.length >= 2) onReplace({ ...element, rows });
              }}
              style={styles.textarea}
            />
          </Field>
          <div style={styles.grid2}>
            <NumberField
              label="Font"
              value={element.fontSize}
              step={1}
              onChange={(fontSize) => onPatch({ fontSize })}
            />
            <ColorField
              label="Text"
              value={element.textColor}
              onChange={(textColor) => onPatch({ textColor })}
            />
          </div>
          <div style={styles.grid2}>
            <ColorField
              label="Header"
              value={element.headerFill}
              onChange={(headerFill) => onPatch({ headerFill })}
            />
            <ColorField
              label="Header text"
              value={element.headerTextColor}
              onChange={(headerTextColor) => onPatch({ headerTextColor })}
            />
          </div>
          <div style={styles.grid2}>
            <ColorField
              label="Fill"
              value={element.fill ?? "FFFFFF"}
              onChange={(fill) => onPatch({ fill })}
            />
            <ColorField
              label="Border"
              value={element.borderColor}
              onChange={(borderColor) => onPatch({ borderColor })}
            />
          </div>
        </>
      ) : null}

      {element.kind === "rect" || element.kind === "ellipse" ? (
        <div style={styles.grid2}>
          <ColorField
            label="Fill"
            value={element.fill}
            onChange={(fill) => onPatch({ fill })}
          />
          {element.kind === "rect" ? (
            <NumberField
              label="Radius"
              value={element.rx ?? 0}
              step={0.02}
              onChange={(rx) => onPatch({ rx })}
            />
          ) : null}
        </div>
      ) : null}

      {"opacity" in element ? (
        <NumberField
          label="Opacity"
          value={element.opacity ?? 1}
          min={0}
          max={1}
          step={0.05}
          onChange={(opacity) => onPatch({ opacity })}
        />
      ) : null}
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
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value.toFixed(3))}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        style={styles.input}
      />
    </Field>
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
    <Field label={label}>
      <input
        type="color"
        value={withHash(value)}
        onChange={(event) => onChange(withoutHash(event.target.value))}
        style={styles.colorInput}
      />
    </Field>
  );
}
