import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSetAtom } from "jotai";
import { generateSvgWithAi } from "../../../lib/svg-ai";
import { generateSvgFromPrompt } from "../../../lib/svg-generator";
import { sanitizeSvgMarkup } from "../../../lib/svg-sanitize";
import { insertElementAtom } from "../state";

export function useSvgGeneration() {
  const insertElement = useSetAtom(insertElementAtom);
  const generateSvgWithAiFn = useServerFn(generateSvgWithAi);
  const [svgPrompt, setSvgPrompt] = useState(
    "A connected system map with glowing nodes and one central hub",
  );
  const [isGeneratingSvg, setIsGeneratingSvg] = useState(false);
  const [svgGenerationStatus, setSvgGenerationStatus] = useState<string | null>(
    null,
  );

  const generatePromptSvg = useCallback(async () => {
    const prompt = svgPrompt.trim();
    if (!prompt) return;
    setIsGeneratingSvg(true);
    setSvgGenerationStatus("Generating with OpenAI...");
    try {
      const result = await generateSvgWithAiFn({ data: { prompt } });
      insertElement({
        kind: "svg",
        x: 2.7,
        y: 1.6,
        w: 4.6,
        h: 2.9,
        name: result.name,
        svg: sanitizeSvgMarkup(result.svg),
      });
      setSvgGenerationStatus("Generated with OpenAI.");
    } catch (error) {
      insertElement({
        kind: "svg",
        x: 2.7,
        y: 1.6,
        w: 4.6,
        h: 2.9,
        name: prompt.slice(0, 120),
        svg: sanitizeSvgMarkup(generateSvgFromPrompt(prompt)),
      });
      setSvgGenerationStatus(
        error instanceof Error
          ? `OpenAI failed; inserted local fallback. ${error.message}`
          : "OpenAI failed; inserted local fallback.",
      );
    } finally {
      setIsGeneratingSvg(false);
    }
  }, [generateSvgWithAiFn, insertElement, svgPrompt]);

  return {
    svgPrompt,
    setSvgPrompt,
    isGeneratingSvg,
    svgGenerationStatus,
    generatePromptSvg,
  };
}
