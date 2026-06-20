import { describe, expect, it } from "vitest";
import {
  tableRowsAsStrings,
  textContent,
  textListStrings,
} from "./element-model";
import { applyDeckContentJson, applySlideContentJson } from "./slide-content-apply";
import { generateSlideContentJsonSchema } from "./slide-content-schema";
import type { Deck, Slide, SlideElement } from "./slide-schema";
import { SlideSchema } from "./slide-schema";

describe("slide content application", () => {
  it("fills slide content slots while preserving layout and design fields", () => {
    const slide = contentFixtureSlide();
    const schema = generateSlideContentJsonSchema(slide, 0);

    expect(schema.required).toEqual([
      "text_1",
      "image_1",
      "table_1",
      "list_1",
      "chart_1",
    ]);

    const next = applySlideContentJson(slide, {
      text_1: "Updated executive headline",
      image_1: "Dashboard screenshot showing channel ROI",
      table_1: {
        columns: ["Metric", "Q2", "Q3"],
        rows: [
          ["Spend", "$210k", "$248k"],
          ["Leads", "8,400", "10,680"],
        ],
      },
      list_1: ["Scale lifecycle email", "Reduce form friction"],
      chart_1: {
        chartType: "line",
        title: "Channel ROI Trend",
        data: [
          { label: "Email", value: 42 },
          { label: "Search", value: 31 },
        ],
      },
    });

    expect(() => SlideSchema.parse(next)).not.toThrow();
    expect(next.background).toBe(slide.background);
    expect(next.elements[0]).toEqual(slide.elements[0]);

    const text = elementAs(next.elements[1], "text");
    const originalText = elementAs(slide.elements[1], "text");
    expect(textContent(text)).toBe("Updated executive headline");
    expect(text.position).toEqual(originalText.position);
    expect(text.size).toEqual(originalText.size);
    expect(text.fill).toEqual(originalText.fill);
    expect(text.runs[0]?.font).toEqual(originalText.runs[0]?.font);

    const image = elementAs(next.elements[2], "image");
    const originalImage = elementAs(slide.elements[2], "image");
    expect(image.name).toBe("Dashboard screenshot showing channel ROI");
    expect(image.data).toBe(originalImage.data);
    expect(image.position).toEqual(originalImage.position);
    expect(image.fit).toBe(originalImage.fit);

    const table = elementAs(next.elements[3], "table");
    const originalTable = elementAs(slide.elements[3], "table");
    expect(tableRowsAsStrings(table)).toEqual([
      ["Metric", "Q2", "Q3"],
      ["Spend", "$210k", "$248k"],
      ["Leads", "8,400", "10,680"],
    ]);
    expect(table.columns[0]?.fill).toEqual(originalTable.columns[0]?.fill);
    expect(table.columns[0]?.font).toEqual(originalTable.columns[0]?.font);
    expect(table.rows[0]?.[0]?.fill).toEqual(originalTable.rows[0]?.[0]?.fill);
    expect(table.position).toEqual(originalTable.position);

    const group = elementAs(next.elements[4], "group");
    const originalGroup = elementAs(slide.elements[4], "group");
    expect(group.position).toEqual(originalGroup.position);
    expect(group.size).toEqual(originalGroup.size);

    const list = elementAs(group.children[0], "text-list");
    const originalList = elementAs(originalGroup.children[0], "text-list");
    expect(textListStrings(list)).toEqual([
      "Scale lifecycle email",
      "Reduce form friction",
    ]);
    expect(list.font).toEqual(originalList.font);
    expect(list.marker).toBe(originalList.marker);

    const chart = elementAs(group.children[1], "chart");
    const originalChart = elementAs(originalGroup.children[1], "chart");
    expect(chart).toMatchObject({
      axisColor: originalChart.axisColor,
      chartType: "line",
      color: originalChart.color,
      labelColor: originalChart.labelColor,
      title: "Channel ROI Trend",
    });
    expect(chart.data).toEqual([
      { label: "Email", value: 42, color: originalChart.data[0]?.color },
      { label: "Search", value: 31, color: originalChart.data[1]?.color },
    ]);
  });

  it("applies deck content by slide key or by slide array index", () => {
    const deck: Deck = {
      title: "Deck",
      slides: [
        textOnlySlide("Slide one"),
        textOnlySlide("Slide two"),
        textOnlySlide("Slide three"),
      ],
    };

    const keyed = applyDeckContentJson(deck, {
      slide_2: { text_1: "Updated second slide" },
    });
    expect(textFromSlide(keyed.slides[0]!)).toBe("Slide one");
    expect(textFromSlide(keyed.slides[1]!)).toBe("Updated second slide");
    expect(textFromSlide(keyed.slides[2]!)).toBe("Slide three");

    const indexed = applyDeckContentJson(deck, [
      { text_1: "Updated first slide" },
      undefined,
      { text_1: "Updated third slide" },
    ]);
    expect(textFromSlide(indexed.slides[0]!)).toBe("Updated first slide");
    expect(textFromSlide(indexed.slides[1]!)).toBe("Slide two");
    expect(textFromSlide(indexed.slides[2]!)).toBe("Updated third slide");
  });

  it("keeps table output schema-valid when content has headers and no body rows", () => {
    const slide = contentFixtureSlide();

    const next = applySlideContentJson(slide, {
      table_1: {
        columns: ["Metric", "Value"],
        rows: [],
      },
    });

    expect(() => SlideSchema.parse(next)).not.toThrow();
    expect(tableRowsAsStrings(elementAs(next.elements[3], "table"))).toEqual([
      ["Metric", "Value"],
      ["", ""],
    ]);
  });

  it("throws a keyed error for malformed slot content", () => {
    const slide = contentFixtureSlide();

    expect(() =>
      applySlideContentJson(slide, {
        table_1: {
          columns: [],
          rows: [],
        },
      }),
    ).toThrow("Invalid content for table_1");
  });
});

