import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';

// Vercel 無伺服器函數最大執行時間（異步模式：立即返回，無需長時間執行）
export const maxDuration = 10; // 10 秒足夠（實際 < 1 秒）

export async function POST(request: NextRequest) {
  try {
    const { keywords, items, options } = await request.json();

    const generationItems = items || keywords?.map((kw: string) => ({ keyword: kw, title: kw })) || [];

    if (!generationItems || generationItems.length === 0) {
      return NextResponse.json(
        { error: 'Items or keywords array is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!membership || membershipError) {
      console.error('Membership error:', membershipError);
      return NextResponse.json(
        { error: 'No active company membership' },
        { status: 403 }
      );
    }

    const websiteQuery = await supabase
      .from('website_configs')
      .select('id')
      .eq('company_id', membership.company_id)
      .limit(1);

    let websites = websiteQuery.data;
    const websiteError = websiteQuery.error;

    if ((!websites || websites.length === 0) && !websiteError) {
      console.log('Creating default website config for company:', membership.company_id);
      const { data: newWebsite, error: createError } = await supabase
        .from('website_configs')
        .insert({
          company_id: membership.company_id,
          website_name: '',
          wordpress_url: '',
        })
        .select('id')
        .single();

      if (createError || !newWebsite) {
        console.error('Failed to create website config:', createError);
        return NextResponse.json(
          { error: 'Failed to create website configuration' },
          { status: 500 }
        );
      }

      const { error: agentConfigError } = await supabase
        .from('agent_configs')
        .insert({
          website_id: newWebsite.id,
          research_model: 'deepseek-reasoner',
          complex_processing_model: 'deepseek-reasoner',
          simple_processing_model: 'deepseek-chat',
          image_model: 'gpt-image-1-mini',
          research_temperature: 0.7,
          research_max_tokens: 64000,
          strategy_temperature: 0.7,
          strategy_max_tokens: 64000,
          writing_temperature: 0.7,
          writing_max_tokens: 64000,
          image_size: '1024x1024',
          image_count: 3,
          meta_enabled: true,
          meta_temperature: 0.7,
          meta_max_tokens: 64000,
        });

      if (agentConfigError) {
        console.error('Failed to create agent config:', agentConfigError);
        return NextResponse.json(
          { error: 'Failed to create agent configuration', details: agentConfigError.message },
          { status: 500 }
        );
      }

      websites = [newWebsite];
    }

    if (!websites || websites.length === 0) {
      console.error('Website error:', websiteError);
      return NextResponse.json(
        { error: 'No website configured' },
        { status: 404 }
      );
    }

    const websiteId = websites[0].id;

    const jobIds: string[] = [];
    const failedItems: string[] = [];

    // 批次生成模式：直接執行，實作冪等性檢查
    for (const item of generationItems) {
      const keyword = item.keyword || item.title;
      const title = item.title || item.keyword;

      // 生成 base slug（不含時間戳，用於查詢）
      const baseSlug = slugify(title, {
        lower: true,
        strict: true,
        locale: 'zh',
      });

      // 檢查是否已存在相同標題的 pending/processing 任務
      const { data: existingJobs } = await supabase
        .from('article_jobs')
        .select('id, status')
        .eq('company_id', membership.company_id)
        .ilike('slug', `${baseSlug}%`)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1);

      // 如果存在未完成的任務，跳過創建並記錄 ID
      if (existingJobs && existingJobs.length > 0) {
        const existingJob = existingJobs[0];
        jobIds.push(existingJob.id);
        console.log(`[Batch] ⏭️  Skipping duplicate job: ${title} (existing: ${existingJob.id}, status: ${existingJob.status})`);
        continue;
      }

      // 創建新任務
      const articleJobId = uuidv4();
      const timestamp = Date.now();
      const uniqueSlug = `${baseSlug}-${timestamp}`;

      const { error: jobError } = await supabase
        .from('article_jobs')
        .insert({
          id: articleJobId,
          job_id: articleJobId,
          company_id: membership.company_id,
          website_id: websiteId,
          user_id: user.id,
          keywords: [keyword],
          status: 'pending',
          slug: uniqueSlug,
          metadata: {
            mode: 'batch',
            title,
            batchIndex: generationItems.indexOf(item),
            totalBatch: generationItems.length,
            targetLanguage: options?.targetLanguage || 'zh-TW',
            wordCount: options?.wordCount || '1500',
          },
        });

      if (jobError) {
        console.error('Failed to create article job:', jobError);
        failedItems.push(title);
        continue;
      }

      jobIds.push(articleJobId);
      console.log(`[Batch] ✅ Article job queued: ${title}`);
    }

    // 觸發 GitHub Actions workflow 立即處理任務
    if (jobIds.length > 0) {
      try {
        const githubToken = process.env.GITHUB_TOKEN;
        if (githubToken) {
          const response = await fetch(
            'https://api.github.com/repos/acejou27/Auto-pilot-SEO/dispatches',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                event_type: 'article-jobs-created',
                client_payload: {
                  jobCount: jobIds.length,
                  jobIds: jobIds,
                  timestamp: new Date().toISOString(),
                },
              }),
            }
          );

          if (response.ok) {
            console.log(`[Batch] ✅ Triggered GitHub Actions workflow for ${jobIds.length} jobs`);
          } else {
            console.error('[Batch] ⚠️  Failed to trigger workflow:', response.status, await response.text());
          }
        } else {
          console.log('[Batch] ⚠️  GITHUB_TOKEN not configured, workflow will run on schedule');
        }
      } catch (dispatchError) {
        console.error('[Batch] ⚠️  Error triggering workflow:', dispatchError);
      }
    }

    return NextResponse.json({
      success: true,
      jobIds,
      totalJobs: jobIds.length,
      failedJobs: failedItems.length,
      failedItems,
      message: 'Article generation jobs queued. Use /api/articles/status/[jobId] to check progress.',
      polling: {
        statusUrl: '/api/articles/status/[jobId]',
        recommendedInterval: 60000, // 60 秒
      },
    });
  } catch (error) {
    console.error('Batch generate error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
