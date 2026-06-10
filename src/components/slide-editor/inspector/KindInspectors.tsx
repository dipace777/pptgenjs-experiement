import {
  averageBorderRadius,
  elementFont,
  setTableRowsFromStrings,
  setTextContent,
  setTextListStrings,
  tableRowsAsStrings,
  textContent,
  textListStrings,
  uniformBorderRadius,
} from "../../../lib/element-model";
import type {
  Font,
  SlideElement,
  TableCell,
} from "../../../lib/slide-schema";
import { sanitizeSvgMarkup } from "../../../lib/svg-sanitize";
import { styles } from "../editorStyles";
import { GeometryInspector } from "./GeometryInspector";
import {
  CheckboxField,
  ColorField,
  NumberField,
  SelectField,
  TextField,
  TextareaField,
} from "./InspectorFields";

type Patch = (patch: Partial<SlideElement>) => void;

type KindInspectorProps<T extends SlideElement> = {
  element: T;
  onPatch: Patch;
};

type TextElement = Extract<SlideElement, { type: "text" }>;
type BulletsElement = Extract<SlideElement, { type: "text-list" }>;
type ShapeElement = Extract<
  SlideElement,
  { type: "rectangle" | "ellipse" | "line" }
>;
type ImageElement = Extract<SlideElement, { type: "image" }>;
type TableElement = Extract<SlideElement, { type: "table" }>;
type SvgElement = Extract<SlideElement, { type: "svg" }>;

export function TextInspector({
  element,
  onPatch,
}: KindInspectorProps<TextElement>) {
  const font = elementFont(element);

  return (
    <>
      <GeometryInspector element={element} onPatch={onPatch} />
      <form onSubmit={(event) => event.preventDefault()} style={styles.form}>
        <TextareaField
          label="Text"
          rows={4}
          value={textContent(element)}
          onChange={(text) => {
            const next = setTextContent(element, text || " ");
            onPatch({ runs: next.runs } as Partial<SlideElement>);
          }}
        />
        <div style={styles.grid2}>
          <TextField
            label="Font"
            value={font.family}
            onChange={(family) => patchFont(onPatch, element, { family })}
          />
          <NumberField
            label="Size"
            min={6}
            max={360}
            step={1}
            value={font.size}
            onChange={(size) => patchFont(onPatch, element, { size })}
          />
        </div>
        <ColorField
          label="Color"
          value={font.color}
          onChange={(color) => patchFont(onPatch, element, { color })}
        />
        <div style={styles.grid2}>
          <SelectField
            label="Align"
            value={element.alignment?.horizontal ?? "left"}
            options={[
              { label: "Left", value: "left" },
              { label: "Center", value: "center" },
              { label: "Right", value: "right" },
            ]}
            onChange={(horizontal) =>
              onPatch({
                alignment: { ...(element.alignment ?? {}), horizontal },
              } as Partial<SlideElement>)
            }
          />
          <SelectField
            label="Vertical"
            value={element.alignment?.vertical ?? "top"}
            options={[
              { label: "Top", value: "top" },
              { label: "Middle", value: "middle" },
              { label: "Bottom", value: "bottom" },
            ]}
            onChange={(vertical) =>
              onPatch({
                alignment: { ...(element.alignment ?? {}), vertical },
              } as Partial<SlideElement>)
            }
          />
        </div>
        <div style={styles.grid2}>
          <NumberField
            label="Line height"
            min={0.8}
            max={2.2}
            step={0.05}
            value={font.lineHeight ?? 1.15}
            onChange={(lineHeight) => patchFont(onPatch, element, { lineHeight })}
          />
          <NumberField
            label="Tracking"
            min={-200}
            max={600}
            step={10}
            value={font.letterSpacing ?? 0}
            onChange={(letterSpacing) =>
              patchFont(onPatch, element, { letterSpacing })
            }
          />
        </div>
        <CheckboxField
          label="Bold"
          checked={font.bold ?? false}
          onChange={(bold) => patchFont(onPatch, element, { bold })}
        />
        <CheckboxField
          label="Italic"
          checked={font.italic ?? false}
          onChange={(italic) => patchFont(onPatch, element, { italic })}
        />
      </form>
    </>
  );
}

