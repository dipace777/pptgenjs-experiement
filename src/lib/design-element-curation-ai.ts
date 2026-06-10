import { createServerFn } from "@tanstack/react-start";
import {
  DesignElementCurationInputSchema,
  DesignElementCurationModelOutputSchema,
  type DesignElementCurationOutput,
} from "./design-element-extraction";

const DESIGN_ELEMENT_CURATION_TIMEOUT_MS = 15_000;

export const curateDesignElementsWithAi = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => DesignElementCurationInputSchema.parse(data))
  .handler(async ({ data }): Promise<DesignElementCurationOutput> => {
    if (data.clusters.length === 0) {
      return { decisions: [], source: "empty" };
    }
    if (process.env.DESIGN_ELEMENT_AI === "0") {
      return {
        decisions: [],
        source: "disabled",
        message: "DESIGN_ELEMENT_AI=0",
      };
    }

    try {
      const [{ chat }, { openaiText }] = await Promise.all([
        import("@tanstack/ai"),
        import("@tanstack/ai-openai"),
      ]);
      const adapter = openaiText(
        (process.env.DESIGN_ELEMENT_MODEL ??
          process.env.OPENAI_MODEL ??
          "gpt-4.1-mini") as Parameters<typeof openaiText>[0],
      );

      const abortController = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        abortController.abort();
      }, DESIGN_ELEMENT_CURATION_TIMEOUT_MS);

      const result = await (async () => {
        try {
          return await chat({
            adapter,
            outputSchema: DesignElementCurationModelOutputSchema,
            abortController,
            systemPrompts: [
              [
                "You curate reusable presentation design elements from deterministic extraction candidates.",
                "You do not invent geometry, elements, IDs, or coordinates.",
                "Return keep/drop decisions for candidate clusters only.",
                "Keep reusable design language: navigation pills, badges, CTA buttons, title lockups, stat cards, media cards, icon-label systems, dividers, and distinctive framed assets.",
                "Drop full-slide backgrounds, plain one-off photos, tiny fragments when a richer group exists, redundant variants, and anything unlikely to be inserted by an editor user.",
                "Prefer fewer, higher-quality reusable components over many near-duplicates.",
                "Use exact clusterId values from the input and exact representativeCandidateId values when provided.",
                "For kept items, set structure to container, flex, grid, or group. Prefer container when a clear card/frame/background shell owns the block, flex for simple row/column systems, grid for clear repeated rows and columns, and group for exact freeform compositions.",
              ].join(" "),
            ],
            messages: [
              {
                role: "user",
                content: [
                  "Curate this imported deck's reusable design elements.",
                  "Return at most 24 keep decisions. Drop the rest explicitly only when useful.",
                  "Keep labels concise and noun-like, for example: Navigation Pill, Product Badge, Title Lockup, Stat Card, Media Frame.",
                  "Use each cluster's recommendedStructure unless another structure is clearly better.",
                  "Input JSON:",
                  JSON.stringify(data),
                ].join("\n"),
              },
            ],
          });
        } catch (error) {
          if (timedOut) {
            throw new Error(
              `Design element curation timed out after ${
                DESIGN_ELEMENT_CURATION_TIMEOUT_MS / 1000
              } seconds`,
              { cause: error },
            );
          }
          throw error;
        } finally {
          clearTimeout(timeout);
        }
      })();

      return { ...result, source: "ai" };
    } catch (error) {
      return {
        decisions: [],
        source: "fallback",
        message:
          error instanceof Error
            ? error.message
            : "AI design element curation failed",
      };
    }
  });
