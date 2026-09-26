import { z } from "zod";
import { tenant } from "./server";
import { HELP_ARTICLES, helpMatches } from "./help-content";

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

export { HELP_ARTICLES };
