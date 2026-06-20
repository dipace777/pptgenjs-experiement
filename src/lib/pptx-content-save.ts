import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DeckSchema } from "./slide-schema";

const DEFAULT_SQLITE_PATH = "ppty.sqlite";
const SAVE_TABLE_NAME = "pptx_content_saves";

export const SavePptxContentInputSchema = z
  .object({
    jsonSchema: z.unknown(),
    rawPptxJson: DeckSchema,
  })
  .strict();

export type SavePptxContentInput = z.infer<
  typeof SavePptxContentInputSchema
>;

export type SavePptxContentResult = {
  dbPath: string;
  deckTitle: string;
  id: number;
  slideCount: number;
};

export const savePptxContentJsonSchema = createServerFn({ method: "POST" })
  .inputValidator((data: SavePptxContentInput) =>
    SavePptxContentInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<SavePptxContentResult> => {
    return savePptxContentToSqlite(data);
  });

async function savePptxContentToSqlite({
  jsonSchema,
  rawPptxJson,
}: SavePptxContentInput): Promise<SavePptxContentResult> {
  const [{ mkdir }, { dirname, resolve }, { DatabaseSync }] =
    await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
      import("node:sqlite"),
    ]);
  const dbPath = resolve(process.env.PPTY_SQLITE_PATH ?? DEFAULT_SQLITE_PATH);
  await mkdir(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${SAVE_TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deck_title TEXT NOT NULL,
        slide_count INTEGER NOT NULL,
        raw_pptx_json TEXT NOT NULL,
        json_schema TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO ${SAVE_TABLE_NAME} (
        deck_title,
        slide_count,
        raw_pptx_json,
        json_schema,
        created_at
      ) VALUES (?, ?, ?, ?, ?);
    `).run(
      rawPptxJson.title,
      rawPptxJson.slides.length,
      JSON.stringify(rawPptxJson),
      JSON.stringify(jsonSchema),
      createdAt,
    );

    const row = db.prepare("SELECT last_insert_rowid() AS id;").get() as
      | { id: number | bigint }
      | undefined;
    const id = Number(row?.id ?? 0);

    return {
      dbPath,
      deckTitle: rawPptxJson.title,
      id,
      slideCount: rawPptxJson.slides.length,
    };
  } finally {
    db.close();
  }
}
