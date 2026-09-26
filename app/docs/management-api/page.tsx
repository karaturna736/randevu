import { PublicShell } from "@/components/product/public";

export default function ManagementApiDocs() {
  return <PublicShell><main className="legal-page"><article className="panel form-stack" style={{maxWidth:980,margin:"40px auto"}}>
    <span className="eyebrow">NETA PLUS · YÖNETİM API’Sİ</span>
    <h1>Yönetim API belgeleri</h1>
    <p>Neta Plus işletmeleri harici ERP, CRM, muhasebe ve otomasyon sistemlerini güvenli Bearer anahtarlarıyla bağlayabilir. API anahtarını panelde <strong>Plus araçları</strong> bölümünden oluşturun. Anahtar yalnızca oluşturulduğu anda tam olarak gösterilir.</p>
    <h2>Kimlik doğrulama</h2>
    <pre><code>{`Authorization: Bearer neta_live_...`}</code></pre>
    <p>API anahtarını tarayıcı tarafı JavaScript’e, herkese açık depolara, ekran görüntülerine veya sohbetlere koymayın. Şüpheli bir durumda anahtarı panelden iptal edip yenisini oluşturun.</p>
    <h2>Okuma uçları</h2>
    <pre><code>{`GET /api/management/v1/business
GET /api/management/v1/branches
GET /api/management/v1/services
GET /api/management/v1/staff
GET /api/management/v1/appointments?from=2026-09-01&to=2026-09-30&branch=BRANCH_ID
GET /api/management/v1/availability?service=SERVICE_ID&date=2026-09-30&branch=BRANCH_ID&staff=any`}</code></pre>
    <h2>Randevu oluşturma</h2>
    <pre><code>{`POST /api/management/v1/appointments
Content-Type: application/json

{
  "service_id": "SERVICE_ID",
  "staff_id": "STAFF_ID",
  "branch_id": "BRANCH_ID",
  "date": "2026-09-30",
  "minute": 840,
  "name": "Müşteri Adı",
  "phone": "+905551112233",
  "email": "musteri@example.com"
}`}</code></pre>
    <h2>Randevu işlemleri</h2>
    <pre><code>{`POST /api/management/v1/appointment-action
Content-Type: application/json

{
  "id": "APPOINTMENT_ID",
  "action": "cancel"
}`}</code></pre>
    <p>Yönetim API’si aktif bir Neta Plus aboneliği gerektirir. Anahtar iptal edilirse veya Plus erişimi sona ererse API erişimi de durur. Okuma ve yazma istekleri kötüye kullanım önleme sınırlarına tabidir.</p>
  </article></main></PublicShell>;
}
