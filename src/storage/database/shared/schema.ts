import { pgTable, serial, timestamp, varchar, integer, text, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const galleryImages = pgTable(
  "gallery_images",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    prompt: text("prompt").notNull(),
    url: text("url").notNull(),
    imageKey: varchar("image_key", { length: 500 }),
    width: integer("width").default(3),
    height: integer("height").default(4),
    views: integer("views").default(0).notNull(),
    downloads: integer("downloads").default(0).notNull(),
    model: varchar("model", { length: 100 }),
    ratio: varchar("ratio", { length: 20 }),
    taskId: varchar("task_id", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("gallery_images_created_at_idx").on(table.createdAt),
    index("gallery_images_views_idx").on(table.views),
    index("gallery_images_downloads_idx").on(table.downloads),
  ]
);
