import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const SvgPromptInputSchema = z.object({
  prompt: z.string().min(3).max(800),
});

const SvgGenerationOutputSchema = z.object({
  name: z.string().min(1).max(120),
  svg: z.string().min(20).max(20_000),
});

export const generateSvgWithAi = createServerFn({ method: "POST" })
  .inputValidator((data: z.infer<typeof SvgPromptInputSchema>) =>
    SvgPromptInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const [{ chat }, { openaiText }] = await Promise.all([
      import("@tanstack/ai"),
      import("@tanstack/ai-openai"),
    ]);
    const adapter = openaiText(
      (process.env.OPENAI_MODEL ?? "gpt-4.1-mini") as Parameters<typeof openaiText>[0],
    );

    const result = await chat({
      adapter,
      outputSchema: SvgGenerationOutputSchema,
      systemPrompts: [
        [
          "You generate compact inline SVG artwork for presentation slides.",
          "Return structured data only.",
          "The svg field must contain a single complete <svg>...</svg> string.",
          "Do not use markdown, scripts, foreignObject, external images, external fonts, animation, or event handlers.",
          "Use viewBox coordinates, inline shapes, paths, gradients, masks, and text only.",
          "Keep the SVG coherent, modern, presentation-friendly, and under 20,000 characters.",
        ].join(" "),
      ],
      messages: [
        {
          role: "user",
          content: [
            `Prompt: ${data.prompt}`,
            "Create an expressive but readable SVG visual that can sit on a slide.",
            "Prefer a 16:10 or 16:9 viewBox such as 800x500.",
          ].join("\n"),
        },
      ],
    });

    return {
      name: result.name,
      svg: sanitizeSvg(result.svg),
      source: "ai" as const,
    };
  });

function sanitizeSvg(svg: string): string {
  const trimmed = svg
    .replace(/```(?:svg)?/gi, "")
    .replace(/```/g, "")
    .replace(/<\?xml[^>]*>/gi, "")
    .trim();
  const match = trimmed.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) throw new Error("AI response did not include valid SVG markup.");
  const cleaned = match[0]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/\s(?:href|xlink:href)\s*=\s*(?:"https?:\/\/[^"]*"|'https?:\/\/[^']*')/gi, "");
  if (!/^<svg[\s>]/i.test(cleaned)) {
    throw new Error("AI response did not include valid SVG markup.");
  }
  return cleaned;
}
