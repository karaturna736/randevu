from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))

# Entitlements: make the three capabilities genuinely Plus-only.
p = Path("lib/entitlements.ts")
t = p.read_text()
t = t.replace('      | "website"\n      | "setupCenter",', '      | "website"\n      | "managementApi"\n      | "branchAutomation"\n      | "setupCenter",')
t = t.replace('  | "website"\n  | "setupCenter";', '  | "website"\n  | "managementApi"\n  | "branchAutomation"\n  | "setupCenter";')
t = t.replace('      website: false,\n      setupCenter: false,', '      website: false,\n      managementApi: false,\n      branchAutomation: false,\n      setupCenter: false,', 2)
t = t.replace('      // Özel işletme web sitesi henüz ürünleştirilmedi; satış kapsamına açılmaz.\n      website: false,\n      setupCenter: true,', '      website: true,\n      managementApi: true,\n      branchAutomation: true,\n      setupCenter: true,')
t = t.replace('  website: "İşletme web sitesi",\n  setupCenter:', '  website: "İşletme web sitesi",\n  managementApi: "Yönetim API\'si",\n  branchAutomation: "Şubeler arası otomasyon",\n  setupCenter:')
p.write_text(t)

# Dashboard: expose one Plus tools workspace.
replace_once(
    "components/product/dashboard.tsx",
    'import { BranchProfitability } from "./branches";\n',
    'import { BranchProfitability } from "./branches";\nimport { PlusBusinessTools } from "./plus-tools";\n',
)
replace_once(
    "components/product/dashboard.tsx",
    '  { id: "whatsapp", title: "WhatsApp", icon: MessageSquare },\n  { id: "setup-center", title: "Kurulum Merkezi", icon: Store },',
    '  { id: "whatsapp", title: "WhatsApp", icon: MessageSquare },\n  { id: "plus-tools", title: "Plus işletme araçları", icon: Plug },\n  { id: "setup-center", title: "Kurulum Merkezi", icon: Store },',
)
replace_once(
    "components/product/dashboard.tsx",
    '  integrations: "whatsapp",\n  "setup-center": "setupCenter",',
    '  integrations: "whatsapp",\n  "plus-tools": "website",\n  "setup-center": "setupCenter",',
)
replace_once(
    "components/product/dashboard.tsx",
    '  "setup-center": [\n    "İşletmenizi birlikte hazırlayalım.",',
    '  "plus-tools": [\n    "Plus ile işletmenizi dışarı açın.",\n    "Özel web vitrini, güvenli yönetim API\'si ve şubeler arası otomasyon tek yerde.",\n  ],\n  "setup-center": [\n    "İşletmenizi birlikte hazırlayalım.",',
)
replace_once(
    "components/product/dashboard.tsx",
    '          {activeView === "setup-center" && <SetupCenter key={w.business.id} w={w} />} {" "}',
    '          {activeView === "plus-tools" && <PlusBusinessTools key={w.business.id} w={w} />} {" "}\n          {activeView === "setup-center" && <SetupCenter key={w.business.id} w={w} />} {" "}',
)

