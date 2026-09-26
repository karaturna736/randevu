import { z } from "zod";
import { admin, all, hash, now, q, tenant, uid } from "./server";
import { HELP_ARTICLES, helpMatches } from "./help-content";

const STOP_WORDS = new Set([
  "acaba",
  "bana",
  "ben",
  "bir",
  "bunu",
  "email",
  "icin",
  "istiyorum",
  "kart",
  "mi",
  "miyim",
  "mu",
  "musun",
  "nasil",
  "nerde",
  "nereden",
  "neresi",
  "olur",
  "posta",
  "sayi",
  "telefon",
  "yapabilirim",
  "yaparim",
  "yapilir",
  "yapmak",
  "var",
]);

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9ğüşöç\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scrubQuestion(value: string) {
  return value
    .trim()
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[e-posta]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[kart]")
    .replace(/(?:\+?90[\s.-]?)?(?:0?5\d{2})[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g, "[telefon]")
    .replace(/\b\d{6,}\b/g, "[sayi]")
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

function questionKey(value: string) {
  const words = normalize(value)
    .split(" ")
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  const unique = [...new Set(words)].sort().slice(0, 14);
  return (unique.join(" ") || normalize(value)).slice(0, 180);
}

async function recordUnansweredQuestion(message: string) {
  const sample = scrubQuestion(message);
  const key = questionKey(sample);
  if (!sample || !key) return;
  const fingerprint = await hash("help-question:" + key);
  const stamp = now();
  await q(
    `INSERT INTO help_question_insights
      (id,fingerprint,question_key,sample_question,ask_count,status,first_seen_at,last_seen_at,updated_at)
     VALUES (?,?,?,?,1,'open',?,?,?)
     ON CONFLICT(fingerprint) DO UPDATE SET
       ask_count=help_question_insights.ask_count+1,
       last_seen_at=excluded.last_seen_at,
       updated_at=excluded.updated_at`,
    uid(),
    fingerprint,
    key,
    sample,
    stamp,
    stamp,
    stamp,
  ).run();
}

export function helpStatus() {
  return {
    connected: true,
    provider: "Neta Kılavuz",
    mode: "system",
  };
}

export async function helpAnswer(id: string, input: any) {
  await tenant(id);
  const x = z
    .object({
      message: z.string().trim().min(3).max(1200),
      use_ai: z.boolean().optional(),
    })
    .parse(input);

  const matches = helpMatches(x.message);
  const first = matches[0];

  if (!first) {
    try {
      await recordUnansweredQuestion(x.message);
    } catch {
      // Yardım cevabı, analitik kaydı başarısız olsa bile çalışmaya devam etsin.
    }
    return {
      mode: "guide",
      matched: false,
      answer:
        "Bu soru için doğrulanmış bir Neta kılavuzu bulamadım. Aşağıdaki kılavuz başlıklarından arama yapabilir veya destek ekibine iletebilirsiniz.",
      articles: [],
    };
  }

  return {
    mode: "guide",
    matched: true,
    answer: first.body,
    articles: matches.map((article) => article.id),
    steps: first.steps || [],
    view: first.view,
    title: first.title,
    category: first.category,
  };
}

export async function platformHelpInsights() {
  await admin();
  const [totals] = await all(
    `SELECT
      COUNT(*) topics,
      COALESCE(SUM(ask_count),0) asks,
      COALESCE(SUM(CASE WHEN status='open' THEN 1 ELSE 0 END),0) open_topics,
      COALESCE(SUM(CASE WHEN status='open' THEN ask_count ELSE 0 END),0) open_asks,
      COALESCE(SUM(CASE WHEN status='planned' THEN 1 ELSE 0 END),0) planned_topics,
      COALESCE(SUM(CASE WHEN status='answered' THEN 1 ELSE 0 END),0) answered_topics
     FROM help_question_insights`,
  );
  return {
    totals,
    rows: await all(
      `SELECT id,sample_question,ask_count,status,first_seen_at,last_seen_at,updated_at
       FROM help_question_insights
       ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'planned' THEN 1 WHEN 'answered' THEN 2 ELSE 3 END,
                ask_count DESC,last_seen_at DESC
       LIMIT 250`,
    ),
  };
}

export async function updateHelpInsight(input: any) {
  const u = await admin();
  const x = z
    .object({
      id: z.string().min(1),
      status: z.enum(["open", "planned", "answered", "ignored"]),
    })
    .parse(input);
  const stamp = now();
  const found = await all(
    "SELECT id FROM help_question_insights WHERE id=? LIMIT 1",
    x.id,
  );
  if (!found.length) return { ok: false };
  await q(
    "UPDATE help_question_insights SET status=?,updated_at=? WHERE id=?",
    x.status,
    stamp,
    x.id,
  ).run();
  await q(
    "INSERT INTO audit (id,user_id,action,target_id,created_at) VALUES (?,?,?,?,?)",
    uid(),
    u.userId,
    "help-insight-status:" + x.status,
    x.id,
    stamp,
  ).run();
  return { ok: true };
}

export { HELP_ARTICLES };
