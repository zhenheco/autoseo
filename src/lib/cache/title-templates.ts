import { createAdminClient } from "@/lib/supabase/server";

interface TemplateParams {
  industry?: string;
  region?: string;
  language: string;
  keyword: string;
}

function fillTemplate(template: string, keyword: string): string {
  const number = Math.floor(Math.random() * 8) + 3;
  return template
    .replace(/{keyword}/g, keyword)
    .replace(/{number}/g, number.toString());
}

export async function getTitlesFromTemplates(
  params: TemplateParams,
  count: number = 5,
): Promise<string[]> {
  const supabase = createAdminClient();
  const { industry, region, language, keyword } = params;

  let query = supabase
    .from("title_templates")
    .select("id, template")
    .eq("is_active", true)
    .eq("language", language);

  if (industry) {
    query = query.or(`industry.eq.${industry},industry.eq.general`);
  } else {
    query = query.eq("industry", "general");
  }

  const { data: templates, error } = await query.limit(count * 2);

  if (error || !templates || templates.length === 0) {
    return [];
  }

  const shuffled = templates.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);
  const titles = selected.map((t) => fillTemplate(t.template, keyword));

  const templateIds = selected.map((t) => t.id);
  await supabase
    .from("title_templates")
    .update({ usage_count: supabase.rpc("increment_usage_count") })
    .in("id", templateIds);

  return titles;
}
