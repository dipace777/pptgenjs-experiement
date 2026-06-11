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
                "Optimize for design intent and editor usefulness, not raw element repetition.",
                "Keep blocks a user would intentionally insert and edit: author pills, navigation pills, title lockups, metric cards, stat cards, charts, tables, media cards, insight grids, feature lists, icon-label systems, CTA buttons, strong badges, distinctive dividers, and polished framed content blocks.",
                "Prefer candidates with clear editableSlots, high qualityScore, concrete qualitySignals, and a specific intentHint.",
                "Drop full-slide backgrounds, plain one-off photos, isolated text, isolated decorative shapes, tiny fragments, repeated noise, candidates with severe qualityIssues, redundant variants, and anything unlikely to be reused by an editor user.",
                "Prefer fewer, higher-quality reusable components over many near-duplicates. A deck with 8 excellent components is better than 24 mediocre ones.",
                "Use exact clusterId values from the input and exact representativeCandidateId values when provided.",
                "For kept items, set intent to the candidate intentHint unless a more precise allowed intent clearly fits.",
                "For kept items, set structure to container, flex, grid, or group. Prefer container when a clear card/frame/background shell owns the block, flex for simple row/column systems, grid for clear repeated rows and columns, and group for exact freeform compositions.",
              ].join(" "),
            ],
            messages: [
              {
                role: "user",
                content: [
                  "Curate this imported deck's reusable design elements.",
                  "Return at most 18 keep decisions. Drop the rest explicitly only when useful.",
                  "Keep labels concise, noun-like, and intentful, for example: Author Pill, Navigation Pill, Insight Grid, Feature List, Metric Card, Chart, Table, Title Lockup, Media Card.",
                  "Use each cluster's recommendedStructure unless another structure is clearly better.",
                  "If qualityScore is below 50, keep it only when qualitySignals and editableSlots show a clearly reusable design intent.",
                  "Descriptions should explain what this block is for, not where it came from.",
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
