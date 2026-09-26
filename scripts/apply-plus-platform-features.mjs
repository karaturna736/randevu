import { readFileSync, writeFileSync } from "node:fs";

function read(path){ return readFileSync(path,"utf8"); }
function write(path,text){ writeFileSync(path,text); }
function mustReplace(path, search, replacement, expected=1){
  let text=read(path), count=text.split(search).length-1;
  if(count!==expected) throw new Error(`${path}: expected ${expected} matches, found ${count}: ${search.slice(0,80)}`);
  text=text.split(search).join(replacement); write(path,text);
}
function mustRegex(path, regex, replacement){
  let text=read(path); if(!regex.test(text)) throw new Error(`${path}: regex not found ${regex}`);
  text=text.replace(regex,replacement); write(path,text);
}

// Package entitlement matrix: the three features are Plus-only.
mustReplace("lib/entitlements.ts",`      | "website"\n      | "setupCenter",`,`      | "website"\n      | "managementApi"\n      | "branchAutomation"\n      | "setupCenter",`);
mustReplace("lib/entitlements.ts",`      website: false,\n      setupCenter: false,`,`      website: false,\n      managementApi: false,\n      branchAutomation: false,\n      setupCenter: false,`,2);
mustReplace("lib/entitlements.ts",`      // Özel işletme web sitesi henüz ürünleştirilmedi; satış kapsamına açılmaz.\n      website: false,\n      setupCenter: true,`,`      website: true,\n      managementApi: true,\n      branchAutomation: true,\n      setupCenter: true,`);
mustReplace("lib/entitlements.ts",`  | "website"\n  | "setupCenter";`,`  | "website"\n  | "managementApi"\n  | "branchAutomation"\n  | "setupCenter";`);
mustReplace("lib/entitlements.ts",`  website: "İşletme web sitesi",\n  setupCenter:`,`  website: "İşletme web sitesi",\n  managementApi: "Yönetim API'si",\n  branchAutomation: "Şubeler arası otomasyon",\n  setupCenter:`);

// Management API-created appointments are a first-class source.
mustReplace("lib/booking.ts",`z.enum(["web", "panel", "whatsapp", "recovery"]).parse(source)`,`z.enum(["web", "panel", "whatsapp", "recovery", "api"]).parse(source)`);

// Internal Plus tools + public website + cross-branch fallback.
mustReplace("app/api/v1/[...path]/route.ts",`import { consumePlanQuota } from "@/lib/entitlements";`,`import { consumePlanQuota } from "@/lib/entitlements";\nimport {\n  plusToolsSnapshot,\n  saveWebsite,\n  publicWebsite,\n  createManagementApiKey,\n  revokeManagementApiKey,\n  saveBranchAutomation,\n  crossBranchAlternatives,\n} from "@/lib/plus-platform";`);
mustReplace("app/api/v1/[...path]/route.ts",`    if (p[0] === "help-status") return ok(helpStatus());`,`    if (p[0] === "plus-tools") return ok(await plusToolsSnapshot(id));\n    if (p[0] === "help-status") return ok(helpStatus());`);
mustRegex("app/api/v1/[...path]/route.ts",/    if \(p\[0\] === "availability"\) \{[\s\S]*?\n    \}\n    if \(p\[0\] === "businesses"\)/,`    if (p[0] === "availability") {\n      const b = id\n        ? await tenant(id)\n        : await publicBusiness(u.searchParams.get("slug") || "");\n      const serviceId = u.searchParams.get("service") || "",\n        requestedDate = date.parse(u.searchParams.get("date")),\n        person = u.searchParams.get("staff") || "any",\n        branchId = u.searchParams.get("branch") || undefined;\n      const slots = await available(b, serviceId, requestedDate, person, "", undefined, branchId);\n      const alternatives = !id && branchId && !slots.length\n        ? await crossBranchAlternatives(b, serviceId, requestedDate, "any", branchId)\n        : [];\n      return ok({ slots, alternatives });\n    }\n    if (p[0] === "businesses")`);
mustReplace("app/api/v1/[...path]/route.ts",`        presentation: await publicStyle(b.id),`,`        presentation: await publicStyle(b.id),\n        website: await publicWebsite(b.id),`);
mustReplace("app/api/v1/[...path]/route.ts",`    if (p[0] === "expense-catalog")\n      return ok(await saveExpenseCatalogItem(id, x));`,`    if (p[0] === "expense-catalog")\n      return ok(await saveExpenseCatalogItem(id, x));\n    if (p[0] === "plus-tools") {\n      await limit(req, "plus-tools", 60);\n      if (x.action === "website") return ok(await saveWebsite(id, x));\n      if (x.action === "create-api-key") return ok(await createManagementApiKey(id, x), 201);\n      if (x.action === "revoke-api-key") return ok(await revokeManagementApiKey(id, x));\n      if (x.action === "branch-automation") return ok(await saveBranchAutomation(id, x));\n      throw new ApiError("Geçersiz Plus aracı işlemi.", 400);\n    }`);

