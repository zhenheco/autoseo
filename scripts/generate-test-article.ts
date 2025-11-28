import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  console.log("[測試文章生成] 開始生成測試文章...\n");

  // 1. 檢查使用者和公司
  const { data: members } = await supabase
    .from("company_members")
    .select("user_id, company_id")
    .eq("status", "active")
    .limit(1);

  if (!members || members.length === 0) {
    console.error("❌ 找不到活躍的公司成員");
    process.exit(1);
  }

  const { user_id, company_id } = members[0];
  console.log(`✓ 找到使用者: ${user_id.substring(0, 8)}...`);
  console.log(`✓ 公司 ID: ${company_id}\n`);

  // 2. 檢查或建立網站配置
  const { data: websites } = await supabase
    .from("website_configs")
    .select("id")
    .eq("company_id", company_id)
    .limit(1);

  let websiteId: string;

  if (!websites || websites.length === 0) {
    console.log("[建立] 建立預設網站配置...");
    const { data: newWebsite, error: createError } = await supabase
      .from("website_configs")
      .insert({
        company_id: company_id,
        website_name: "測試網站",
        wordpress_url: "",
      })
      .select("id")
      .single();

    if (createError || !newWebsite) {
      console.error("❌ 建立網站配置失敗:", createError);
      process.exit(1);
    }

    websiteId = newWebsite.id;
    console.log(`✓ 網站配置已建立: ${websiteId}\n`);
  } else {
    websiteId = websites[0].id;
    console.log(`✓ 使用現有網站配置: ${websiteId}\n`);
  }

  // 3. 檢查或建立 agent 配置
  const { data: agentConfigs } = await supabase
    .from("agent_configs")
    .select("id")
    .eq("website_id", websiteId)
    .limit(1);

  if (!agentConfigs || agentConfigs.length === 0) {
    console.log("[建立] 建立 agent 配置...");
    const { error: agentConfigError } = await supabase
      .from("agent_configs")
      .insert({
        website_id: websiteId,
        research_model: "deepseek-reasoner",
        complex_processing_model: "deepseek-reasoner",
        simple_processing_model: "deepseek-chat",
        image_model: "gemini-imagen",
        research_temperature: 0.7,
        research_max_tokens: 64000,
        strategy_temperature: 0.7,
        strategy_max_tokens: 64000,
        writing_temperature: 0.7,
        writing_max_tokens: 64000,
        image_size: "1024x1024",
        image_count: 3,
        meta_enabled: true,
        meta_model: "deepseek-chat",
        meta_temperature: 0.7,
        meta_max_tokens: 64000,
      });

    if (agentConfigError) {
      console.error("❌ 建立 agent 配置失敗:", agentConfigError);
      process.exit(1);
    }
    console.log("✓ Agent 配置已建立\n");
  } else {
    console.log("✓ Agent 配置已存在\n");
  }

  // 4. 直接建立文章任務（繞過 API 認證）
  const title = "AI時代的SEO應該怎麼做";
  console.log(`[生成] 開始生成文章: "${title}"\n`);

  const { v4: uuidv4 } = await import("uuid");
  const articleJobId = uuidv4();

  const { error: jobError } = await supabase.from("article_jobs").insert({
    id: articleJobId,
    job_id: articleJobId,
    company_id: company_id,
    website_id: websiteId,
    user_id: user_id,
    keywords: [title],
    status: "pending",
    metadata: {
      mode: "parallel",
      title: title,
    },
  });

  if (jobError) {
    console.error("❌ 建立文章任務失敗:", jobError);
    process.exit(1);
  }

  console.log("✓ 文章任務已建立\n");

  // 5. 觸發文章生成流程
  const { ParallelOrchestrator } = await import(
    "../src/lib/agents/orchestrator.js"
  );
  const orchestrator = new ParallelOrchestrator(supabase);

  console.log("[執行] 開始執行文章生成流程...\n");

  orchestrator
    .execute({
      articleJobId,
      companyId: company_id,
      websiteId,
      title,
    })
    .catch((error) => {
      console.error("❌ 文章生成錯誤:", error);
    });

  console.log("\n✅ 文章生成任務已啟動！");
  console.log(`   Job ID: ${articleJobId}`);
  console.log(`\n查看進度: http://localhost:3168/dashboard/articles\n`);
}

main().catch(console.error);
