import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { createDesignElementExtraction } from "./design-element-extraction";
import { importPptxFile } from "./pptx-import-v2";

describe("PPTX import v2", () => {
  it("imports native PowerPoint charts as editable chart elements and design candidates", async () => {
    const pptx = await pptxBlobWithChart();

    const { deck, warnings } = await importPptxFile(pptx, {
      preferSidecar: false,
    });

    expect(warnings).not.toEqual(
      expect.arrayContaining([expect.stringContaining("graphic frames")]),
    );
    const chart = deck.slides[0]?.elements.find(
      (element) => element.type === "chart",
    );
    expect(chart).toMatchObject({
      type: "chart",
      chartType: "bar",
      title: "Revenue",
      color: "8B5CF6",
      data: [
        { label: "Q1", value: 10 },
        { label: "Q2", value: 20 },
        { label: "Q3", value: 30 },
      ],
    });

    const extraction = createDesignElementExtraction(deck);
    const chartCandidate = extraction.candidates.find(
      (candidate) =>
        candidate.source === "data" && candidate.categoryHint === "chart",
    );

    expect(chartCandidate).toMatchObject({
      intentHint: "chart",
      label: "Chart: Revenue",
    });
    expect(chartCandidate?.slots).toEqual([
      expect.objectContaining({
        kind: "chart",
        text: expect.stringContaining("Q2 20"),
      }),
    ]);
  });

  it("imports native PowerPoint tables as editable table elements and design candidates", async () => {
    const pptx = await pptxBlobWithTable();

    const { deck, warnings } = await importPptxFile(pptx, {
      preferSidecar: false,
    });

    expect(warnings).not.toEqual(
      expect.arrayContaining([expect.stringContaining("graphic frames")]),
    );
    const table = deck.slides[0]?.elements.find(
      (element) => element.type === "table",
    );
    expect(table).toMatchObject({
      type: "table",
      columns: [
        expect.objectContaining({ text: "Location" }),
        expect.objectContaining({ text: "Address" }),
      ],
      rows: [
        [
          expect.objectContaining({ text: "Woodlawn Rd" }),
          expect.objectContaining({ text: "1800 E Woodlawn Rd" }),
        ],
        [
          expect.objectContaining({ text: "University City" }),
          expect.objectContaining({
            text: "8661 Jw Clay Blvd, Charlotte, NC 28262",
          }),
        ],
      ],
    });

    const extraction = createDesignElementExtraction(deck);
    const tableCandidate = extraction.candidates.find(
      (candidate) =>
        candidate.source === "data" && candidate.categoryHint === "table",
    );

    expect(tableCandidate).toMatchObject({
      intentHint: "table",
      label: "Table: Location / Address",
    });
    expect(tableCandidate?.slots).toEqual([
      expect.objectContaining({
        kind: "table",
        text: expect.stringContaining("Woodlawn Rd"),
      }),
    ]);
  });
});

