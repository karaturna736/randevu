import { readFileSync, writeFileSync } from "node:fs";

function patch(path, replacements) {
  let source = readFileSync(path, "utf8");
  for (const [from, to, label] of replacements) {
    if (!source.includes(from)) throw new Error(`${path}: replacement not found: ${label}`);
    source = source.replace(from, to);
  }
  writeFileSync(path, source);
}

patch("lib/whatsapp.ts", [
  [
    'import { requirePlanModule } from "./entitlements";',
    'import { requirePlanModule, consumePlanQuota } from "./entitlements";',
    "WhatsApp quota import",
  ],
  [
    'async function graph(c: any, payload: any) {\n  const r = await fetch(',
    'async function graph(c: any, payload: any) {\n  // Her gerçek Meta gönderimi paket kotasından atomik olarak tüketilir.\n  // Başarısız sağlayıcı denemeleri de kotaya dahildir; tekrar fırtınasını engeller.\n  await consumePlanQuota(c.tenant_id, "whatsapp");\n  const r = await fetch(',
    "Graph send quota",
  ],
  [
    '      e instanceof ApiError ? "failed" : "unknown",',
    '      e instanceof ApiError && e.status === 429\n        ? "quota"\n        : e instanceof ApiError\n          ? "failed"\n          : "unknown",',
    "Quota message state",
  ],
]);

patch("app/api/v1/[...path]/route.ts", [
  [
    'import { waSnapshot } from "@/lib/whatsapp";',
    'import { waSnapshot } from "@/lib/whatsapp";\nimport { consumePlanQuota } from "@/lib/entitlements";',
    "AI quota import",
  ],
  [
    '    if (p[0] === "assistant") {\n      await limit(req, "assistant", 50);\n      return ok(',
    '    if (p[0] === "assistant") {\n      await limit(req, "assistant", 50);\n      // Panel asistanı paket AI kotasını paylaşır; herkese açık müşteri asistanı ayrı kalır.\n      if (id) await consumePlanQuota(id, "ai");\n      return ok(',
    "Panel assistant quota",
  ],
]);

patch("components/product/growth.tsx", [
  [
    "const waStates:Record<string,string>={pending:'Gönderim bekliyor',sending:'Gönderiliyor',accepted:'Sağlayıcı kabul etti',delivered:'Teslim edildi',read:'Okundu',failed:'Gönderilemedi',unknown:'Sonuç doğrulanmalı'};",
    "const waStates:Record<string,string>={pending:'Gönderim bekliyor',sending:'Gönderiliyor',accepted:'Sağlayıcı kabul etti',delivered:'Teslim edildi',read:'Okundu',failed:'Gönderilemedi',quota:'Paket kotası doldu',unknown:'Sonuç doğrulanmalı'};",
    "WhatsApp quota UI state",
  ],
  [
    '<Checkbox checked={ai} disabled={!connection.connected||w.preview||!w.business?.id} onCheckedChange={v=>setAi(v===true)}/>Sorumu yapay zekâya gönder',
    '<Checkbox checked={ai} disabled={!connection.connected||w.preview||!w.business?.id||Number(w.entitlements?.aiDaily||0)<=0} onCheckedChange={v=>setAi(v===true)}/>Sorumu yapay zekâya gönder{Number(w.entitlements?.aiDaily||0)>0?` · günlük ${w.entitlements.aiDaily}`:""}',
    "Help AI package-aware checkbox",
  ],
]);

