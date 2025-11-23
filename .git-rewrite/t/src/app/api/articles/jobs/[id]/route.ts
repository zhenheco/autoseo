import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

/**
 * DELETE /api/articles/jobs/[id]
 * 刪除單個 article_job
 */
export async function DELETE(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No active company membership' }, { status: 403 });
    }

    // 刪除任務（確保只能刪除自己公司的任務）
    const { error } = await supabase
      .from('article_jobs')
      .delete()
      .eq('id', id)
      .eq('company_id', membership.company_id);

    if (error) {
      console.error('Failed to delete job:', error);
      return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '任務已刪除',
    });
  } catch (error) {
    console.error('Delete job error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
