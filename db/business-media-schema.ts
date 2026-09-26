import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const pendingBusinessMedia = sqliteTable("pending_business_media", {
  userId: text("user_id").primaryKey(),
  imageData: text("image_data").notNull(),
  contentType: text("content_type").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const businessMedia = sqliteTable("business_media", {
  tenantId: text("tenant_id").primaryKey(),
  imageData: text("image_data").notNull(),
  contentType: text("content_type").notNull(),
  updatedAt: text("updated_at").notNull(),
});
