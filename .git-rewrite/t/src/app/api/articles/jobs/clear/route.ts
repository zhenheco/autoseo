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
      console.log('[Clear Jobs] No user authenticated');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Clear Jobs] User:', user.id);

    const { data: membership, error: membershipError } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership) {
      console.log('[Clear Jobs] No active membership:', membershipError);
      return NextResponse.json({ error: 'No active company membership' }, { status: 403 });
    }

    console.log('[Clear Jobs] Company ID:', membership.company_id);

    // 先查詢所有非 completed 狀態的任務
    const { data: existingJobs, error: queryError } = await supabase
      .from('article_jobs')
      .select('id, status, keywords')
      .eq('company_id', membership.company_id)
      .neq('status', 'completed');

    console.log('[Clear Jobs] Found jobs to delete:', existingJobs?.length || 0);
    console.log('[Clear Jobs] Job statuses:', existingJobs?.map(j => ({ id: j.id.substring(0, 8), status: j.status })));

    if (queryError) {
      console.error('[Clear Jobs] Query error:', queryError);
    }

    // 如果沒有找到任何任務，提前返回
    if (!existingJobs || existingJobs.length === 0) {
      console.log('[Clear Jobs] No jobs found to delete');
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: '沒有找到需要清除的任務',
        diagnostic: {
          totalJobs: 0,
          queryConditions: `status != 'completed' AND company_id = '${membership.company_id}'`,
        },
      });
    }

    // 刪除所有非 completed 狀態的 jobs（包括 pending, processing, failed 等）
    const { data: deletedJobs, error } = await supabase
      .from('article_jobs')
      .delete()
      .eq('company_id', membership.company_id)
      .neq('status', 'completed')
      .select('id, status');

    if (error) {
      console.error('[Clear Jobs] Delete error:', error);
      return NextResponse.json({ error: 'Failed to clear jobs' }, { status: 500 });
    }

    const deletedCount = deletedJobs?.length || 0;
    console.log('[Clear Jobs] Successfully deleted:', deletedCount);
    console.log('[Clear Jobs] Deleted job IDs:', deletedJobs?.map(j => j.id.substring(0, 8)));

    // 驗證刪除數量與查詢數量是否一致
    if (deletedCount !== existingJobs.length) {
      console.warn(
        `[Clear Jobs] Mismatch: Found ${existingJobs.length} jobs but deleted ${deletedCount}`
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `已清除 ${deletedCount} 個任務`,
      deletedJobs: deletedJobs?.map(j => ({ id: j.id, status: j.status })),
    });
  } catch (error) {
    console.error('[Clear Jobs] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
