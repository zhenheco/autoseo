import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";
import { ArticleQuotaService } from "@/lib/billing/article-quota-service";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rate-limiter";

// Vercel 無伺服器函數最大執行時間（增加以避免 504 超時）
export const maxDuration = 25; // 增加到 25 秒

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywords, items, options, website_id } = body;
    const hasWebsiteIdField = "website_id" in body;

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

    // 輸入驗證：限制批量大小
    const MAX_BATCH_SIZE = 20;
    if (generationItems.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `批量生成最多 ${MAX_BATCH_SIZE} 篇文章` },
        { status: 400 },
      );
    }

    // 輸入驗證：檢查每個 keyword 的長度
    const MAX_KEYWORD_LENGTH = 500;
    for (const item of generationItems) {
      const keyword = item.keyword || item.title;
      if (!keyword || typeof keyword !== "string") {
        return NextResponse.json(
          { error: "每個項目都必須包含 keyword 或 title" },
          { status: 400 },
        );
      }
      if (keyword.length > MAX_KEYWORD_LENGTH) {
        return NextResponse.json(
          { error: `關鍵字長度不能超過 ${MAX_KEYWORD_LENGTH} 字元` },
          { status: 400 },
        );
      }
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting 檢查
    const rateLimitResponse = await checkRateLimit(
      `generate-batch:${user.id}`,
      RATE_LIMIT_CONFIGS.ARTICLE_GENERATE_BATCH,
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 使用 Admin Client 繞過 RLS 進行公司/成員操作
    const adminClient = createAdminClient();

    // 嘗試獲取 company_id（如果用戶有加入公司）
    const { data: membership } = await adminClient
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    let billingId: string | undefined = membership?.company_id;

    // 驗證 company_id 是否真的存在於 companies 表
    if (billingId) {
      const { data: companyExists } = await adminClient
        .from("companies")
        .select("id")
        .eq("id", billingId)
        .single();

      if (!companyExists) {
        console.log(
          `[Batch] ⚠️ Company ${billingId} not found, will create new one`,
        );
        billingId = undefined;
      }
    }

    // 如果沒有有效的公司，檢查是否已有用戶擁有的公司或自動創建個人公司
    if (!billingId) {
      const { data: existingCompany } = await adminClient
        .from("companies")
        .select("id")
        .eq("owner_id", user.id)
        .single();

      if (existingCompany) {
        billingId = existingCompany.id;
      } else {
        // 創建個人公司（使用 Admin Client 繞過 RLS）
        const baseSlug = slugify(user.email?.split("@")[0] || "user", {
          lower: true,
          strict: true,
        });
        const uniqueSlug = `${baseSlug}-${Date.now()}`;

        const { data: newCompany, error: companyError } = await adminClient
          .from("companies")
          .insert({
            name: user.email?.split("@")[0] || "個人用戶",
            slug: uniqueSlug,
            owner_id: user.id,
          })
          .select("id")
          .single();

        if (companyError || !newCompany) {
          console.error("[Batch] Failed to create company:", companyError);
          return NextResponse.json(
            { error: "無法建立用戶帳戶", details: companyError?.message },
            { status: 500 },
          );
        }

        billingId = newCompany.id;
        console.log(`[Batch] ✅ Created company: ${billingId}`);
      }

      // 更新或創建 company_members 記錄（使用 Admin Client）
      const { error: memberError } = await adminClient
        .from("company_members")
        .upsert(
          {
            company_id: billingId,
            user_id: user.id,
            role: "owner",
            status: "active",
          },
          {
            onConflict: "company_id,user_id",
          },
        );

      if (memberError) {
        console.error("[Batch] Failed to upsert member:", memberError);
      }
    }

    // 處理 website_id：
    // - 如果 body 中包含 website_id 欄位（即使是 null），則使用該值
    // - 如果 body 中沒有 website_id 欄位，則自動查詢或創建網站
    let websiteId: string | null = website_id || null;

    if (hasWebsiteIdField) {
      if (websiteId) {
        console.log("[Batch] 使用指定網站:", websiteId);
      } else {
        console.log("[Batch] 用戶選擇不指定網站");
      }
    } else {
      const websiteQuery = await adminClient
        .from("website_configs")
        .select("id")
        .eq("company_id", billingId)
        .limit(1);

      let websites = websiteQuery.data;
      const websiteError = websiteQuery.error;

      if ((!websites || websites.length === 0) && !websiteError) {
        console.log("[Batch] Creating default website config for:", billingId);
        const { data: newWebsite, error: createError } = await adminClient
          .from("website_configs")
          .insert({
            company_id: billingId,
            website_name: "",
            wordpress_url: "",
          })
          .select("id")
          .single();

        if (createError || !newWebsite) {
          console.error(
            "[Batch] Failed to create website config:",
            createError,
          );
          return NextResponse.json(
            {
              error: "Failed to create website configuration",
              details: createError?.message,
            },
            { status: 500 },
          );
        }

        const { error: agentConfigError } = await adminClient
          .from("agent_configs")
          .insert({
            website_id: newWebsite.id,
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
            meta_temperature: 0.7,
            meta_max_tokens: 64000,
          });

        if (agentConfigError) {
          console.error(
            "[Batch] Failed to create agent config:",
            agentConfigError,
          );
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
        console.error("[Batch] Website error:", websiteError);
        return NextResponse.json(
          { error: "No website configured" },
          { status: 404 },
        );
      }

      websiteId = websites[0].id;
      console.log("[Batch] 自動使用現有網站配置:", websiteId);
    }

    // ===== 配額檢查：確保有足夠的篇數額度 =====
    // 此時 billingId 一定有值（前面邏輯會創建公司）
    const quotaService = new ArticleQuotaService(adminClient);
    const requiredArticles = generationItems.length; // 篇數制：1 篇 = 1 額度
    const quotaCheck = await quotaService.hasEnoughQuota(
      billingId!,
      requiredArticles,
    );

    if (!quotaCheck.sufficient) {
      const maxArticles = quotaCheck.balance.totalAvailable;
      console.log(
        `[Batch] ❌ 額度不足: 需要 ${requiredArticles} 篇, 可用 ${maxArticles} 篇`,
      );
      return NextResponse.json(
        {
          error: "Insufficient balance",
          message: `額度不足：需要 ${requiredArticles} 篇，可用 ${maxArticles} 篇`,
          requiredCredits: requiredArticles, // 保留舊的欄位名稱，供前端兼容
          availableCredits: maxArticles, // 保留舊的欄位名稱，供前端兼容
          maxArticles,
        },
        { status: 402 },
      );
    }

    console.log(
      `[Batch] ✅ 配額檢查通過: 需要 ${requiredArticles} 篇, 可用 ${quotaCheck.balance.totalAvailable} 篇`,
    );

    const newJobIds: string[] = [];
    const skippedJobIds: string[] = [];
    const failedItems: string[] = [];

    // ===== 優化：批量查詢現有任務（1 次查詢取代 N 次）=====
    const { data: allPendingJobs } = await adminClient
      .from("article_jobs")
      .select("id, keywords")
      .eq("company_id", billingId)
      .in("status", ["pending", "processing"]);

    // 建立 Set 快速查找已存在的關鍵字
    const existingKeywordToJobId = new Map<string, string>();
    allPendingJobs?.forEach((job) => {
      const keywords = job.keywords as string[] | null;
      keywords?.forEach((kw: string) => {
        existingKeywordToJobId.set(kw, job.id);
      });
    });

    // ===== 優化：準備所有要插入的任務 =====
    const jobsToInsert: Array<{
      id: string;
      job_id: string;
      company_id: string;
      website_id: string | null;
      user_id: string;
      keywords: string[];
      status: string;
      metadata: Record<string, unknown>;
    }> = [];

    for (let i = 0; i < generationItems.length; i++) {
      const item = generationItems[i];
      const keyword = item.keyword || item.title;
      const title = item.title || item.keyword;

      // 檢查是否已存在相同關鍵字的任務
      const existingJobId = existingKeywordToJobId.get(keyword);
      if (existingJobId) {
        skippedJobIds.push(existingJobId);
        console.log(
          `[Batch] ⏭️  Skipping duplicate job: ${title} (existing: ${existingJobId})`,
        );
        continue;
      }

      // 準備新任務
      const articleJobId = uuidv4();
      jobsToInsert.push({
        id: articleJobId,
        job_id: articleJobId,
        company_id: billingId!,
        website_id: websiteId,
        user_id: user.id,
        keywords: [keyword],
        status: "pending",
        metadata: {
          mode: "batch",
          title,
          batchIndex: i,
          totalBatch: generationItems.length,
          targetLanguage: options?.targetLanguage || "zh-TW",
          wordCount: options?.wordCount || "1500",
        },
      });
    }

    // ===== 優化：分批插入（每批 20 筆）=====
    const BATCH_SIZE = 20;
    for (let i = 0; i < jobsToInsert.length; i += BATCH_SIZE) {
      const batch = jobsToInsert.slice(i, i + BATCH_SIZE);
      const { data: inserted, error: batchError } = await adminClient
        .from("article_jobs")
        .insert(batch)
        .select("id");

      if (inserted) {
        newJobIds.push(...inserted.map((j) => j.id));
        console.log(
          `[Batch] ✅ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${inserted.length} jobs`,
        );
      }
      if (batchError) {
        console.error(
          `[Batch] ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
          batchError,
        );
        // 記錄失敗的項目
        batch.forEach((job) => {
          const title =
            (job.metadata as Record<string, unknown>)?.title || job.keywords[0];
          failedItems.push(title as string);
        });
      }
    }

    console.log(
      `[Batch] 📊 Summary: ${newJobIds.length} created, ${skippedJobIds.length} skipped, ${failedItems.length} failed`,
    );

    // 合併所有 job ID（新建立 + 跳過的）
    const allJobIds = [...newJobIds, ...skippedJobIds];

    // 只有新建立的 job 才需要觸發 GitHub Actions
    if (newJobIds.length > 0) {
      try {
        const githubToken = process.env.GITHUB_TOKEN;
        const githubOwner = process.env.GITHUB_REPO_OWNER;
        const githubRepo = process.env.GITHUB_REPO_NAME;

        if (githubToken && githubOwner && githubRepo) {
          // 使用 AbortController 設定 5 秒超時（避免阻塞過久導致 504）
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          try {
            const response = await fetch(
              `https://api.github.com/repos/${githubOwner}/${githubRepo}/dispatches`,
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
                signal: controller.signal,
              },
            );
            clearTimeout(timeoutId);

            if (response.ok) {
              console.log(
                `[Batch] ✅ Triggered GitHub Actions workflow for ${newJobIds.length} jobs`,
              );
            } else {
              const errorText = await response.text();
              console.warn(
                `[Batch] ⚠️ Workflow trigger failed: ${response.status}`,
                errorText,
              );
              // 不刪除 jobs，讓定時任務處理
            }
          } catch (fetchError) {
            clearTimeout(timeoutId);
            if (
              fetchError instanceof Error &&
              fetchError.name === "AbortError"
            ) {
              console.warn(
                "[Batch] ⚠️ GitHub API timeout (5s), jobs will be processed by scheduler",
              );
            } else {
              console.error("[Batch] ❌ Trigger error:", fetchError);
            }
            // 不刪除 jobs，讓定時任務處理
          }
        } else {
          console.log(
            "[Batch] ⚠️  GitHub configuration incomplete (GITHUB_TOKEN, GITHUB_REPO_OWNER, or GITHUB_REPO_NAME missing), workflow will run on schedule",
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
