import type {
  ArticleJobRecordRepository,
  ArticleJobCompanyRepository,
  ArticleJobWebsiteRepository,
} from "./job-intake";
import type { ArticleJobSubscriptionRepository } from "./subscription";

interface SupabaseResponse<T> {
  data?: T | null;
  error?: { message?: string } | null;
}

interface SupabaseFilterBuilder {
  select(columns: string): SupabaseFilterBuilder;
  eq(column: string, value: unknown): SupabaseFilterBuilder;
  in(column: string, values: unknown[]): SupabaseFilterBuilder;
  limit(count: number): SupabaseFilterBuilder;
  maybeSingle<T>(): PromiseLike<SupabaseResponse<T>>;
  single<T>(): PromiseLike<SupabaseResponse<T>>;
  then<TResult1 = SupabaseResponse<unknown>, TResult2 = never>(
    onfulfilled?:
      | ((value: SupabaseResponse<unknown>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

interface SupabaseQueryBuilder {
  select(columns: string): SupabaseFilterBuilder;
  insert(values: unknown): SupabaseFilterBuilder;
  update(values: unknown): SupabaseFilterBuilder;
  delete(): SupabaseFilterBuilder;
  upsert(
    values: unknown,
    options?: Record<string, unknown>,
  ): SupabaseFilterBuilder | Promise<SupabaseResponse<unknown>>;
}

export interface SupabaseRepositoryClient {
  from(table: string): SupabaseQueryBuilder;
}

export function asSupabaseRepositoryClient(
  supabase: unknown,
): SupabaseRepositoryClient {
  return supabase as SupabaseRepositoryClient;
}

export function createSupabaseArticleJobCompanyRepository(
  supabase: SupabaseRepositoryClient,
): ArticleJobCompanyRepository {
  return {
    async findActiveMembershipCompanyId(userId) {
      const { data } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle<{ company_id: string }>();

      return data?.company_id ?? null;
    },

    async companyExists(companyId) {
      const { data } = await supabase
        .from("companies")
        .select("id")
        .eq("id", companyId)
        .maybeSingle<{ id: string }>();

      return Boolean(data?.id);
    },

    async findOwnedCompanyId(userId) {
      const { data } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle<{ id: string }>();

      return data?.id ?? null;
    },

    async createPersonalCompany({ userId, name, slug }) {
      const { data, error } = await supabase
        .from("companies")
        .insert({
          owner_id: userId,
          name,
          slug,
        })
        .select("id")
        .single<{ id: string }>();

      if (error || !data?.id) {
        throw new Error(error?.message || "Failed to create personal company");
      }

      return data.id;
    },

    async upsertOwnerMembership({ companyId, userId }) {
      const { error } = await supabase.from("company_members").upsert(
        {
          company_id: companyId,
          user_id: userId,
          role: "owner",
          status: "active",
        },
        {
          onConflict: "company_id,user_id",
        },
      );

      if (error) {
        throw new Error(error.message || "Failed to upsert owner membership");
      }
    },
  };
}

export function createSupabaseArticleJobWebsiteRepository(
  supabase: SupabaseRepositoryClient,
): ArticleJobWebsiteRepository {
  return {
    async findFirstWebsiteId(companyId) {
      const { data } = await supabase
        .from("website_configs")
        .select("id")
        .eq("company_id", companyId)
        .limit(1)
        .maybeSingle<{ id: string }>();

      return data?.id ?? null;
    },

    async createDefaultWebsite(companyId) {
      const { data, error } = await supabase
        .from("website_configs")
        .insert({
          company_id: companyId,
          website_name: "",
          wordpress_url: "",
        })
        .select("id")
        .single<{ id: string }>();

      if (error || !data?.id) {
        throw new Error(error?.message || "Failed to create default website");
      }

      return data.id;
    },

    async createDefaultAgentConfig(websiteId) {
      const { error } = await supabase
        .from("agent_configs")
        .insert({
          website_id: websiteId,
          research_model: "deepseek-reasoner",
          complex_processing_model: "deepseek-reasoner",
          simple_processing_model: "deepseek-chat",
          image_model: "fal-ai/qwen-image",
          research_temperature: 0.7,
          research_max_tokens: 64000,
          strategy_temperature: 0.7,
          strategy_max_tokens: 64000,
          writing_temperature: 0.7,
          writing_max_tokens: 64000,
          image_size: "1792x1024",
          image_count: 3,
          meta_enabled: true,
          meta_temperature: 0.7,
          meta_max_tokens: 64000,
        })
        .select("id")
        .single<{ id: string }>();

      if (error) {
        throw new Error(error.message || "Failed to create agent config");
      }
    },
  };
}

export function createSupabaseArticleJobSubscriptionRepository(
  supabase: SupabaseRepositoryClient,
): ArticleJobSubscriptionRepository {
  return {
    async findActiveSubscription(billingId) {
      const { data } = await supabase
        .from("company_subscriptions")
        .select("id, status")
        .eq("company_id", billingId)
        .eq("status", "active")
        .single<{ id: string; status: string }>();

      if (data?.id && data.status === "active") {
        return {
          id: data.id,
          status: "active",
        };
      }

      return null;
    },
  };
}

export function createSupabaseArticleJobRecordRepository(
  supabase: SupabaseRepositoryClient,
): ArticleJobRecordRepository {
  return {
    async findPendingOrProcessingJobs(companyId) {
      const { data, error } = (await supabase
        .from("article_jobs")
        .select("id, status, keywords")
        .eq("company_id", companyId)
        .in("status", ["pending", "processing"])) as SupabaseResponse<
        Array<{
          id: string;
          status: "pending" | "processing" | string;
          keywords: string[] | null;
        }>
      >;

      if (error) {
        throw new Error(error.message || "Failed to fetch article jobs");
      }

      return (data ?? [])
        .filter(
          (
            job,
          ): job is {
            id: string;
            status: "pending" | "processing";
            keywords: string[] | null;
          } => job.status === "pending" || job.status === "processing",
        )
        .map((job) => ({
          id: job.id,
          status: job.status,
          keywords: job.keywords ?? [],
        }));
    },

    async insertArticleJob(input) {
      const { error } = (await supabase.from("article_jobs").insert({
        id: input.id,
        job_id: input.jobId,
        company_id: input.companyId,
        website_id: input.websiteId,
        user_id: input.userId,
        keywords: input.keywords,
        status: input.status,
        metadata: input.metadata,
      })) as SupabaseResponse<unknown>;

      if (error) {
        throw new Error(error.message || "Failed to create article job");
      }
    },

    async updateArticleJobMetadata(jobId, metadata) {
      const { error } = (await supabase
        .from("article_jobs")
        .update({ metadata })
        .eq("id", jobId)) as SupabaseResponse<unknown>;

      if (error) {
        throw new Error(
          error.message || "Failed to update article job metadata",
        );
      }
    },

    async deleteArticleJob(jobId) {
      const { error } = (await supabase
        .from("article_jobs")
        .delete()
        .eq("id", jobId)) as SupabaseResponse<unknown>;

      if (error) {
        throw new Error(error.message || "Failed to delete article job");
      }
    },
  };
}