patch("components/product/recurring.tsx", [
  ['      "Pazarlama ve büyüme araçları · sınırlı kullanım",', '      "Pazarlama ve büyüme araçları",', "Pro growth wording"],
  ['      "Gelir Kurtarma Motoru · sınırlı otomasyon",', '      "Gelir Kurtarma Motoru ve bekleme listesi",', "Pro recovery wording"],
  ['      "AI işletme asistanı · günde 50 kullanım",', '      "AI / randevu asistanı · günde 50 kullanım",', "Pro AI wording"],
  ['      "Erken gelirim modu ve bekleme listesi",', '      "Erken gelirim modu",', "Avoid duplicated waitlist"],
  ['      "Online ödeme altyapısına hazır entegrasyon",\n', '', "Remove unfinished customer payment claim"],
  ['      "Pro\'daki her şey · sınırsız kullanım",', '      "Pro\'daki her şey · daha yüksek kullanım limitleri",', "Plus unlimited wording"],
  ['      "Sınırsız Borç / Veresiye kaydı",', '      "Borç / Veresiye ve tahsilat takibine tam erişim",', "Plus receivables wording"],
  ['      "Sınırsız Hizmet Yolculuğu kaydı",', '      "Hizmet Yolculuğuna tam erişim",', "Plus journey wording"],
  ['      "Pazarlama ve büyüme modülüne tam erişim",\n', '', "Remove fake Pro-vs-Plus growth distinction"],
  ['      "Gelir Kurtarma Motoruna tam erişim",\n', '', "Remove fake Pro-vs-Plus recovery distinction"],
  ['      "Şubeler arası otomasyon ve performans karşılaştırması",', '      "Şubeler arası performans karşılaştırması",', "Remove unimplemented branch automation claim"],
  ['      "İşletme web sitesi",\n', '', "Remove unimplemented website claim"],
  ['      "Gelişmiş raporlama ve yönetim API\'si",\n', '', "Remove unimplemented management API claim"],
  ['      "AI asistanı · günde 200 kullanım",', '      "AI / randevu asistanı · günde 200 kullanım",', "Plus AI wording"],
]);

patch("components/product/onboarding.tsx", [
  ['      "WhatsApp kurulumu, AI ve online ödeme",', '      "WhatsApp · ayda 1.000, AI · günde 50",', "Onboarding Pro quota wording"],
  ['      "Pro\'daki her şey · sınırsız kullanım",', '      "Pro\'daki her şey · daha yüksek kullanım limitleri",', "Onboarding Plus unlimited wording"],
  ['      "Muhasebe ve sınırsız kayıt",', '      "Muhasebe gider kataloğu ve gelişmiş şube analizi",', "Onboarding accounting wording"],
  ['      "İşletme web sitesi",', '      "WhatsApp · ayda 5.000, AI · günde 200",', "Onboarding remove website claim"],
]);

patch("components/product/landing.tsx", [
  ['                "Çift yönlü WhatsApp ve AI asistanı",', '                "Çift yönlü WhatsApp ve AI / randevu asistanı",', "Landing assistant wording"],
  ['                "Online ödeme altyapısına hazır entegrasyon",\n', '', "Landing remove unfinished customer payment claim"],
]);

patch("lib/entitlements.ts", [
  [
    '      referral: true,\n      website: true,\n      setupCenter: true,',
    '      referral: true,\n      // Özel işletme web sitesi henüz ürünleştirilmedi; satış kapsamına açılmaz.\n      website: false,\n      setupCenter: true,',
    "Disable unfinished website entitlement",
  ],
]);

patch("README.md", [
  [
    '- **Starter — 600 TL/ay:** 1 işletme, 1 şube, en fazla 5 personel ve temel web\n  randevu yönetimi.\n- **Business — 999 TL/ay:** 5 şubeye kadar, sınırsız personel, gelir kurtarma,\n  AI, çift yönlü WhatsApp, online ödeme ve şube kâr/zarar takibi.\n- **Kurumsal — 2.500 TL/ay:** sınırsız şube ve personel, yüksek kullanım\n  limitleri, API, şubeler arası otomasyon ve gelişmiş raporlama.',
    '- **Neta Standart — 600 TL/ay:** 1 işletme, 1 şube, en fazla 5 personel; randevu, müşteri, hizmet, ekip ve işlem analizi.\n- **Neta Pro — 999 TL/ay:** 3 şubeye kadar, sınırsız personel; borç/veresiye, Hizmet Yolculuğu, pazarlama, gelir kurtarma, talep fırsatları, gelir/şube raporları; ayda 1.000 WhatsApp ve günde 50 AI/randevu asistanı kullanımı.\n- **Neta Plus — 2.500 TL/ay:** sınırsız şube ve personel; Pro kapsamına ek olarak 90 günlük gelişmiş talep analizi, tekrar kullanılabilir gider kataloğu, Neta ortaklık programı ve kurulum/veri taşıma merkezi; ayda 5.000 WhatsApp ve günde 200 AI/randevu asistanı kullanımı.',
    "README package truth",
  ],
]);

patch("package.json", [
  [
    'node tests/customer-operations.mjs && node tests/identity-billing.mjs',
    'node tests/customer-operations.mjs && node tests/plan-integrity.mjs && node tests/identity-billing.mjs',
    "Run package integrity test",
  ],
]);

console.log("Feature integrity patch applied.");
