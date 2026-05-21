import type Konva from "konva";
import PptxGenJS from "pptxgenjs";
import { useRef, useState } from "react";
import { SLIDE_H, SLIDE_W, type Deck } from "../../../lib/slide-schema";
import { generatePptx } from "../../../slide/generatePptx";
import { filenameFromTitle } from "../editorUtils";

export type ExportMode = "native" | "raster";

export function useDeckExport(deck: Deck) {
  const [exportMode, setExportMode] = useState<ExportMode>("native");
  const [isExporting, setIsExporting] = useState(false);
  const exportStageRefs = useRef<Array<Konva.Stage | null>>([]);

  const handleNativeExport = async () => {
    await generatePptx(deck, filenameFromTitle(deck.title));
  };

  const handleRasterExport = async () => {
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "KONVA_16X9", width: SLIDE_W, height: SLIDE_H });
    pptx.layout = "KONVA_16X9";
    pptx.author = "ppty";
    pptx.subject = "Rasterized Konva deck";
    pptx.title = deck.title;

    for (let i = 0; i < deck.slides.length; i += 1) {
      const data = exportStageRefs.current[i]?.toDataURL({
        pixelRatio: 1,
        mimeType: "image/png",
      });
      const slide = pptx.addSlide();
      if (data) {
        slide.addImage({ data, x: 0, y: 0, w: SLIDE_W, h: SLIDE_H });
      }
    }

    await pptx.writeFile({ fileName: filenameFromTitle(deck.title, "-raster") });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportMode === "native") {
        await handleNativeExport();
      } else {
        await handleRasterExport();
      }
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportMode,
    setExportMode,
    isExporting,
    exportStageRefs,
    handleExport,
  };
}