# Main API: panel tools, public website profile, overflow suggestions.
replace_once(
    "app/api/v1/[...path]/route.ts",
    'import { waSnapshot } from "@/lib/whatsapp";\n',
    'import { waSnapshot } from "@/lib/whatsapp";\nimport { plusToolsSnapshot, plusToolsAction, publicWebsite, branchOverflowAlternatives } from "@/lib/plus-business-tools";\n',
)
replace_once(
    "app/api/v1/[...path]/route.ts",
    '    if (p[0] === "setup-center") return ok(await setupSnapshot(id));\n',
    '    if (p[0] === "plus-tools") return ok(await plusToolsSnapshot(id));\n    if (p[0] === "setup-center") return ok(await setupSnapshot(id));\n',
)
replace_once(
    "app/api/v1/[...path]/route.ts",
    '''    if (p[0] === "availability") {
      const b = id
        ? await tenant(id)
        : await publicBusiness(u.searchParams.get("slug") || "");
      return ok({
        slots: await available(
          b,
          u.searchParams.get("service") || "",
          date.parse(u.searchParams.get("date")),
          u.searchParams.get("staff") || "any",
          "",
          undefined,
          u.searchParams.get("branch") || undefined,
        ),
      });
    }
''',
    '''    if (p[0] === "availability") {
      const b = id
          ? await tenant(id)
          : await publicBusiness(u.searchParams.get("slug") || ""),
        serviceId = u.searchParams.get("service") || "",
        appointmentDate = date.parse(u.searchParams.get("date")),
        staffId = u.searchParams.get("staff") || "any",
        branchId = u.searchParams.get("branch") || undefined,
        slots = await available(b, serviceId, appointmentDate, staffId, "", undefined, branchId),
        alternatives = !slots.length && branchId
          ? await branchOverflowAlternatives(b, serviceId, appointmentDate, branchId)
          : [];
      return ok({ slots, alternatives });
    }
''',
)
replace_once(
    "app/api/v1/[...path]/route.ts",
    '        presentation: await publicStyle(b.id),\n',
    '        presentation: await publicStyle(b.id),\n        website: await publicWebsite(b.id),\n',
)
replace_once(
    "app/api/v1/[...path]/route.ts",
    '          "SELECT id,name,city,address FROM branches WHERE tenant_id=? AND active=1 ORDER BY is_primary DESC,name",',
    '          "SELECT id,name,city,address,phone,is_primary FROM branches WHERE tenant_id=? AND active=1 ORDER BY is_primary DESC,name",',
)
replace_once(
    "app/api/v1/[...path]/route.ts",
    '    if (p[0] === "setup-import") {\n',
    '    if (p[0] === "plus-tools") return ok(await plusToolsAction(id, x));\n    if (p[0] === "setup-import") {\n',
)

# External API-created bookings keep their source distinct.
replace_once(
    "lib/booking.ts",
    'z.enum(["web", "panel", "whatsapp", "recovery"]).parse(source)',
    'z.enum(["web", "panel", "whatsapp", "recovery", "api"]).parse(source)',
)

# Public business page becomes a real Plus mini-site above the booking flow.
replace_once(
    "components/product/public.tsx",
    '    <PublicShell business={b} presentation={data.presentation}>\n      <BookingTheme',
    '''    <PublicShell business={b} presentation={data.presentation}>
      {data.website && (
        <section className="discover-hero" style={data.website.cover_url ? { backgroundImage: `linear-gradient(rgba(255,255,255,.88),rgba(255,255,255,.96)),url(${data.website.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          <span className="eyebrow">{b.category}</span>
          <h1>{data.website.headline || b.name}</h1>
          {data.website.intro && <p>{data.website.intro}</p>}
          <div className="button-group">
            {data.website.contact_phone && <a className="button primary" href={`tel:${data.website.contact_phone}`}><Phone size={16}/>Ara</a>}
            {data.website.instagram_url && <a className="button" href={data.website.instagram_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>Instagram</a>}
          </div>
        </section>
      )}
      <BookingTheme''',
)
replace_once(
    "components/product/public.tsx",
    '  Video,\n} from "lucide-react";',
    '  Video,\n  ExternalLink,\n} from "lucide-react";',
)

