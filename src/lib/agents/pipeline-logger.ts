export interface PhaseLog {
  phase: string;
  status: "started" | "completed" | "failed" | "skipped";
  startTime: string;
  endTime?: string;
  durationMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    model: string;
  };
  metrics?: Record<string, number | string>;
}

export interface PipelineExecutionLog {
  jobId: string;
  keyword: string;
  companyId: string;
  userId?: string;
  startTime: string;
  endTime?: string;
  totalDurationMs?: number;
  status: "running" | "completed" | "failed";
  currentPhase?: string;
  phases: PhaseLog[];
  finalError?: string;
  summary?: {
    totalTokens: number;
    totalCost?: number;
    successfulPhases: number;
    failedPhases: number;
  };
}

export interface PipelineLoggerOptions {
  jobId: string;
  keyword: string;
  companyId: string;
  userId?: string;
  enableDatabaseSync?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSupabase?: () => Promise<any>;
}

export class PipelineLogger {
  private log: PipelineExecutionLog;
  private options: PipelineLoggerOptions;
  private syncInterval?: ReturnType<typeof setInterval>;

  constructor(options: PipelineLoggerOptions) {
    this.options = options;
    this.log = {
      jobId: options.jobId,
      keyword: options.keyword,
      companyId: options.companyId,
      userId: options.userId,
      startTime: new Date().toISOString(),
      status: "running",
      phases: [],
    };

    if (options.enableDatabaseSync && options.getSupabase) {
      this.startPeriodicSync();
    }
  }

  startPhase(phase: string, input?: Record<string, unknown>): void {
    const phaseLog: PhaseLog = {
      phase,
      status: "started",
      startTime: new Date().toISOString(),
      input: input ? this.sanitizeForLog(input) : undefined,
    };

    this.log.phases.push(phaseLog);
    this.log.currentPhase = phase;

    console.log(`[PipelineLogger] ▶️ Phase started: ${phase}`);
  }

  completePhase(
    phase: string,
    output?: Record<string, unknown>,
    tokenUsage?: PhaseLog["tokenUsage"],
    metrics?: Record<string, number | string>,
  ): void {
    const phaseLog = this.findPhase(phase);
    if (!phaseLog) {
      console.warn(`[PipelineLogger] Phase not found: ${phase}`);
      return;
    }

    const endTime = new Date();
    phaseLog.status = "completed";
    phaseLog.endTime = endTime.toISOString();
    phaseLog.durationMs =
      endTime.getTime() - new Date(phaseLog.startTime).getTime();
    phaseLog.output = output ? this.sanitizeForLog(output) : undefined;
    phaseLog.tokenUsage = tokenUsage;
    phaseLog.metrics = metrics;

    console.log(
      `[PipelineLogger] ✅ Phase completed: ${phase} (${phaseLog.durationMs}ms)`,
    );
  }

  failPhase(phase: string, error: string): void {
    const phaseLog = this.findPhase(phase);
    if (!phaseLog) {
      console.warn(`[PipelineLogger] Phase not found: ${phase}`);
      return;
    }

    const endTime = new Date();
    phaseLog.status = "failed";
    phaseLog.endTime = endTime.toISOString();
    phaseLog.durationMs =
      endTime.getTime() - new Date(phaseLog.startTime).getTime();
    phaseLog.error = error;

    console.error(`[PipelineLogger] ❌ Phase failed: ${phase} - ${error}`);
  }

  skipPhase(phase: string, reason: string): void {
    const phaseLog: PhaseLog = {
      phase,
      status: "skipped",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      durationMs: 0,
      error: reason,
    };

    this.log.phases.push(phaseLog);
    console.log(`[PipelineLogger] ⏭️ Phase skipped: ${phase} - ${reason}`);
  }