// Dashboard entry, gating and renderer.
mustReplace("components/product/dashboard.tsx",`import { BranchProfitability } from "./branches";`,`import { BranchProfitability } from "./branches";\nimport { PlusTools } from "./plus-tools";`);
mustReplace("components/product/dashboard.tsx",`  { id: "branches", title: "Şube kârlılığı", icon: Building2 },`,`  { id: "branches", title: "Şube kârlılığı", icon: Building2 },\n  { id: "plus-tools", title: "Plus araçları", icon: Plug },`);
mustReplace("components/product/dashboard.tsx",`  branches: "branchProfit",`,`  branches: "branchProfit",\n  "plus-tools": "managementApi",`);
mustReplace("components/product/dashboard.tsx",`  "setup-center": [`,`  "plus-tools": [\n    "Plus altyapınız tek merkezde.",\n    "İşletme web sitesi, Yönetim API'si ve şubeler arası otomasyonu yönetin.",\n  ],\n  "setup-center": [`);
mustReplace("components/product/dashboard.tsx",`          {activeView === "branches" && (\n            <BranchProfitability key={w.business.id} w={w} />\n          )}{" "}`,`          {activeView === "branches" && (\n            <BranchProfitability key={w.business.id} w={w} />\n          )}{" "}\n          {activeView === "plus-tools" && (\n            <PlusTools key={w.business.id} w={w} />\n          )}{" "}`);