# Booking flow: explicit branch choice + real-time overflow alternatives.
p = Path("components/product/booking-form.tsx")
t = p.read_text()
t = t.replace('    services = data.services.filter((s: any) => s.active !== 0),\n    staff = data.staff.filter((p: any) => p.active !== 0);', '    services = data.services.filter((s: any) => s.active !== 0),\n    staff = data.staff.filter((p: any) => p.active !== 0),\n    branches = data.branches || [];')
t = t.replace('    [slots, setSlots] = useState<any[]>([]),\n    [selected, setSelected]', '    [slots, setSlots] = useState<any[]>([]),\n    [branch, setBranch] = useState(initial?.branch_id || branches.find((b: any) => b.is_primary)?.id || branches[0]?.id || ""),\n    [branchAlternatives, setBranchAlternatives] = useState<any[]>([]),\n    [selected, setSelected]')
t = t.replace('    setDemand(null);\n    setLoading(true);', '    setDemand(null);\n    setBranchAlternatives([]);\n    setLoading(true);', 1)
t = t.replace('      `availability?${tenantId ? "tenant=" + tenantId : "slug=" + business.slug}&service=${service}&date=${date}&staff=${person}`,\n    )\n      .then((r) => !stopped && setSlots(r.slots))', '      `availability?${tenantId ? "tenant=" + tenantId : "slug=" + business.slug}&service=${service}&date=${date}&staff=${person}${branch ? "&branch=" + encodeURIComponent(branch) : ""}`,\n    )\n      .then((r) => { if (!stopped) { setSlots(r.slots); setBranchAlternatives(r.alternatives || []); } })')
t = t.replace('  }, [step, service, person, date]);', '  }, [step, service, person, date, branch]);')
t = t.replace('            service_id: service,\n            staff_id: selected.staff_id,', '            service_id: service,\n            branch_id: selected.branch_id || branch || undefined,\n            staff_id: selected.staff_id,')
t = t.replace('          {staff.length > 1 && (\n            <Field label="Personel tercihiniz">', '          {branches.length > 1 && (\n            <Field label="Şube tercihiniz">\n              <Pick label="Şube" value={branch} onChange={(v: string) => { setBranch(v); setPerson("any"); setSelected(null); }} options={branches.map((b: any) => ({ value: b.id, label: b.name }))} />\n            </Field>\n          )}\n          {staff.filter((p: any) => !branch || p.branch_id === branch).length > 1 && (\n            <Field label="Personel tercihiniz">')
t = t.replace('                  ...staff\n                    .filter((p: any) => p.active !== 0)', '                  ...staff\n                    .filter((p: any) => p.active !== 0 && (!branch || p.branch_id === branch))')
t = t.replace('                          `availability?slug=${business.slug}&service=${service}&date=${date}&staff=${person}`,', '                          `availability?slug=${business.slug}&service=${service}&date=${date}&staff=${person}${branch ? "&branch=" + encodeURIComponent(branch) : ""}`,')
t = t.replace('                      ).slots,\n                    );', '                      ).slots,\n                    );\n                  setBranchAlternatives([]);', 1)
needle = '''          {!loading && !slots.length && !error && (
            <>
              <Blank
'''
if needle not in t:
    raise SystemExit("booking-form blank block not found")
# Insert alternatives after the empty-state block by anchoring before demand alternatives.
t = t.replace('          {demand?.alternatives?.length > 0 && (', '''          {branchAlternatives.length > 0 && (
            <div className="demand-alternatives">
              <strong>Diğer şubelerde uygun saatler</strong>
              <p className="helper">Seçtiğiniz şube dolu. Plus şube otomasyonu alternatifleri buldu.</p>
              <div className="slot-grid">
                {branchAlternatives.map((v: any) => (
                  <button key={v.branch_id + v.staff_id + v.minute} className={selected?.minute === v.minute && selected?.branch_id === v.branch_id ? "selected" : ""} onClick={() => setSelected(v)} title={v.branch_name}>
                    {v.time} · {v.branch_name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {demand?.alternatives?.length > 0 && (''')
p.write_text(t)

# Package cards: only advertise what is now implemented.
for path in ["components/product/recurring.tsx", "components/product/onboarding.tsx"]:
    p = Path(path)
    t = p.read_text()
    marker = '      "Kurulum merkezi, veri taşıma ve eğitim talebi",'
    if marker in t:
        t = t.replace(marker, '      "İşletme web sitesi ve marka vitrini",\n      "Güvenli yönetim API\'si",\n      "Şubeler arası doluluk otomasyonu",\n' + marker, 1)
    else:
        marker2 = '      "Neta ortaklık programı",'
        if marker2 in t:
            t = t.replace(marker2, marker2 + '\n      "İşletme web sitesi, yönetim API\'si ve şubeler arası otomasyon",', 1)
        else:
            raise SystemExit(f"Plus feature marker not found in {path}")
    p.write_text(t)

# Ensure the integrity test participates in the standard test suite.
replace_once(
    "package.json",
    'node tests/plan-integrity.mjs && node tests/identity-billing.mjs',
    'node tests/plan-integrity.mjs && node tests/plus-business-tools.mjs && node tests/identity-billing.mjs',
)
