import { SupabaseClient } from '@supabase/supabase-js';
import { ParallelOrchestrator } from '../agents/orchestrator';

interface BatchConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerDay: number;
  delayBetweenBatches: number;
}

interface JobQueue {
  id: string;
  website_id: string;
  company_id: string;
  keywords: string[];
  region: string;
  priority: number;
  scheduled_at: string;
}

export class BatchProcessor {
  private supabase: SupabaseClient;
  private config: BatchConfig;
  private requestCount: { minute: number; day: number; lastReset: { minute: Date; day: Date } };

  constructor(supabase: SupabaseClient, config?: Partial<BatchConfig>) {
    this.supabase = supabase;
    this.config = {
      maxRequestsPerMinute: config?.maxRequestsPerMinute ?? 15,
      maxRequestsPerDay: config?.maxRequestsPerDay ?? 800,
      delayBetweenBatches: config?.delayBetweenBatches ?? 4000,
    };
    this.requestCount = {
      minute: 0,
      day: 0,
      lastReset: {
        minute: new Date(),
        day: new Date(),
      },
    };
  }

  private resetCountersIfNeeded(): void {
    const now = new Date();

    if (now.getTime() - this.requestCount.lastReset.minute.getTime() > 60000) {
      this.requestCount.minute = 0;
      this.requestCount.lastReset.minute = now;
      console.log('[BatchProcessor] Minute counter reset');
    }

    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastDayStart = new Date(
      this.requestCount.lastReset.day.getFullYear(),
      this.requestCount.lastReset.day.getMonth(),
      this.requestCount.lastReset.day.getDate()
    );

    if (dayStart.getTime() > lastDayStart.getTime()) {
      this.requestCount.day = 0;
      this.requestCount.lastReset.day = now;
      console.log('[BatchProcessor] Day counter reset');
    }
  }

  private async canMakeRequest(): Promise<boolean> {
    this.resetCountersIfNeeded();
    return (
      this.requestCount.minute < this.config.maxRequestsPerMinute &&
      this.requestCount.day < this.config.maxRequestsPerDay
    );
  }

  private async waitForRateLimit(): Promise<void> {
    while (!(await this.canMakeRequest())) {
      const now = new Date();
      const nextMinute = new Date(this.requestCount.lastReset.minute.getTime() + 60000);
      const waitTime = Math.max(1000, nextMinute.getTime() - now.getTime());

      console.log(`[BatchProcessor] Rate limit reached. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.resetCountersIfNeeded();
    }
  }

  private incrementCounters(): void {
    this.requestCount.minute++;
    this.requestCount.day++;
  }

  async processPendingJobs(limit: number = 10): Promise<void> {
    console.log('[BatchProcessor] Starting batch processing...');
    console.log(`[BatchProcessor] Rate limits: ${this.config.maxRequestsPerMinute}/min, ${this.config.maxRequestsPerDay}/day`);

    const { data: jobs, error } = await this.supabase
      .from('article_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[BatchProcessor] Failed to fetch jobs:', error);
      return;
    }

    if (!jobs || jobs.length === 0) {
      console.log('[BatchProcessor] No pending jobs found');
      return;
    }

    console.log(`[BatchProcessor] Found ${jobs.length} pending jobs`);

    for (const job of jobs) {
      try {
        await this.waitForRateLimit();

        console.log(`\n[BatchProcessor] Processing job ${job.id}...`);
        console.log(`[BatchProcessor] Current usage: ${this.requestCount.minute}/min, ${this.requestCount.day}/day`);

        await this.supabase
          .from('article_jobs')
          .update({ status: 'processing' })
          .eq('id', job.id);

        const orchestrator = new ParallelOrchestrator(this.supabase);

        const result = await orchestrator.execute({
          articleJobId: job.id,
          websiteId: job.website_id,
          companyId: job.company_id,
          keyword: job.keywords[0],
          region: job.region || 'en-US',
        });

        this.incrementCounters();

        if (result.success) {
          console.log(`[BatchProcessor] ✅ Job ${job.id} completed successfully`);
        } else {
          console.log(`[BatchProcessor] ⚠️  Job ${job.id} completed with quality issues`);
        }

        await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenBatches));

      } catch (error) {
        console.error(`[BatchProcessor] ❌ Job ${job.id} failed:`, error);

        if (error instanceof Error && error.message.includes('rate-limited')) {
          console.log('[BatchProcessor] Rate limit hit, will retry in next batch');
          await this.supabase
            .from('article_jobs')
            .update({ status: 'pending' })
            .eq('id', job.id);

          await new Promise(resolve => setTimeout(resolve, 60000));
        } else {
          await this.supabase
            .from('article_jobs')
            .update({ status: 'failed', metadata: { error: error instanceof Error ? error.message : String(error) } })
            .eq('id', job.id);
        }
      }
    }

    console.log('\n[BatchProcessor] Batch processing completed');
    console.log(`[BatchProcessor] Final usage: ${this.requestCount.minute}/min, ${this.requestCount.day}/day`);
  }

  async scheduleJob(job: {
    website_id: string;
    company_id: string;
    keywords: string[];
    region?: string;
    priority?: number;
    scheduled_at?: Date;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('article_jobs')
      .insert({
        website_id: job.website_id,
        company_id: job.company_id,
        keywords: job.keywords,
        region: job.region || 'en-US',
        priority: job.priority ?? 5,
        status: 'pending',
        metadata: {
          scheduled_at: job.scheduled_at?.toISOString() || new Date().toISOString(),
        },
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async getRemainingQuota(): Promise<{ minute: number; day: number }> {
    this.resetCountersIfNeeded();
    return {
      minute: this.config.maxRequestsPerMinute - this.requestCount.minute,
      day: this.config.maxRequestsPerDay - this.requestCount.day,
    };
  }
}
