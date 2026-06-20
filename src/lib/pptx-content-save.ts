import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DeckSchema } from "./slide-schema";

const DEFAULT_SQLITE_PATH = "ppty.sqlite";
const RAW_PPTX_TABLE_NAME = "pptx_raw_pptx_saves";
const SLIDE_SCHEMA_TABLE_NAME = "pptx_slide_content_schemas";

export const SavePptxContentInputSchema = z
  .object({
    rawPptxJson: DeckSchema,
    slideJsonSchemas: z.array(z.unknown()),
  })
  .strict();

export type SavePptxContentInput = z.infer<
  typeof SavePptxContentInputSchema
>;

export type SavePptxContentResult = {
  dbPath: string;
  deckTitle: string;
  id: number;
  schemaRowCount: number;
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
  rawPptxJson,
  slideJsonSchemas,
}: SavePptxContentInput): Promise<SavePptxContentResult> {
  if (slideJsonSchemas.length !== rawPptxJson.slides.length) {
    throw new Error(
      `Expected ${rawPptxJson.slides.length} slide schemas, received ${slideJsonSchemas.length}.`,
    );
  }

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
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${RAW_PPTX_TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deck_title TEXT NOT NULL,
        slide_count INTEGER NOT NULL,
        raw_pptx_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ${SLIDE_SCHEMA_TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_pptx_save_id INTEGER NOT NULL,
        slide_number INTEGER NOT NULL,
        slide_title TEXT,
        json_schema TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (raw_pptx_save_id)
          REFERENCES ${RAW_PPTX_TABLE_NAME}(id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_${SLIDE_SCHEMA_TABLE_NAME}_save_id
        ON ${SLIDE_SCHEMA_TABLE_NAME} (raw_pptx_save_id);
    `);

    const createdAt = new Date().toISOString();
    db.exec("BEGIN;");
    try {
      db.prepare(`
        INSERT INTO ${RAW_PPTX_TABLE_NAME} (
          deck_title,
          slide_count,
          raw_pptx_json,
          created_at
        ) VALUES (?, ?, ?, ?);
      `).run(
        rawPptxJson.title,
        rawPptxJson.slides.length,
        JSON.stringify(rawPptxJson),
        createdAt,
      );

      const row = db.prepare("SELECT last_insert_rowid() AS id;").get() as
        | { id: number | bigint }
        | undefined;
      const id = Number(row?.id ?? 0);

      const insertSlideSchema = db.prepare(`
        INSERT INTO ${SLIDE_SCHEMA_TABLE_NAME} (
          raw_pptx_save_id,
          slide_number,
          slide_title,
          json_schema,
          created_at
        ) VALUES (?, ?, ?, ?, ?);
      `);

      slideJsonSchemas.forEach((slideJsonSchema, index) => {
        insertSlideSchema.run(
          id,
          index + 1,
          rawPptxJson.slides[index]?.title ?? null,
          JSON.stringify(slideJsonSchema),
          createdAt,
        );
      });

      db.exec("COMMIT;");

      return {
        dbPath,
        deckTitle: rawPptxJson.title,
        id,
        schemaRowCount: slideJsonSchemas.length,
        slideCount: rawPptxJson.slides.length,
      };
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
  } finally {
    db.close();
  }
}
