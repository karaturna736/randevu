import {
  sqliteTable,
  text,
  primaryKey,
  index,
  foreignKey,
} from "drizzle-orm/sqlite-core";
import { businesses, customers, profiles } from "./schema";

export const customerMemberships = sqliteTable(
  "customer_memberships",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => businesses.id),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.userId),
    customerId: text("customer_id").notNull(),
    joinedAt: text("joined_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.userId] }),
    index("customer_memberships_user").on(t.userId, t.joinedAt),
    index("customer_memberships_business").on(t.tenantId, t.joinedAt),
    foreignKey({
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
  ],
);
