import { createClient } from "@supabase/supabase-js";

const DEFAULT_AGENT_CONFIG = {
  research_model: "deepseek-reasoner",
  complex_processing_model: "deepseek-reasoner",
  simple_processing_model: "deepseek-chat",
  image_model: "gemini-imagen",
  research_temperature: 0.7,
  research_max_tokens: 4000,
  image_size: "1024x1024",
  image_count: 3,
  meta_enabled: true,
};

async function fixMissingAgentConfigs() {
  console.log("開始修復缺少 agent_configs 的 website_configs 記錄...\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "缺少必要的環境變數 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data: allWebsites, error: websitesError } = await supabase
    .from("website_configs")
    .select("id, website_name, created_at")
    .order("created_at", { ascending: true });

  if (websitesError) {
    console.error("查詢 website_configs 失敗:", websitesError);
    return;
  }

  if (!allWebsites || allWebsites.length === 0) {
    console.log("沒有找到任何 website_configs 記錄");
    return;
  }

  console.log(`找到 ${allWebsites.length} 個 website_configs 記錄\n`);

  const missingAgentConfigs = [];
  const hasAgentConfigs = [];

  for (const website of allWebsites) {
    const { data: agentConfig, error: queryError } = await supabase
      .from("agent_configs")
      .select("id")
      .eq("website_id", website.id)
      .single();

    if (queryError && queryError.code === "PGRST116") {
      missingAgentConfigs.push(website);
    } else if (!queryError && agentConfig) {
      hasAgentConfigs.push(website.id);
    }
  }

  console.log(`已存在 agent_configs 的網站: ${hasAgentConfigs.length} 個`);
  console.log(`缺少 agent_configs 的網站: ${missingAgentConfigs.length} 個\n`);

  if (missingAgentConfigs.length === 0) {
    console.log("所有網站都已有 agent_configs 配置");
    return;
  }

  console.log("開始為缺少的網站創建 agent_configs...\n");

  let successCount = 0;
  let failureCount = 0;

  for (const website of missingAgentConfigs) {
    try {
      const { error: insertError } = await supabase
        .from("agent_configs")
        .insert({
          website_id: website.id,
          ...DEFAULT_AGENT_CONFIG,
        });

      if (insertError) {
        console.error(
          `❌ [${website.id}] 創建失敗 (${website.website_name}):`,
          insertError.message,
        );
        failureCount++;
      } else {
        console.log(`✓ [${website.id}] 創建成功 (${website.website_name})`);
        successCount++;
      }
    } catch (error) {
      console.error(
        `❌ [${website.id}] 異常 (${website.website_name}):`,
        error,
      );
      failureCount++;
    }
  }

  console.log("\n修復結果統計:");
  console.log(`✓ 成功: ${successCount}`);
  console.log(`❌ 失敗: ${failureCount}`);
  console.log(`總計: ${successCount + failureCount}`);

  if (failureCount === 0) {
    console.log("\n所有 website_configs 都已修復!");
  } else {
    console.log(`\n仍有 ${failureCount} 個修復失敗，請檢查錯誤信息`);
  }
}

fixMissingAgentConfigs().catch((error) => {
  console.error("修復過程出錯:", error);
  process.exit(1);
});
