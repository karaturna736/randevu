import { readFileSync, writeFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}
function write(path, content) {
  writeFileSync(path, content);
  console.log("patched", path);
}
function replaceOnce(content, oldValue, newValue, label) {
  const first = content.indexOf(oldValue);
  if (first < 0) throw new Error(`Missing replacement: ${label}`);
  if (content.indexOf(oldValue, first + oldValue.length) >= 0)
    throw new Error(`Replacement is not unique: ${label}`);
  return content.slice(0, first) + newValue + content.slice(first + oldValue.length);
}
function replaceCount(content, oldValue, newValue, expected, label) {
  const count = content.split(oldValue).length - 1;
  if (count !== expected)
    throw new Error(`Expected ${expected} matches for ${label}, found ${count}`);
  return content.split(oldValue).join(newValue);
}

// 1) Paket matrisi: Kurulum Merkezi yalnız Plus.
{
  const path = "lib/entitlements.ts";
  let s = read(path);
  s = replaceOnce(
    s,
    '      | "referral"\n      | "website",\n',
    '      | "referral"\n      | "website"\n      | "setupCenter",\n',
    "module record setupCenter",
  );
  s = replaceCount(
    s,
    "      website: false,\n",
    "      website: false,\n      setupCenter: false,\n",
    2,
    "normal/pro setupCenter",
  );
  s = replaceOnce(
    s,
    "      website: true,\n",
    "      website: true,\n      setupCenter: true,\n",
    "plus setupCenter",
  );
  s = replaceOnce(
    s,
    '  | "referral"\n  | "website";\n',
    '  | "referral"\n  | "website"\n  | "setupCenter";\n',
    "PlanModule setupCenter",
  );
  s = replaceOnce(
    s,
    '  website: "İşletme web sitesi",\n};\n',
    '  website: "İşletme web sitesi",\n  setupCenter: "Kurulum merkezi, veri taşıma ve eğitim",\n};\n',
    "module label setupCenter",
  );
  write(path, s);
}

// 2) Workspace, istemciye yalnız güvenli paket yetki özetini verir.
{
  const path = "lib/workspace.ts";
  let s = read(path);
  s = replaceOnce(
    s,
    "  return {\n    business: b,\n    businesses,\n",
    "  const plan = await tenantPlan(b.id),\n    planLimits = PLAN_LIMITS[plan];\n  return {\n    business: b,\n    businesses,\n    entitlements: {\n      plan,\n      label: planLimits.label,\n      modules: planLimits.modules,\n      branches: planLimits.branches,\n      staff: planLimits.staff,\n      advancedReports: planLimits.advancedReports,\n      whatsappMonthly: planLimits.whatsappMonthly,\n      aiDaily: planLimits.aiDaily,\n    },\n",
    "workspace entitlements",
  );
  write(path, s);
}

// 3) Kurulum Merkezi API'sini de Plus dışında kapat.
{
  const path = "lib/setup.ts";
  let s = read(path);
  s = replaceOnce(
    s,
    'import { z } from "zod";\n',
    'import { z } from "zod";\nimport { requirePlanModule } from "./entitlements";\n',
    "setup entitlement import",
  );
  s = replaceOnce(
    s,
    "export async function setupSnapshot(id: string) {\n  const b = await tenant(id),\n",
    "export async function setupSnapshot(id: string) {\n  await tenant(id);\n  await requirePlanModule(id, \"setupCenter\");\n  const b = await tenant(id),\n",
    "setupSnapshot guard",
  );
  s = replaceOnce(
    s,
    "export async function importSetup(id: string, input: any) {\n  const b = await tenant(id),\n",
    "export async function importSetup(id: string, input: any) {\n  await tenant(id);\n  await requirePlanModule(id, \"setupCenter\");\n  const b = await tenant(id),\n",
    "importSetup guard",
  );
  s = replaceOnce(
    s,
    "export async function requestTraining(id: string, input: any) {\n  await tenant(id);\n",
    "export async function requestTraining(id: string, input: any) {\n  await tenant(id);\n  await requirePlanModule(id, \"setupCenter\");\n",
    "requestTraining guard",
  );
  write(path, s);
}

// 4) Panel menüsü ve doğrudan ?view= erişimi aktif pakete göre süzülür.
{
  const path = "components/product/dashboard.tsx";
  let s = read(path);
  s = replaceOnce(
    s,
    '  { id: "settings", title: "Ayarlar", icon: SettingsIcon },\n];\nconst TITLES',
    '  { id: "settings", title: "Ayarlar", icon: SettingsIcon },\n];\n\nconst VIEW_MODULES: Record<string, string> = {\n  receivables: "receivables",\n  journeys: "journeys",\n  growth: "growth",\n  recovery: "recovery",\n  demand: "demand",\n  "service-report": "serviceReport",\n  reports: "revenueReport",\n  branches: "branchProfit",\n  whatsapp: "whatsapp",\n  integrations: "whatsapp",\n  "setup-center": "setupCenter",\n};\nfunction planAllowsView(w: any, id: string) {\n  const module = VIEW_MODULES[id];\n  if (!module) return true;\n  if (w?.preview || w?.business?.demo) return true;\n  return !!w?.entitlements?.modules?.[module];\n}\n\nconst TITLES',
    "dashboard plan view matrix",
  );
  s = replaceOnce(
    s,
    "          {NAV.map((n, i) => (\n",
    "          {NAV.filter((n) => planAllowsView(w, n.id)).map((n, i) => (\n",
    "filtered navigation",
  );

  const dashboardStart = s.indexOf("export default function Dashboard");
  if (dashboardStart < 0) throw new Error("Dashboard component not found");
  const before = s.slice(0, dashboardStart);
  let d = s.slice(dashboardStart);
  d = replaceOnce(
    d,
    "  const [title, description] = sectorHeading(view, w);\n  const navTitle = NAV.find((n) => n.id === view)?.title || \"Geri kazanma\";\n",
    "  const activeView = planAllowsView(w, view) ? view : \"overview\";\n  const canUseAssistant =\n    w.preview || w.business?.demo || Number(w.entitlements?.aiDaily || 0) > 0;\n  const [title, description] = sectorHeading(activeView, w);\n  const navTitle =\n    NAV.find((n) => n.id === activeView)?.title || \"Genel bakış\";\n",
    "active dashboard view",
  );
  d = d.split("view={view}").join("view={activeView}");
  d = d.split('view === "').join('activeView === "');
  d = replaceOnce(
    d,
    '              <button\n                className="button assistant-trigger"\n                onClick={() => setAssistant(true)}\n              >\n                <Sparkles size={16} />\n                Randevu asistanı\n              </button>\n',
    '              {canUseAssistant && (\n                <button\n                  className="button assistant-trigger"\n                  onClick={() => setAssistant(true)}\n                >\n                  <Sparkles size={16} />\n                  Randevu asistanı\n                </button>\n              )}\n',
    "assistant plan visibility",
  );
  s = before + d;
  write(path, s);
}