async function pptxBlobWithChart(): Promise<Blob> {
  const zip = new JSZip();
  addPresentationShell(zip);
  zip.file(
    "ppt/slides/_rels/slide1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart"
    Target="../charts/chart1.xml"/>
</Relationships>`,
  );
  zip.file(
    "ppt/slides/slide1.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:graphicFrame>
        <p:nvGraphicFramePr>
          <p:cNvPr id="2" name="Revenue chart"/>
          <p:cNvGraphicFramePr/>
          <p:nvPr/>
        </p:nvGraphicFramePr>
        <p:xfrm>
          <a:off x="914400" y="914400"/>
          <a:ext cx="5486400" cy="2743200"/>
        </p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
            <c:chart r:id="rId2"/>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>
    </p:spTree>
  </p:cSld>
</p:sld>`,
  );
  zip.file(
    "ppt/charts/chart1.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title>
      <c:tx>
        <c:rich>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p><a:r><a:t>Revenue</a:t></a:r></a:p>
        </c:rich>
      </c:tx>
    </c:title>
    <c:plotArea>
      <c:barChart>
        <c:barDir val="col"/>
        <c:ser>
          <c:idx val="0"/>
          <c:order val="0"/>
          <c:spPr><a:solidFill><a:srgbClr val="8B5CF6"/></a:solidFill></c:spPr>
          <c:cat>
            <c:strRef>
              <c:strCache>
                <c:ptCount val="3"/>
                <c:pt idx="0"><c:v>Q1</c:v></c:pt>
                <c:pt idx="1"><c:v>Q2</c:v></c:pt>
                <c:pt idx="2"><c:v>Q3</c:v></c:pt>
              </c:strCache>
            </c:strRef>
          </c:cat>
          <c:val>
            <c:numRef>
              <c:numCache>
                <c:formatCode>General</c:formatCode>
                <c:ptCount val="3"/>
                <c:pt idx="0"><c:v>10</c:v></c:pt>
                <c:pt idx="1"><c:v>20</c:v></c:pt>
                <c:pt idx="2"><c:v>30</c:v></c:pt>
              </c:numCache>
            </c:numRef>
          </c:val>
        </c:ser>
      </c:barChart>
    </c:plotArea>
  </c:chart>
</c:chartSpace>`,
  );

  const buffer = await zip.generateAsync({ type: "arraybuffer" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

async function pptxBlobWithTable(): Promise<Blob> {
  const zip = new JSZip();
  addPresentationShell(zip);
  zip.file(
    "ppt/slides/slide1.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:graphicFrame>
        <p:nvGraphicFramePr>
          <p:cNvPr id="2" name="Location table"/>
          <p:cNvGraphicFramePr/>
          <p:nvPr/>
        </p:nvGraphicFramePr>
        <p:xfrm>
          <a:off x="914400" y="914400"/>
          <a:ext cx="9144000" cy="2743200"/>
        </p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
            <a:tbl>
              <a:tblPr firstRow="1" bandRow="1"/>
              <a:tblGrid>
                <a:gridCol w="4572000"/>
                <a:gridCol w="4572000"/>
              </a:tblGrid>
              ${tableRow(["Location", "Address"], true)}
              ${tableRow(["Woodlawn Rd", "1800 E Woodlawn Rd"])}
              ${tableRow(["University City", "8661 Jw Clay Blvd, Charlotte, NC 28262"])}
            </a:tbl>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>
    </p:spTree>
  </p:cSld>
</p:sld>`,
  );

  const buffer = await zip.generateAsync({ type: "arraybuffer" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

function addPresentationShell(zip: JSZip): void {
  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
</p:presentation>`,
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
    Target="slides/slide1.xml"/>
</Relationships>`,
  );
}

function tableRow(values: string[], header = false): string {
  return `<a:tr h="914400">${values
    .map((value) => tableCell(value, header))
    .join("")}</a:tr>`;
}

function tableCell(value: string, header: boolean): string {
  const bold = header ? ' b="1"' : "";
  return `<a:tc>
  <a:txBody>
    <a:bodyPr/>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="${header ? "ctr" : "l"}">
        <a:defRPr sz="2400"${bold}>
          <a:solidFill><a:srgbClr val="111827"/></a:solidFill>
          <a:latin typeface="Aptos"/>
        </a:defRPr>
      </a:pPr>
      <a:r>
        <a:rPr sz="2400"${bold}>
          <a:solidFill><a:srgbClr val="111827"/></a:solidFill>
          <a:latin typeface="Aptos"/>
        </a:rPr>
        <a:t>${escapeXml(value)}</a:t>
      </a:r>
    </a:p>
  </a:txBody>
  <a:tcPr>
    <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
    <a:lnL w="6350"><a:solidFill><a:srgbClr val="E5E7EB"/></a:solidFill></a:lnL>
    <a:lnR w="6350"><a:solidFill><a:srgbClr val="E5E7EB"/></a:solidFill></a:lnR>
    <a:lnT w="6350"><a:solidFill><a:srgbClr val="E5E7EB"/></a:solidFill></a:lnT>
    <a:lnB w="6350"><a:solidFill><a:srgbClr val="E5E7EB"/></a:solidFill></a:lnB>
  </a:tcPr>
</a:tc>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
