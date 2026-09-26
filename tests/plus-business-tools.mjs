import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
const [entitlements, plus, route, management, bookingForm, migration] = await Promise.all([
  read("lib/entitlements.ts"),
  read("lib/plus-business-tools.ts"),
  read("app/api/v1/[...path]/route.ts"),
  read("app/api/management/v1/[...path]/route.ts"),
  read("components/product/booking-form.tsx"),
  read("drizzle/0014_plus_business_tools.sql"),
]);

assert.match(entitlements, /website:\s*true/);
assert.match(entitlements, /managementApi:\s*true/);
assert.match(entitlements, /branchAutomation:\s*true/);
assert.match(plus, /neta_live_/);
assert.match(plus, /branchOverflowAlternatives/);
assert.match(plus, /requirePlanModule\(tenantId, "managementApi"\)/);
assert.match(route, /p\[0\] === "plus-tools"/);
assert.match(route, /publicWebsite\(b\.id\)/);
assert.match(management, /managementApiPost/);
assert.match(bookingForm, /branchAlternatives/);
assert.match(migration, /CREATE TABLE `website_settings`/);
assert.match(migration, /CREATE TABLE `api_keys`/);
assert.match(migration, /CREATE TABLE `branch_automations`/);

console.log("Plus business tools integrity: OK");
