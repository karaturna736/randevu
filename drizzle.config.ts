import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: ["./db/schema.ts", "./db/customer-membership-schema.ts"],
  dialect: "sqlite",
});