// 5) Pro içindeki Plus-only Neta ortaklık kartını ve metriğini kaldır.
{
  const path = "components/product/growth.tsx";
  let s = read(path);
  s = replaceOnce(
    s,
    "referral_enabled:false,referral_reward:50000",
    "referral_enabled:false,referral_allowed:false,referral_reward:50000",
    "growth demo referral permission",
  );
  s = replaceOnce(
    s,
    "{[[Wallet,'Kullanılabilir Neta kredisi',money(d.balance)],[Gift,'Onaylanan davet',d.referrals.filter((r:any)=>r.status==='earned').length],[Clock,'Geri çağırmaya uygun müşteri',d.candidates.length]].map(",
    "{[[Wallet,'Kullanılabilir Neta kredisi',money(d.balance)],...(d.referral_allowed?[[Gift,'Onaylanan davet',d.referrals.filter((r:any)=>r.status==='earned').length]]:[]),[Clock,'Geri çağırmaya uygun müşteri',d.candidates.length]].map(",
    "growth referral metric",
  );
  const startMarker = '<section className="panel form-stack"><h2><Gift size={20}/>Neta ortaklık</h2>';
  const nextMarker = '<section className="panel form-stack"><h2><EyeOff size={20}/>Sayfanızın markası</h2>';
  const start = s.indexOf(startMarker);
  const end = s.indexOf(nextMarker, start);
  if (start < 0 || end < 0) throw new Error("Growth referral card markers missing");
  const card = s.slice(start, end);
  s = s.slice(0, start) + "{d.referral_allowed&&(" + card + ")}" + s.slice(end);
  write(path, s);
}

// 6) Şube kârlılığında Pro'ya yalnız manuel gider; gider kataloğu Plus'a özel.
{
  const path = "components/product/branches.tsx";
  let s = read(path);
  s = replaceOnce(
    s,
    '{data.plan !== "normal" && (\n        <section className="panel expense-catalog-panel">',
    '{data.plan === "plus" && (\n        <section className="panel expense-catalog-panel">',
    "plus-only expense catalog panel",
  );
  const label = '<LibraryBig size={16} /> Gider kalemi kaydet';
  const labelAt = s.indexOf(label);
  if (labelAt < 0) throw new Error("Catalog toolbar button label missing");
  const buttonStart = s.lastIndexOf("          <button", labelAt);
  const buttonEnd = s.indexOf("          </button>", labelAt);
  if (buttonStart < 0 || buttonEnd < 0) throw new Error("Catalog toolbar button bounds missing");
  const buttonEndFull = buttonEnd + "          </button>".length;
  const button = s.slice(buttonStart, buttonEndFull);
  s =
    s.slice(0, buttonStart) +
    '          {data.plan === "plus" && (\n' +
    button.replace(/^          /gm, "            ") +
    '\n          )}' +
    s.slice(buttonEndFull);

  const fieldStartMarker = '            <Field label="Kayıtlı gider kalemi">';
  const fieldStart = s.indexOf(fieldStartMarker);
  const fieldEndMarker = "            </Field>";
  const fieldEnd = s.indexOf(fieldEndMarker, fieldStart);
  if (fieldStart < 0 || fieldEnd < 0) throw new Error("Catalog picker field missing");
  const fieldEndFull = fieldEnd + fieldEndMarker.length;
  const field = s.slice(fieldStart, fieldEndFull);
  s =
    s.slice(0, fieldStart) +
    '            {data.plan === "plus" && (\n' +
    field.replace(/^            /gm, "              ") +
    '\n            )}' +
    s.slice(fieldEndFull);
  write(path, s);
}

// 7) API, Pro'ya eski Plus gider kataloğu verisini sızdırmasın.
{
  const path = "lib/branches.ts";
  let s = read(path);
  s = replaceOnce(
    s,
    '  const catalog = await all(\n    "SELECT * FROM expense_catalog_items WHERE tenant_id=? AND active=1 ORDER BY category,name",\n    tenantId,\n  );\n',
    '  const catalog = limits.modules.accounting\n    ? await all(\n        "SELECT * FROM expense_catalog_items WHERE tenant_id=? AND active=1 ORDER BY category,name",\n        tenantId,\n      )\n    : [];\n',
    "catalog response entitlement",
  );
  write(path, s);
}

console.log("All package visibility patches applied.");
