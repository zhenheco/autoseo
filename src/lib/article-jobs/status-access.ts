import type { SupabaseRepositoryClient } from "./supabase-repositories";

export interface ArticleJobStatusRecord {
  id: string;
  user_id?: string | null;
  company_id?: string | null;
  status?: string | null;
  article_title?: string | null;
  generated_content?: string | null;
  metadata?: Record<string, unknown> | null;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  [key: string]: unknown;
}

export interface ArticleJobStatusAccessRepository {
  findActiveMembershipCompanyId(userId: string): Promise<string | null>;
  findJobById(jobId: string): Promise<ArticleJobStatusRecord | null>;
  findCompanyJob(
    jobId: string,
    companyId: string,
  ): Promise<ArticleJobStatusRecord | null>;
}

type ArticleJobStatusAccessResult =
  | {
      success: true;
      job: ArticleJobStatusRecord;
    }
  | {
      success: false;
      reason: "no_active_membership" | "not_found" | "access_denied";
    };

export function createSupabaseArticleJobStatusAccessRepository(
  supabase: SupabaseRepositoryClient,
): ArticleJobStatusAccessRepository {
  return {
    async findActiveMembershipCompanyId(userId) {
      const { data } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single<{ company_id: string }>();

      return data?.company_id ?? null;
    },

    async findJobById(jobId) {
      const { data, error } = await supabase
        .from("article_jobs")
        .select("*")
        .eq("id", jobId)
        .single<ArticleJobStatusRecord>();

      if (error || !data) {
        return null;
      }

      return data;
    },

    async findCompanyJob(jobId, companyId) {
      const { data, error } = await supabase
        .from("article_jobs")
        .select("*")
        .eq("id", jobId)
        .eq("company_id", companyId)
        .single<ArticleJobStatusRecord>();

      if (error || !data) {
        return null;
      }

      return data;
    },
  };
}

export async function findCompanyScopedArticleJobStatus({
  repository,
  userId,
  jobId,
}: {
  repository: ArticleJobStatusAccessRepository;
  userId: string;
  jobId: string;
}): Promise<ArticleJobStatusAccessResult> {
  const companyId = await repository.findActiveMembershipCompanyId(userId);
  if (!companyId) {
    return {
      success: false,
      reason: "no_active_membership",
    };
  }

  const job = await repository.findCompanyJob(jobId, companyId);
  if (!job) {
    return {
      success: false,
      reason: "not_found",
    };
  }

  return {
    success: true,
    job,
  };
}

export async function findVisibleArticleJobStatus({
  repository,
  userId,
  jobId,
}: {
  repository: ArticleJobStatusAccessRepository;
  userId: string;
  jobId: string;
}): Promise<ArticleJobStatusAccessResult> {
  const job = await repository.findJobById(jobId);
  if (!job) {
    return {
      success: false,
      reason: "not_found",
    };
  }

  if (job.user_id === userId) {
    return {
      success: true,
      job,
    };
  }

  const companyId = await repository.findActiveMembershipCompanyId(userId);
  if (companyId && job.company_id === companyId) {
    return {
      success: true,
      job,
    };
  }

  return {
    success: false,
    reason: "access_denied",
  };
}