// Booking form: branch selection, branch-aware availability, fallback alternatives and branch-bound booking.
mustReplace("components/product/booking-form.tsx",`    staff = data.staff.filter((p: any) => p.active !== 0);`,`    staff = data.staff.filter((p: any) => p.active !== 0),\n    branches = (data.branches || []).filter((b: any) => b.active !== 0);`);
mustReplace("components/product/booking-form.tsx",`    [person, setPerson] = useState(initial?.slot?.staff_id || "any"),\n    [date, setDate]`,`    [person, setPerson] = useState(initial?.slot?.staff_id || "any"),\n    [branch, setBranch] = useState(initial?.branch_id || branches[0]?.id || ""),\n    [alternatives, setAlternatives] = useState<any[]>([]),\n    [date, setDate]`);
mustReplace("components/product/booking-form.tsx",`    if (staff.some((p: any) => p.id === q.get("person")))\n      setPerson(q.get("person")!);`,`    if (staff.some((p: any) => p.id === q.get("person")))\n      setPerson(q.get("person")!);\n    if (branches.some((b: any) => b.id === q.get("branch")))\n      setBranch(q.get("branch")!);`);
mustReplace("components/product/booking-form.tsx",`      \`availability?\${tenantId ? "tenant=" + tenantId : "slug=" + business.slug}&service=\${service}&date=\${date}&staff=\${person}\`,`,`      \`availability?\${tenantId ? "tenant=" + tenantId : "slug=" + business.slug}&service=\${service}&date=\${date}&staff=\${person}&branch=\${branch}\`,`);
mustReplace("components/product/booking-form.tsx",`      .then((r) => !stopped && setSlots(r.slots))`,`      .then((r) => { if (!stopped) { setSlots(r.slots); setAlternatives(r.alternatives || []); } })`);
mustReplace("components/product/booking-form.tsx",`  }, [step, service, person, date]);`,`  }, [step, service, person, date, branch]);`);
mustReplace("components/product/booking-form.tsx",`            staff_id: selected.staff_id,\n            date,`,`            staff_id: selected.staff_id,\n            branch_id: branch || undefined,\n            date,`);
mustReplace("components/product/booking-form.tsx",`          {staff.length > 1 && (`,`          {branches.length > 1 && (\n            <Field label="Şube tercihiniz">\n              <Pick label="Şube" value={branch} onChange={(v)=>{setBranch(v);setPerson("any")}} options={branches.map((b:any)=>({value:b.id,label:b.name+(b.city?" · "+b.city:"")}))} />\n            </Field>\n          )}\n          {staff.filter((p:any)=>!branch||!p.branch_id||p.branch_id===branch).length > 1 && (`);
mustReplace("components/product/booking-form.tsx",`                  ...staff\n                    .filter((p: any) => p.active !== 0)`,`                  ...staff\n                    .filter((p: any) => p.active !== 0 && (!branch || !p.branch_id || p.branch_id === branch))`);
mustReplace("components/product/booking-form.tsx",`                          \`availability?slug=\${business.slug}&service=\${service}&date=\${date}&staff=\${person}\`,`,`                          \`availability?slug=\${business.slug}&service=\${service}&date=\${date}&staff=\${person}&branch=\${branch}\`,`);
mustReplace("components/product/booking-form.tsx",`                      ).slots,`,`                      ).slots,`,2); // Assert both existing slot extractions still exist; no semantic change.
mustReplace("components/product/booking-form.tsx",`          {demand?.alternatives?.length > 0 && (`,`          {!tenantId && alternatives.length > 0 && (\n            <div className="demand-alternatives">\n              <strong>Diğer şubelerde uygun saatler</strong>\n              <p className="helper">Seçtiğiniz şube dolu. Neta diğer şubeleri otomatik kontrol etti.</p>\n              <div className="service-options">\n                {alternatives.map((a:any)=><button type="button" className="service-option" key={a.branch.id} onClick={()=>{setBranch(a.branch.id);setPerson("any");setAlternatives([])}}><span><strong>{a.branch.name}</strong><small>{a.branch.city||a.branch.address||"Diğer şube"} · İlk uygun {a.slots[0]?.time}</small></span><ArrowRight size={16}/></button>)}\n              </div>\n            </div>\n          )}\n          {demand?.alternatives?.length > 0 && (`);

// Sold Plus package copy now matches implemented capabilities.
mustReplace("components/product/recurring.tsx",`      "Kurulum merkezi, veri taşıma ve eğitim talebi",`,`      "Kurulum merkezi, veri taşıma ve eğitim talebi",\n      "Özelleştirilebilir işletme web sitesi ve SEO",\n      "Güvenli Yönetim API'si ve iptal edilebilir API anahtarları",\n      "Şubeler arası otomatik müsaitlik yönlendirmesi",`);
mustReplace("components/product/onboarding.tsx",`      "Neta ortaklık programı",\n      "WhatsApp · ayda 5.000, AI · günde 200",`,`      "Neta ortaklık programı",\n      "İşletme web sitesi · Yönetim API'si · şube otomasyonu",\n      "WhatsApp · ayda 5.000, AI · günde 200",`);

// Add the new integration suite to the canonical test command.
mustReplace("package.json",`node tests/plan-integrity.mjs`,`node tests/plan-integrity.mjs && node tests/plus-platform.mjs`);

console.log("Plus platform patches applied.");
