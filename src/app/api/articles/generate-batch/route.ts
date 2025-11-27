import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";

// Vercel 無伺服器函數最大執行時間（異步模式：立即返回，無需長時間執行）
export const maxDuration = 10; // 10 秒足夠（實際 < 1 秒）

export async function POST(request: NextRequest) {
  try {
    const { keywords, items, options, website_id } = await request.json();

    const generationItems =
      items ||
      keywords?.map((kw: string) => ({ keyword: kw, title: kw })) ||
      [];

    if (!generationItems || generationItems.length === 0) {
      return NextResponse.json(
        { error: "Items or keywords array is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 嘗試獲取 company_id（如果用戶有加入公司）
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    let billingId = membership?.company_id;

    // 如果沒有公司，檢查是否已有用戶擁有的公司或自動創建個人公司
    if (!billingId) {
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", user.id)
        .single();

      if (existingCompany) {
        billingId = existingCompany.id;
      } else {
        // 創建個人公司
        const baseSlug = slugify(user.email?.split("@")[0] || "user", {
          lower: true,
          strict: true,
        });
        const uniqueSlug = `${baseSlug}-${Date.now()}`;

        const { data: newCompany, error: companyError } = await supabase
          .from("companies")
          .insert({
            name: user.email?.split("@")[0] || "個人用戶",
            slug: uniqueSlug,
            owner_id: user.id,
          })
          .select("id")
          .single();

        if (companyError || !newCompany) {
          console.error("Failed to create personal company:", companyError);
          return NextResponse.json(
            { error: "無法建立用戶帳戶，請聯繫客服" },
            { status: 500 },
          );
        }

        // 將用戶加入公司成員
        await supabase.from("company_members").insert({
          company_id: newCompany.id,
          user_id: user.id,
          role: "owner",
          status: "active",
        });

        billingId = newCompany.id;
        console.log(`[Batch] ✅ Created personal company for user: ${user.id}`);
      }
    }

    // 優先使用傳入的 website_id
    let websiteId: string | null = website_id || null;

    if (!websiteId) {
      const websiteQuery = await supabase
        .from("website_configs")
        .select("id")
        .eq("company_id", billingId)
        .limit(1);

      let websites = websiteQuery.data;
      const websiteError = websiteQuery.error;

      if ((!websites || websites.length === 0) && !websiteError) {
        console.log("Creating default website config for:", billingId);
        const { data: newWebsite, error: createError } = await supabase
          .from("website_configs")
          .insert({
            company_id: billingId,
            website_name: "",
            wordpress_url: "",
          })
          .select("id")
          .single();

        if (createError || !newWebsite) {
          console.error("Failed to create website config:", createError);
          return NextResponse.json(
            { error: "Failed to create website configuration" },
            { status: 500 },
          );
        }

        const { error: agentConfigError } = await supabase
          .from("agent_configs")
          .insert({
            website_id: newWebsite.id,
            research_model: "deepseek-reasoner",
            complex_processing_model: "deepseek-reasoner",
            simple_processing_model: "deepseek-chat",
            image_model: "gpt-image-1-mini",
            research_temperature: 0.7,
            research_max_tokens: 64000,
            strategy_temperature: 0.7,
            strategy_max_tokens: 64000,
            writing_temperature: 0.7,
            writing_max_tokens: 64000,
            image_size: "1024x1024",
            image_count: 3,
            meta_enabled: true,
            meta_temperature: 0.7,
            meta_max_tokens: 64000,
          });

        if (agentConfigError) {
          console.error("Failed to create agent config:", agentConfigError);
          return NextResponse.json(
            {
              error: "Failed to create agent configuration",
              details: agentConfigError.message,
            },
            { status: 500 },
          );
        }

        websites = [newWebsite];
      }

      if (!websites || websites.length === 0) {
        console.error("Website error:", websiteError);
        return NextResponse.json(
          { error: "No website configured" },
          { status: 404 },
        );
      }

      websiteId = websites[0].id;
    } else {
      console.log("使用指定網站:", websiteId);
    }

    const newJobIds: string[] = [];
    const skippedJobIds: string[] = [];
    const failedItems: string[] = [];

    // 批次生成模式：直接執行，實作冪等性檢查
    for (const item of generationItems) {
      const keyword = item.keyword || item.title;
      const title = item.title || item.keyword;

      // 生成 base slug（不含時間戳，用於查詢）
      const baseSlug = slugify(title, {
        lower: true,
        strict: true,
        locale: "zh",
      });

      // 檢查是否已存在相同標題的 pending/processing 任務
      const { data: existingJobs } = await supabase
        .from("article_jobs")
        .select("id, status")
        .eq("company_id", billingId)
        .ilike("slug", `${baseSlug}%`)
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: false })
        .limit(1);

      // 如果存在未完成的任務，跳過創建並記錄 ID
      if (existingJobs && existingJobs.length > 0) {
        const existingJob = existingJobs[0];
        skippedJobIds.push(existingJob.id);
        console.log(
          `[Batch] ⏭️  Skipping duplicate job: ${title} (existing: ${existingJob.id}, status: ${existingJob.status})`,
        );
        continue;
      }

      // 創建新任務
      const articleJobId = uuidv4();
      const timestamp = Date.now();
      const uniqueSlug = `${baseSlug}-${timestamp}`;

      const { error: jobError } = await supabase.from("article_jobs").insert({
        id: articleJobId,
        job_id: articleJobId,
        company_id: billingId,
        website_id: websiteId,
        user_id: user.id,
        keywords: [keyword],
        status: "pending",
        slug: uniqueSlug,
        metadata: {
          mode: "batch",
          title,
          batchIndex: generationItems.indexOf(item),
          totalBatch: generationItems.length,
          targetLanguage: options?.targetLanguage || "zh-TW",
          wordCount: options?.wordCount || "1500",
        },
      });

      if (jobError) {
        console.error("Failed to create article job:", jobError);
        failedItems.push(title);
        continue;
      }

      newJobIds.push(articleJobId);
      console.log(`[Batch] ✅ Article job queued: ${title}`);
    }

    // 合併所有 job ID（新建立 + 跳過的）
    const allJobIds = [...newJobIds, ...skippedJobIds];

    // 只有新建立的 job 才需要觸發 GitHub Actions
    if (newJobIds.length > 0) {
      try {
        const githubToken = process.env.GITHUB_TOKEN;
        if (githubToken) {
          const response = await fetch(
            "https://api.github.com/repos/acejou27/Auto-pilot-SEO/dispatches",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${githubToken}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                event_type: "article-jobs-created",
                client_payload: {
                  jobCount: newJobIds.length,
                  jobIds: newJobIds,
                  timestamp: new Date().toISOString(),
                },
              }),
            },
          );

          if (response.ok) {
            console.log(
              `[Batch] ✅ Triggered GitHub Actions workflow for ${newJobIds.length} jobs`,
            );
          } else {
            console.error(
              "[Batch] ⚠️  Failed to trigger workflow:",
              response.status,
              await response.text(),
            );
          }
        } else {
          console.log(
            "[Batch] ⚠️  GITHUB_TOKEN not configured, workflow will run on schedule",
          );
        }
      } catch (dispatchError) {
        console.error("[Batch] ⚠️  Error triggering workflow:", dispatchError);
      }
    }

    // 判斷是否成功：至少要有新建立的 job 或跳過的 job（代表任務已在處理中）
    const hasJobs = allJobIds.length > 0;
    const allFailed =
      failedItems.length > 0 &&
      newJobIds.length === 0 &&
      skippedJobIds.length === 0;

    if (allFailed) {
      return NextResponse.json(
        {
          success: false,
          error: "所有文章任務建立失敗",
          failedItems,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: hasJobs,
      jobIds: allJobIds,
      newJobs: newJobIds.length,
      skippedJobs: skippedJobIds.length,
      failedJobs: failedItems.length,
      failedItems,
      message:
        newJobIds.length > 0
          ? `已建立 ${newJobIds.length} 個新任務${skippedJobIds.length > 0 ? `，${skippedJobIds.length} 個已在處理中` : ""}`
          : `${skippedJobIds.length} 個任務已在處理中`,
      polling: {
        statusUrl: "/api/articles/status/[jobId]",
        recommendedInterval: 60000,
      },
    });
  } catch (error) {
    console.error("Batch generate error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
