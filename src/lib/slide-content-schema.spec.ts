import { describe, expect, it } from "vitest";
import {
  generateDeckContentJsonSchema,
  generateSlideContentJsonSchema,
  type JsonSchemaObject,
} from "./slide-content-schema";
import type { Deck } from "./slide-schema";

describe("slide content JSON Schema", () => {
  it("generates a real JSON Schema while dropping layout, design, and image data", () => {
    const deck: Deck = {
      title: "Imported Deck",
      description: "Imported from PPTX.",
      slides: [
        {
          background: "101010",
          elements: [
            {
              type: "rectangle",
              position: { x: 0, y: 0 },
              size: { width: 10, height: 5.625 },
              fill: { color: "D6FF3F" },
            },
            {
              type: "text",
              position: { x: 1, y: 1 },
              size: { width: 4, height: 0.6 },
              font: { family: "Inter", size: 32, color: "FFFFFF" },
              runs: [{ text: "  Launch Plan  " }],
            },
            {
              type: "image",
              position: { x: 5, y: 1 },
              size: { width: 2, height: 2 },
              data: "data:image/png;base64,abc123",
              name: "Hero image",
              fit: "cover",
            },
            {
              type: "table",
              position: { x: 1, y: 2 },
              size: { width: 4, height: 1.5 },
              columns: [{ text: "Metric" }, { text: "Value" }],
              rows: [[{ text: "Revenue" }, { text: "$10M" }]],
            },
          ],
        },
      ],
    };

    const schema = generateDeckContentJsonSchema(deck);

    expect(schema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Imported Deck content schema",
      type: "object",
      additionalProperties: false,
      required: ["slide_1"],
      properties: {
        slide_1: {
          type: "object",
          additionalProperties: false,
          required: ["text_1", "image_1", "table_1"],
          properties: {
            text_1: {
              title: "Text 1",
              type: "string",
            },
            image_1: {
              title: "Image 1",
              type: "string",
            },
            table_1: {
              title: "Table 1",
              default: {
                columns: ["Metric", "Value"],
                rows: [["Revenue", "$10M"]],
              },
              examples: [
                {
                  columns: ["Metric", "Value"],
                  rows: [["Revenue", "$10M"]],
                },
              ],
              type: "object",
              additionalProperties: false,
              required: ["columns", "rows"],
              properties: {
                columns: {
                  type: "array",
                  minItems: 1,
                  maxItems: 6,
                  items: { type: "string" },
                },
                rows: {
                  type: "array",
                  minItems: 0,
                  maxItems: 7,
                  items: {
                    type: "array",
                    minItems: 1,
                    maxItems: 6,
                    items: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    });

    const slideSchema = objectSchema(schema.properties.slide_1);
    expect(slideSchema.properties.text_1.description).toContain(
      "Current value: Launch Plan",
    );
    expect(slideSchema.properties.image_1.description).toContain(
      "Current value: Hero image",
    );
    expect(slideSchema.properties.table_1.description).toContain(
      "columns: Metric | Value; rows: Revenue | $10M",
    );

    const serialized = JSON.stringify(schema);
    expect(serialized).not.toContain("position");
    expect(serialized).not.toContain("size");
    expect(serialized).not.toContain("font");
    expect(serialized).not.toContain("fill");
    expect(serialized).not.toContain("data:image");
    expect(serialized).not.toContain("abc123");
  });

  it("flattens semantic wrappers without preserving wrapper metadata", () => {
    const deck: Deck = {
      title: "Nested Deck",
      slides: [
        {
          background: "FFFFFF",
          elements: [
            {
              type: "group",
              position: { x: 1, y: 1 },
              size: { width: 8, height: 3 },
              children: [
                {
                  type: "text-list",
                  marker: "bullet",
                  items: [
                    { type: "text", text: "First point" },
                    { type: "text", text: "Second point" },
                  ],
                },
                {
                  type: "chart",
                  chartType: "bar",
                  title: "Pipeline",
                  data: [
                    { label: "Open", value: 42, color: "D6FF3F" },
                    { label: "Won", value: 18, color: "171717" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const schema = generateSlideContentJsonSchema(deck.slides[0]!, 0);

    expect(schema.required).toEqual(["list_1", "chart_1"]);
    expect(schema.properties.list_1).toMatchObject({
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: { type: "string" },
    });
    expect(schema.properties.chart_1).toMatchObject({
      type: "object",
      additionalProperties: false,
      default: {
        chartType: "bar",
        title: "Pipeline",
        data: [
          { label: "Open", value: 42 },
          { label: "Won", value: 18 },
        ],
      },
      examples: [
        {
          chartType: "bar",
          title: "Pipeline",
          data: [
            { label: "Open", value: 42 },
            { label: "Won", value: 18 },
          ],
        },
      ],
      required: ["chartType", "title", "data"],
      properties: {
        chartType: {
          type: "string",
          enum: ["bar", "line", "donut"],
          default: "bar",
          examples: ["bar"],
        },
        title: { type: "string", default: "Pipeline", examples: ["Pipeline"] },
        data: {
          type: "array",
          default: [
            { label: "Open", value: 42 },
            { label: "Won", value: 18 },
          ],
          minItems: 1,
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "value"],
          },
        },
      },
    });

    const serialized = JSON.stringify(schema);
    expect(serialized).not.toContain("position");
    expect(serialized).not.toContain("D6FF3F");
    expect(serialized).not.toContain("171717");
  });
});

function objectSchema(value: unknown): JsonSchemaObject {
  expect(value).toMatchObject({ type: "object" });
  return value as JsonSchemaObject;
}
