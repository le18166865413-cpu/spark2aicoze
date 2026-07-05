import { pgTable, serial, timestamp, varchar, integer, text, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const adminSettings = pgTable("admin_settings", {
  key: varchar("key", { length: 200 }).primaryKey(),
  value: text("value").notNull(),
  category: varchar("category", { length: 50 }).default("general").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const adminSessions = pgTable("admin_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  username: varchar("username", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// Brand Kit 素材表
export const brandKit = pgTable("brand_kit", {
  id: serial().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(), // 关联用户
  name: varchar("name", { length: 200 }).notNull(), // 素材名称
  type: varchar("type", { length: 20 }).notNull(), // 素材类型：image / text
  content: text("content"), // 文字内容（仅文字素材）
  imageKey: text("image_key"), // 图片存储key（仅图片素材）
  imageUrl: text("image_url"), // 图片URL（仅图片素材）
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index().on(table.userId),
  typeIdx: index().on(table.type),
}));
