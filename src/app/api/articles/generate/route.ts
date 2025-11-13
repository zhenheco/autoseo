import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

// Vercel 無伺服器函數最大執行時間：5 分鐘（Hobby 計劃上限）
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { keyword, title, mode } = await request.json();

    const articleTitle = title || keyword;

    if (!articleTitle || typeof articleTitle !== 'string') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // 支持兩種認證方式：
    // 1. Authorization header（用於 API/curl 請求）
    // 2. Cookies（用於瀏覽器請求）
    const authHeader = request.headers.get('authorization');
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
      const authClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // 使用 JWT token 獲取用戶信息
      const { data: userData, error: userError } = await authClient.auth.getUser(token);

      if (userError || !userData.user) {
        return NextResponse.json(
          { error: 'Invalid token', details: userError?.message },
          { status: 401 }
        );
      }

      user = userData.user;
    } else {
      const cookieClient = await createClient();
      const { data: { user: cookieUser } } = await cookieClient.auth.getUser();
      user = cookieUser;
    }

    // 使用 service role client 進行資料庫查詢（避免 RLS 問題）
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
          meta_model: 'deepseek-chat',
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

    const articleJobId = uuidv4();

    const { error: jobError } = await supabase
      .from('article_jobs')
      .insert({
        id: articleJobId,
        job_id: articleJobId,
        company_id: membership.company_id,
        website_id: websiteId,
        user_id: user.id,
        keywords: [articleTitle],
        status: 'pending',
        metadata: {
          mode: mode || 'single',
          title: articleTitle,
        },
      });

    if (jobError) {
      console.error('Failed to create article job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create article job' },
        { status: 500 }
      );
    }

    // 觸發 GitHub Actions 處理（避免 Vercel 5 分鐘超時）
    if (process.env.USE_GITHUB_ACTIONS === 'true') {
      try {
        const owner = 'acejou27';
        const repo = 'Auto-pilot-SEO';
        const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

        if (token) {
          // 觸發 GitHub Actions workflow
          const githubResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/dispatches`,
            {
              method: 'POST',
              headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
              },
              body: JSON.stringify({
                event_type: 'generate-article',
                client_payload: {
                  jobId: articleJobId,
                  title: articleTitle,
                  timestamp: new Date().toISOString(),
                }
              })
            }
          );

          if (githubResponse.status === 204) {
            console.log(`✅ GitHub Actions triggered for job: ${articleJobId}`);
            return NextResponse.json({
              success: true,
              articleJobId,
              message: 'Article generation triggered via GitHub Actions (no timeout limit)',
              processor: 'github-actions',
            });
          } else {
            console.error('Failed to trigger GitHub Actions:', githubResponse.status);
          }
        }
      } catch (githubError) {
        console.error('GitHub Actions trigger error:', githubError);
      }
    }

    // 預設：API 立即回傳，由 GitHub Actions cron job 處理
    // 避免 Vercel 函數逾時（DeepSeek reasoner 需要 4+ 分鐘）
    return NextResponse.json({
      success: true,
      articleJobId,
      message: 'Article generation job created, processing will be handled by cron job',
    });
  } catch (error) {
    console.error('Generate article error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
