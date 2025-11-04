import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * DELETE /api/articles/jobs/clear
 * 清除所有 pending 和 processing 狀態的 article_jobs
 */
export async function DELETE() {
  try {
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

    // 刪除所有 pending 和 processing 狀態的 jobs
    const { data: deletedJobs, error } = await supabase
      .from('article_jobs')
      .delete()
      .eq('company_id', membership.company_id)
      .in('status', ['pending', 'processing'])
      .select('id');

    if (error) {
      console.error('Failed to clear jobs:', error);
      return NextResponse.json({ error: 'Failed to clear jobs' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedCount: deletedJobs?.length || 0,
      message: `已清除 ${deletedJobs?.length || 0} 個任務`,
    });
  } catch (error) {
    console.error('Clear jobs error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