  complete(): void {
    const endTime = new Date();
    this.log.status = "completed";
    this.log.endTime = endTime.toISOString();
    this.log.totalDurationMs =
      endTime.getTime() - new Date(this.log.startTime).getTime();
    this.log.currentPhase = undefined;

    this.calculateSummary();
    this.stopPeriodicSync();
    void this.syncToDatabase();

    console.log(
      `[PipelineLogger] 🎉 Pipeline completed in ${this.log.totalDurationMs}ms`,
    );
    console.log(`[PipelineLogger] Summary:`, this.log.summary);
  }

  fail(error: string): void {
    const endTime = new Date();
    this.log.status = "failed";
    this.log.endTime = endTime.toISOString();
    this.log.totalDurationMs =
      endTime.getTime() - new Date(this.log.startTime).getTime();
    this.log.finalError = error;

    this.calculateSummary();
    this.stopPeriodicSync();
    void this.syncToDatabase();

    console.error(`[PipelineLogger] 💥 Pipeline failed: ${error}`);
  }

  getLog(): PipelineExecutionLog {
    return { ...this.log };
  }

  getPhaseStatus(phase: string): PhaseLog | undefined {
    return this.log.phases.find((p) => p.phase === phase);
  }

  private findPhase(phase: string): PhaseLog | undefined {
    return [...this.log.phases].reverse().find((p) => p.phase === phase);
  }

  private sanitizeForLog(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (
        key.toLowerCase().includes("password") ||
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("token") ||
        key.toLowerCase().includes("key")
      ) {
        sanitized[key] = "[REDACTED]";
        continue;
      }

      if (typeof value === "string" && value.length > 500) {
        sanitized[key] = `${value.substring(0, 500)}... [truncated]`;
        continue;
      }

      if (typeof value === "object" && value !== null) {
        sanitized[key] = "[object]";
        continue;
      }

      sanitized[key] = value;
    }

    return sanitized;
  }

  private calculateSummary(): void {
    let totalTokens = 0;
    let successfulPhases = 0;
    let failedPhases = 0;

    for (const phase of this.log.phases) {
      if (phase.tokenUsage) {
        totalTokens +=
          phase.tokenUsage.inputTokens + phase.tokenUsage.outputTokens;
      }

      if (phase.status === "completed") {
        successfulPhases++;
      } else if (phase.status === "failed") {
        failedPhases++;
      }
    }

    this.log.summary = {
      totalTokens,
      successfulPhases,
      failedPhases,
    };
  }

  private startPeriodicSync(): void {
    this.syncInterval = setInterval(() => {
      void this.syncToDatabase();
    }, 30000);
  }

  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  private async syncToDatabase(): Promise<void> {
    if (!this.options.enableDatabaseSync || !this.options.getSupabase) {
      return;
    }

    try {
      const supabase = await this.options.getSupabase();

      const pipelineLog = {
        status: this.log.status,
        currentPhase: this.log.currentPhase,
        phasesCompleted: this.log.phases.filter((p) => p.status === "completed")
          .length,
        totalPhases: this.log.phases.length,
        lastPhase: this.log.phases[this.log.phases.length - 1]?.phase,
        durationMs: this.log.totalDurationMs,
        summary: this.log.summary,
      };

      // 先讀取現有的 metadata，避免覆蓋其他欄位
      const { data: existingJob } = await supabase
        .from("article_jobs")
        .select("metadata")
        .eq("id", this.options.jobId)
        .single();

      const existingMetadata =
        (existingJob?.metadata as Record<string, unknown>) || {};

      // 合併現有 metadata 和新的 pipeline 資料
      const { error } = await supabase
        .from("article_jobs")
        .update({
          metadata: {
            ...existingMetadata,
            pipeline_log: pipelineLog,
            phases: this.log.phases.map((p) => ({
              phase: p.phase,
              status: p.status,
              durationMs: p.durationMs,
              error: p.error,
            })),
          },
        })
        .eq("id", this.options.jobId);

      if (error) {
        console.warn("[PipelineLogger] Failed to sync to database:", error);
      }
    } catch (err) {
      console.warn("[PipelineLogger] Database sync error:", err);
    }
  }
}
