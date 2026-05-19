interface CompanyScopeAdminClient {
  from(table: string): any;
}

export type CompanyScopeResult =
  | {
      success: true;
      companyId: string;
    }
  | {
      success: false;
      reason: "no_company" | "query_failed";
      error?: string;
    };

export async function resolveCompanyScopeForUser(
  adminClient: CompanyScopeAdminClient,
  userId: string,
): Promise<CompanyScopeResult> {
  const { data, error } = await adminClient
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .single();

  if (error) {
    return {
      success: false,
      reason: "query_failed",
      error: error.message,
    };
  }

  if (!data?.company_id) {
    return {
      success: false,
      reason: "no_company",
    };
  }

  return {
    success: true,
    companyId: data.company_id,
  };
}