function contentFixtureSlide(): Slide {
  return {
    background: "FFFFFF",
    title: "Executive Summary",
    elements: [
      {
        type: "rectangle",
        position: { x: 0, y: 0 },
        size: { width: 10, height: 5.625 },
        fill: { color: "F4F1E8" },
      },
      {
        type: "text",
        position: { x: 0.7, y: 0.5 },
        size: { width: 5.2, height: 0.6 },
        fill: { color: "FFFFFF" },
        runs: [
          {
            text: "Executive",
            font: { family: "Inter", size: 32, color: "0A2A18", bold: true },
          },
          {
            text: " Summary",
            font: { family: "Inter", size: 32, color: "0A2A18" },
          },
        ],
      },
      {
        type: "image",
        position: { x: 6.7, y: 0.5 },
        size: { width: 2, height: 1.4 },
        data: "data:image/png;base64,abc123",
        fit: "cover",
        name: "Picture 1",
      },
      {
        type: "table",
        position: { x: 0.7, y: 1.5 },
        size: { width: 5.1, height: 1.8 },
        font: { family: "Inter", size: 10, color: "0A2A18" },
        columns: [
          {
            text: "Metric",
            fill: { color: "0A2A18" },
            font: { color: "FFFFFF", bold: true },
            stroke: { color: "D8D2C0", width: 1 },
          },
          {
            text: "Value",
            fill: { color: "0A2A18" },
            font: { color: "FFFFFF", bold: true },
            stroke: { color: "D8D2C0", width: 1 },
          },
        ],
        rows: [
          [
            {
              text: "Spend",
              fill: { color: "FFFFFF" },
              stroke: { color: "D8D2C0", width: 1 },
            },
            {
              text: "$210k",
              fill: { color: "FFFFFF" },
              stroke: { color: "D8D2C0", width: 1 },
            },
          ],
        ],
      },
      {
        type: "group",
        position: { x: 0.7, y: 3.5 },
        size: { width: 8.6, height: 1.5 },
        children: [
          {
            type: "text-list",
            marker: "bullet",
            font: { family: "Inter", size: 14, color: "0A2A18" },
            items: [
              { type: "text", text: "Scale email" },
              { type: "text", text: "Optimize landing pages" },
            ],
          },
          {
            type: "chart",
            chartType: "bar",
            title: "ROI",
            color: "E5A832",
            axisColor: "0A2A18",
            labelColor: "0A2A18",
            data: [
              { label: "Email", value: 32, color: "4D8B31" },
              { label: "Search", value: 27, color: "2F64C8" },
            ],
          },
        ],
      },
    ],
  };
}

function textOnlySlide(text: string): Slide {
  return {
    background: "FFFFFF",
    elements: [
      {
        type: "text",
        runs: [{ text, font: { family: "Inter", size: 24, color: "111111" } }],
      },
    ],
  };
}

function textFromSlide(slide: Slide) {
  return textContent(elementAs(slide.elements[0], "text"));
}

function elementAs<T extends SlideElement["type"]>(
  element: SlideElement | undefined,
  type: T,
): Extract<SlideElement, { type: T }> {
  expect(element?.type).toBe(type);
  return element as Extract<SlideElement, { type: T }>;
}
