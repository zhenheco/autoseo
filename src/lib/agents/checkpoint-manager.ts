import { createClient } from "@/lib/supabase/server";
import {
  PipelineContext,
  PipelinePhase,
  type PipelineContextData,
} from "./pipeline-context";

export const CHECKPOINT_VERSION = 1;

export interface CheckpointData {
  version: number;
  pipelineContext: PipelineContextData & {
    articleJobId: string;
    companyId: string;
    websiteId: string;
    userId?: string;
  };
  savedAt: string;
}

export interface CheckpointResult {
  success: boolean;
  message: string;
  phase?: PipelinePhase;
}

export class CheckpointManager {
  private readonly articleJobId: string;

  constructor(articleJobId: string) {
    this.articleJobId = articleJobId;
  }

  async saveCheckpoint(context: PipelineContext): Promise<CheckpointResult> {
    try {
      const supabase = await createClient();

      const checkpointData: CheckpointData = {
        version: CHECKPOINT_VERSION,
        pipelineContext: context.toJSON(),
        savedAt: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("article_jobs")
        .update({
          pipeline_state: checkpointData,
          current_phase: context.getCurrentPhase(),
          last_checkpoint: new Date().toISOString(),
          checkpoint_version: CHECKPOINT_VERSION,
        })
        .eq("id", this.articleJobId);

      if (error) {
        console.error("[CheckpointManager] Save failed:", error);
        return {
          success: false,
          message: `Failed to save checkpoint: ${error.message}`,
          phase: context.getCurrentPhase(),
        };
      }

      console.log(
        `[CheckpointManager] Saved checkpoint at phase: ${context.getCurrentPhase()}`,
      );
      return {
        success: true,
        message: "Checkpoint saved successfully",
        phase: context.getCurrentPhase(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[CheckpointManager] Save error:", message);
      return {
        success: false,
        message: `Checkpoint save error: ${message}`,
      };
    }
  }

  async loadCheckpoint(): Promise<PipelineContext | null> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("article_jobs")
        .select("pipeline_state, checkpoint_version")
        .eq("id", this.articleJobId)
        .single();

      if (error) {
        console.error("[CheckpointManager] Load failed:", error);
        return null;
      }

      if (!data?.pipeline_state) {
        console.log("[CheckpointManager] No checkpoint found");
        return null;
      }

      const checkpointData = data.pipeline_state as CheckpointData;

      if (checkpointData.version !== CHECKPOINT_VERSION) {
        console.warn(
          `[CheckpointManager] Version mismatch: saved=${checkpointData.version}, current=${CHECKPOINT_VERSION}`,
        );
        return null;
      }

      console.log(
        `[CheckpointManager] Loaded checkpoint from phase: ${checkpointData.pipelineContext.currentPhase}`,
      );
      return PipelineContext.fromJSON(checkpointData.pipelineContext);
    } catch (err) {
      console.error("[CheckpointManager] Load error:", err);
      return null;
    }
  }

  async resumeFromCheckpoint(): Promise<{
    context: PipelineContext | null;
    resumePhase: PipelinePhase | null;
  }> {
    const context = await this.loadCheckpoint();

    if (!context) {
      return { context: null, resumePhase: null };
    }

    const completedPhases = context.getCompletedPhases();
    const currentPhase = context.getCurrentPhase();

    if (
      currentPhase === PipelinePhase.COMPLETED ||
      currentPhase === PipelinePhase.FAILED
    ) {
      console.log(`[CheckpointManager] Pipeline already ${currentPhase}`);
      return { context, resumePhase: null };
    }

    const phaseOrder: PipelinePhase[] = [
      PipelinePhase.INIT,
      PipelinePhase.RESEARCH,
      PipelinePhase.COMPETITOR_ANALYSIS,
      PipelinePhase.STRATEGY,
      PipelinePhase.CONTENT_PLAN,
      PipelinePhase.WRITING,
      PipelinePhase.LINK_ENRICHMENT,
      PipelinePhase.HTML,
      PipelinePhase.META,
      PipelinePhase.IMAGE,
      PipelinePhase.CATEGORY,
      PipelinePhase.PUBLISH,
    ];

    let resumePhase: PipelinePhase | null = null;
    for (const phase of phaseOrder) {
      if (!completedPhases.includes(phase)) {
        resumePhase = phase;
        break;
      }
    }

    console.log(`[CheckpointManager] Resuming from phase: ${resumePhase}`);
    return { context, resumePhase };
  }

  async clearCheckpoint(): Promise<boolean> {
    try {
      const supabase = await createClient();

      const { error } = await supabase
        .from("article_jobs")
        .update({
          pipeline_state: null,
          current_phase: null,
          last_checkpoint: null,
          checkpoint_version: null,
        })
        .eq("id", this.articleJobId);

      if (error) {
        console.error("[CheckpointManager] Clear failed:", error);
        return false;
      }

      console.log("[CheckpointManager] Checkpoint cleared");
      return true;
    } catch (err) {
      console.error("[CheckpointManager] Clear error:", err);
      return false;
    }
  }

  async updatePhase(phase: PipelinePhase): Promise<boolean> {
    try {
      const supabase = await createClient();

      const { error } = await supabase
        .from("article_jobs")
        .update({
          current_phase: phase,
          last_checkpoint: new Date().toISOString(),
        })
        .eq("id", this.articleJobId);

      if (error) {
        console.error("[CheckpointManager] Update phase failed:", error);
        return false;
      }

      return true;
    } catch (err) {
      console.error("[CheckpointManager] Update phase error:", err);
      return false;
    }
  }

  static async cleanupOldCheckpoints(daysOld: number = 30): Promise<number> {
    try {
      const supabase = await createClient();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data, error } = await supabase
        .from("article_jobs")
        .update({
          pipeline_state: null,
          current_phase: null,
          last_checkpoint: null,
          checkpoint_version: null,
        })
        .lt("last_checkpoint", cutoffDate.toISOString())
        .not("pipeline_state", "is", null)
        .select("id");

      if (error) {
        console.error("[CheckpointManager] Cleanup failed:", error);
        return 0;
      }

      const count = data?.length || 0;
      console.log(`[CheckpointManager] Cleaned up ${count} old checkpoints`);
      return count;
    } catch (err) {
      console.error("[CheckpointManager] Cleanup error:", err);
      return 0;
    }
  }
}