export function BulletsInspector({
  element,
  onPatch,
}: KindInspectorProps<BulletsElement>) {
  const font = elementFont(element);

  return (
    <>
      <GeometryInspector element={element} onPatch={onPatch} />
      <form onSubmit={(event) => event.preventDefault()} style={styles.form}>
        <TextareaField
          label="Items"
          rows={5}
          value={textListStrings(element).join("\n")}
          onChange={(value) => {
            const items = value
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 8);
            if (items.length > 0) {
              onPatch(setTextListStrings(element, items) as Partial<SlideElement>);
            }
          }}
        />
        <div style={styles.grid2}>
          <TextField
            label="Font"
            value={font.family}
            onChange={(family) => patchFont(onPatch, element, { family })}
          />
          <NumberField
            label="Size"
            min={8}
            max={36}
            step={1}
            value={font.size}
            onChange={(size) => patchFont(onPatch, element, { size })}
          />
        </div>
        <div style={styles.grid2}>
          <ColorField
            label="Text"
            value={font.color}
            onChange={(color) => patchFont(onPatch, element, { color })}
          />
          <SelectField
            label="Marker"
            value={element.marker ?? "bullet"}
            options={[
              { label: "Bullet", value: "bullet" },
              { label: "Number", value: "number" },
              { label: "None", value: "none" },
            ]}
            onChange={(marker) => onPatch({ marker } as Partial<SlideElement>)}
          />
        </div>
        <NumberField
          label="Line spacing"
          min={0.9}
          max={2}
          step={0.05}
          value={font.lineHeight ?? 1.25}
          onChange={(lineHeight) => patchFont(onPatch, element, { lineHeight })}
        />
      </form>
    </>
  );
}

export function ShapeInspector({
  element,
  onPatch,
}: KindInspectorProps<ShapeElement>) {
  const stroke = element.stroke ?? { color: "0B1F3A", width: 0 };

  return (
    <>
      <GeometryInspector element={element} onPatch={onPatch} />
      <form onSubmit={(event) => event.preventDefault()} style={styles.form}>
        {element.type !== "line" ? (
          <ColorField
            label="Fill"
            value={element.fill?.color ?? "D4A24C"}
            onChange={(color) =>
              onPatch({
                fill: { ...(element.fill ?? {}), color },
              } as Partial<SlideElement>)
            }
          />
        ) : null}
        <div style={styles.grid2}>
          <ColorField
            label="Stroke"
            value={stroke.color}
            onChange={(color) =>
              onPatch({
                stroke: { ...stroke, color, width: Math.max(0.5, stroke.width) },
              } as Partial<SlideElement>)
            }
          />
          <NumberField
            label="Stroke width"
            min={0}
            max={8}
            step={0.25}
            value={stroke.width}
            onChange={(width) =>
              onPatch({
                stroke: { ...stroke, width },
              } as Partial<SlideElement>)
            }
          />
        </div>
        {element.type === "rectangle" ? (
          <NumberField
            label="Corner radius"
            min={0}
            max={0.5}
            step={0.01}
            value={averageBorderRadius(element.borderRadius)}
            onChange={(radius) =>
              onPatch({
                borderRadius: uniformBorderRadius(radius),
              } as Partial<SlideElement>)
            }
          />
        ) : null}
      </form>
    </>
  );
}

export function ImageInspector({
  element,
  onPatch,
}: KindInspectorProps<ImageElement>) {
  return (
    <>
      <GeometryInspector element={element} onPatch={onPatch} />
      <form onSubmit={(event) => event.preventDefault()} style={styles.form}>
        <TextField
          label="Name"
          value={element.name ?? ""}
          onChange={(name) => onPatch({ name } as Partial<SlideElement>)}
        />
        <SelectField
          label="Fit"
          value={element.fit ?? "contain"}
          options={[
            { label: "Contain", value: "contain" },
            { label: "Cover", value: "cover" },
            { label: "Fill", value: "fill" },
          ]}
          onChange={(fit) => onPatch({ fit } as Partial<SlideElement>)}
        />
      </form>
    </>
  );
}

