type CompanyMemberRow = {
  user_id: string;
  role: string | null;
};

interface SupabaseLikeClient {
  from(table: string): {
    select(columns: string): SupabaseQueryBuilder;
  };
}

interface SupabaseQueryBuilder {
  eq(column: string, value: string): SupabaseQueryBuilder;
  order(
    column: string,
    options?: { ascending?: boolean },
  ): SupabaseQueryBuilder;
  limit(count: number): SupabaseQueryBuilder;
  maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
}

export async function canUserManageCompanyBilling(
  supabase: unknown,
  input: { companyId: string; userId: string },
): Promise<boolean> {
  const client = supabase as SupabaseLikeClient;

  const currentMemberResult = await client
    .from("company_members")
    .select("user_id, role")
    .eq("company_id", input.companyId)
    .eq("user_id", input.userId)
    .limit(1)
    .maybeSingle();

  if (currentMemberResult.error) {
    throw currentMemberResult.error;
  }

  const currentMember = currentMemberResult.data as CompanyMemberRow | null;

  if (!currentMember) {
    return false;
  }

  if (currentMember.role === "owner") {
    return true;
  }

  const firstMemberResult = await client
    .from("company_members")
    .select("user_id")
    .eq("company_id", input.companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstMemberResult.error) {
    throw firstMemberResult.error;
  }

  const firstMember = firstMemberResult.data as Pick<
    CompanyMemberRow,
    "user_id"
  > | null;

  return firstMember?.user_id === input.userId;
}
