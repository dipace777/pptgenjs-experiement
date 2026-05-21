import type { ReactNode } from "react";
import type { SlideElement } from "../../../lib/slide-schema";
import { styles } from "../editorStyles";
import { withHash, withoutHash } from "../editorUtils";

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
      {element.kind !== "text" && element.kind !== "bullets" ? (
        <div style={styles.grid2}>
          <NumberField label="X" value={element.x} onChange={(x) => onPatch({ x })} />
          <NumberField label="Y" value={element.y} onChange={(y) => onPatch({ y })} />
          <NumberField label="W" value={element.w} onChange={(w) => onPatch({ w })} />
          <NumberField label="H" value={element.h} onChange={(h) => onPatch({ h })} />
        </div>
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

      {element.kind === "grid" ? (
        <>
          <div style={styles.field}>
            <span>Items</span>
            <div style={styles.itemList}>
              {element.items.map((item, itemIndex) => (
                <div key={itemIndex} style={styles.gridItemEditor}>
                  <div style={styles.itemRow}>
                    <select
                      aria-label={`Grid item ${itemIndex + 1} type`}
                      value={item.type}
                      onChange={(event) => {
                        const type = event.target.value as "text" | "chart" | "image";
                        const items = [...element.items];
                        items[itemIndex] = {
                          ...item,
                          type,
                          chartType: type === "chart" ? (item.chartType ?? "bar") : undefined,
                        };
                        onReplace({ ...element, items });
                      }}
                      style={styles.input}
                    >
                      <option value="text">Text</option>
                      <option value="chart">Chart</option>
                      <option value="image">Image</option>
                    </select>
                    <button
                      type="button"
                      aria-label={`Delete grid item ${itemIndex + 1}`}
                      disabled={element.items.length <= 1}
                      onClick={() =>
                        onReplace({
                          ...element,
                          items: element.items.filter((_, index) => index !== itemIndex),
                        })
                      }
                      style={{
                        ...styles.smallButton,
                        opacity: element.items.length <= 1 ? 0.45 : 1,
                        cursor: element.items.length <= 1 ? "not-allowed" : "pointer",
                      }}
                    >
                      ×
                    </button>
                  </div>
                  {item.type === "chart" ? (
                    <select
                      aria-label={`Grid item ${itemIndex + 1} chart type`}
                      value={item.chartType ?? "bar"}
                      onChange={(event) => {
                        const items = [...element.items];
                        items[itemIndex] = {
                          ...item,
                          chartType: event.target.value as "bar" | "line" | "pie" | "donut",
                        };
                        onReplace({ ...element, items });
                      }}
                      style={styles.input}
                    >
                      <option value="bar">Bar</option>
                      <option value="line">Line</option>
                      <option value="pie">Pie</option>
                      <option value="donut">Donut</option>
                    </select>
                  ) : null}
                  {item.type === "image" ? (
                    <div style={styles.field}>
                      <input
                        aria-label={`Upload image for grid item ${itemIndex + 1}`}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.addEventListener("load", () => {
                            if (typeof reader.result !== "string") return;
                            const items = [...element.items];
                            items[itemIndex] = {
                              ...item,
                              imageData: reader.result,
                              imageName: file.name,
                              subtitle: item.subtitle || file.name,
                            };
                            onReplace({ ...element, items });
                          });
                          reader.readAsDataURL(file);
                        }}
                        style={styles.input}
                      />
                      {item.imageData ? (
                        <button
                          type="button"
                          onClick={() => {
                            const items = [...element.items];
                            items[itemIndex] = {
                              ...item,
                              imageData: undefined,
                              imageName: undefined,
                            };
                            onReplace({ ...element, items });
                          }}
                          style={styles.secondaryButton}
                        >
                          Remove image
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <input
                    aria-label={`Grid item ${itemIndex + 1} title`}
                    value={item.title}
                    onChange={(event) => {
                      const items = [...element.items];
                      items[itemIndex] = { ...item, title: event.target.value };
                      onReplace({ ...element, items });
                    }}
                    style={styles.input}
                  />
                  <input
                    aria-label={`Grid item ${itemIndex + 1} subtitle`}
                    value={item.subtitle ?? ""}
                    placeholder="Subtitle"
                    onChange={(event) => {
                      const items = [...element.items];
                      items[itemIndex] = { ...item, subtitle: event.target.value };
                      onReplace({ ...element, items });
                    }}
                    style={styles.input}
                  />
                </div>
              ))}
            </div>
          </div>
          <div style={styles.grid2}>
            <button
              type="button"
              onClick={() =>
                onReplace({
                  ...element,
                  items: [
                    ...element.items,
                    {
                      type: "text" as const,
                      title: String(element.items.length + 1).padStart(2, "0"),
                      subtitle: "Placeholder",
                    },
                  ].slice(0, 12),
                })
              }
              style={styles.secondaryButton}
            >
              + Item
            </button>
            <button
              type="button"
              disabled={element.items.length <= 1}
              onClick={() =>
                onReplace({
                  ...element,
                  items: element.items.slice(0, -1),
                })
              }
              style={{
                ...styles.secondaryButton,
                opacity: element.items.length <= 1 ? 0.45 : 1,
                cursor: element.items.length <= 1 ? "not-allowed" : "pointer",
              }}
            >
              Remove Last
            </button>
          </div>
          <div style={styles.grid2}>
            <NumberField
              label="Columns"
              value={element.columns}
              min={1}
              max={4}
              step={1}
              onChange={(columns) =>
                onPatch({ columns: Math.max(1, Math.min(4, Math.round(columns))) })
              }
            />
            <NumberField
              label="Gap"
              value={element.gap ?? 0.12}
              max={0.4}
              step={0.02}
              onChange={(gap) => onPatch({ gap })}
            />
          </div>
          <div style={styles.grid2}>
            <NumberField
              label="Number font"
              value={element.numberFontSize}
              step={1}
              onChange={(numberFontSize) => onPatch({ numberFontSize })}
            />
            <NumberField
              label="Label font"
              value={element.labelFontSize}
              step={1}
              onChange={(labelFontSize) => onPatch({ labelFontSize })}
            />
          </div>
          <div style={styles.grid2}>
            <ColorField
              label="Number"
              value={element.numberColor}
              onChange={(numberColor) => onPatch({ numberColor })}
            />
            <ColorField
              label="Label"
              value={element.labelColor}
              onChange={(labelColor) => onPatch({ labelColor })}
            />
          </div>
          <div style={styles.grid2}>
            <ColorField
              label="Fill"
              value={element.fill}
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

      {element.kind === "image" ? (
        <>
          <Field label="Image file">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.addEventListener("load", () => {
                  if (typeof reader.result !== "string") return;
                  onReplace({
                    ...element,
                    data: reader.result,
                    name: file.name,
                  });
                });
                reader.readAsDataURL(file);
              }}
              style={styles.input}
            />
          </Field>
          {element.data ? (
            <>
              <div style={{ fontSize: 11, color: "#9aa7bd" }}>
                {element.name ?? "Uploaded image"}
              </div>
              <button
                type="button"
                onClick={() =>
                  onReplace({ ...element, data: undefined, name: undefined })
                }
                style={styles.secondaryButton}
              >
                Remove image
              </button>
            </>
          ) : null}
          <Field label="Fit">
            <select
              value={element.fit ?? "contain"}
              onChange={(event) =>
                onPatch({
                  fit: event.target.value as "contain" | "cover" | "fill",
                })
              }
              style={styles.input}
            >
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
              <option value="fill">Fill (stretch)</option>
            </select>
          </Field>
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