export function TableInspector({
  element,
  onPatch,
}: KindInspectorProps<TableElement>) {
  const font = elementFont(element);

  return (
    <>
      <GeometryInspector element={element} onPatch={onPatch} />
      <form onSubmit={(event) => event.preventDefault()} style={styles.form}>
        <TextareaField
          label="Rows"
          rows={6}
          value={tableRowsAsStrings(element)
            .map((row) => row.join(", "))
            .join("\n")}
          onChange={(value) => {
            const rows = value
              .split("\n")
              .map((row) =>
                row
                  .split(",")
                  .map((cell) => cell.trim())
                  .slice(0, 6),
              )
              .filter((row) => row.some(Boolean))
              .slice(0, 8);
            if (rows.length >= 2) {
              onPatch(
                setTableRowsFromStrings(element, rows) as Partial<SlideElement>,
              );
            }
          }}
        />
        <div style={styles.grid2}>
          <TextField
            label="Font"
            value={font.family}
            onChange={(family) => patchFont(onPatch, element, { family })}
          />
          <NumberField
            label="Size"
            min={6}
            max={28}
            step={1}
            value={font.size}
            onChange={(size) => patchFont(onPatch, element, { size })}
          />
        </div>
        <div style={styles.grid2}>
          <ColorField
            label="Text"
            value={font.color}
            onChange={(color) => patchFont(onPatch, element, { color })}
          />
          <ColorField
            label="Fill"
            value={element.rows[0]?.[0]?.fill?.color ?? "FFFFFF"}
            onChange={(color) =>
              onPatch(updateBodyFill(element, color) as Partial<SlideElement>)
            }
          />
        </div>
        <div style={styles.grid2}>
          <ColorField
            label="Header fill"
            value={element.columns[0]?.fill?.color ?? "0B1F3A"}
            onChange={(color) =>
              onPatch(updateHeaderFill(element, color) as Partial<SlideElement>)
            }
          />
          <ColorField
            label="Header text"
            value={element.columns[0]?.font?.color ?? "FFFFFF"}
            onChange={(color) =>
              onPatch(updateHeaderText(element, color) as Partial<SlideElement>)
            }
          />
        </div>
        <ColorField
          label="Border"
          value={
            element.columns[0]?.stroke?.color ??
            element.rows[0]?.[0]?.stroke?.color ??
            "D9E2EF"
          }
          onChange={(color) =>
            onPatch(updateCellBorders(element, color) as Partial<SlideElement>)
          }
        />
      </form>
    </>
  );
}

export function SvgInspector({
  element,
  onPatch,
}: KindInspectorProps<SvgElement>) {
  return (
    <>
      <GeometryInspector element={element} onPatch={onPatch} />
      <form onSubmit={(event) => event.preventDefault()} style={styles.form}>
        <TextField
          label="Name"
          value={element.name ?? ""}
          onChange={(name) => onPatch({ name } as Partial<SlideElement>)}
        />
        <TextareaField
          label="SVG markup"
          rows={8}
          value={element.svg}
          onChange={(svg) => {
            if (svg.trim()) {
              onPatch({ svg: sanitizeSvgMarkup(svg) } as Partial<SlideElement>);
            }
          }}
        />
      </form>
    </>
  );
}

function patchFont<T extends { font?: Font | null }>(
  onPatch: Patch,
  element: T,
  font: Partial<Font>,
) {
  onPatch({ font: { ...(element.font ?? {}), ...font } } as Partial<SlideElement>);
}

function updateHeaderFill(element: TableElement, color: string): TableElement {
  return {
    ...element,
    columns: element.columns.map((cell) => ({
      ...cell,
      fill: { ...(cell.fill ?? {}), color },
    })),
  };
}

function updateHeaderText(element: TableElement, color: string): TableElement {
  return {
    ...element,
    columns: element.columns.map((cell) => ({
      ...cell,
      font: { ...(cell.font ?? {}), color },
    })),
  };
}

function updateBodyFill(element: TableElement, color: string): TableElement {
  return {
    ...element,
    rows: element.rows.map((row) =>
      row.map((cell) => ({
        ...cell,
        fill: { ...(cell.fill ?? {}), color },
      })),
    ),
  };
}

function updateCellBorders(element: TableElement, color: string): TableElement {
  const withBorder = (cell: TableCell): TableCell => ({
    ...cell,
    stroke: { ...(cell.stroke ?? { width: 0.5 }), color },
  });

  return {
    ...element,
    columns: element.columns.map(withBorder),
    rows: element.rows.map((row) => row.map(withBorder)),
  };
}
