import { createClient } from '@/lib/supabase/server';

// ============================================================================
// Types and Constants
// ============================================================================

interface OAuthProvider {
  name: 'google' | 'github' | 'facebook';
  displayName: string;
  supportsRefreshToken: boolean;
}

interface CompanyData {
  id: string;
  name: string;
  email: string;
  plan: string;
}

export interface OAuthSetupResult {
  success: boolean;
  company?: CompanyData;
  path: 'existing' | 'trigger_success' | 'fallback_success' | 'failed';
  delay: number;
  error?: string;
}

const OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
  google: {
    name: 'google',
    displayName: 'Google',
    supportsRefreshToken: true,
  },
};

const EXPONENTIAL_BACKOFF_DELAYS = [100, 200, 400, 800, 1600];
const TOTAL_TIMEOUT = EXPONENTIAL_BACKOFF_DELAYS.reduce((a, b) => a + b, 0);

// ============================================================================
// Layer 1: Check Existing Company
// ============================================================================

async function getUserCompany(userId: string): Promise<CompanyData | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('company_members')
    .select(`
      company_id,
      companies (
        id,
        name,
        email,
        plan
      )
    `)
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  const companies = data.companies as unknown as CompanyData;
  return companies;
}

// ============================================================================
// Layer 2: Wait for Database Trigger (Exponential Backoff)
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCompanySetup(
  userId: string
): Promise<CompanyData | null> {
  for (const delay of EXPONENTIAL_BACKOFF_DELAYS) {
    await sleep(delay);

    const company = await getUserCompany(userId);
    if (company) {
      console.log(`[OAuth] Trigger succeeded after ${delay}ms poll`);
      return company;
    }
  }

  console.warn(`[OAuth] Trigger timeout after ${TOTAL_TIMEOUT}ms`);
  return null;
}

// ============================================================================
// Layer 3: Fallback Manual Creation (RPC Function)
// ============================================================================

async function createCompanyForUser(
  userId: string,
  email: string,
  name: string
): Promise<CompanyData | null> {
  const supabase = await createClient();

  console.log(`[OAuth] Fallback: Creating company for user ${userId}`);

  const { data, error } = await supabase.rpc('create_company_for_oauth_user', {
    p_user_id: userId,
    p_email: email,
    p_company_name: name || 'My Company',
  });

  if (error) {
    console.error('[OAuth] Fallback creation failed:', error);
    return null;
  }

  console.log('[OAuth] Fallback creation succeeded:', data);

  return await getUserCompany(userId);
}

// ============================================================================
// Main Coordinator: ensureUserHasCompany
// ============================================================================

export async function ensureUserHasCompany(
  userId: string,
  email: string,
  userName?: string
): Promise<OAuthSetupResult> {
  const startTime = Date.now();

  console.log(`[OAuth] Starting company setup for user ${userId}`);

  let company = await getUserCompany(userId);
  if (company) {
    const delay = Date.now() - startTime;
    console.log(`[OAuth] Layer 1 success: existing company found (${delay}ms)`);

    await recordMetrics({
      userId,
      path: 'existing',
      delay,
      provider: 'google',
    });

    return {
      success: true,
      company,
      path: 'existing',
      delay,
    };
  }

  company = await waitForCompanySetup(userId);
  if (company) {
    const delay = Date.now() - startTime;
    console.log(`[OAuth] Layer 2 success: trigger completed (${delay}ms)`);

    await recordMetrics({
      userId,
      path: 'trigger_success',
      delay,
      provider: 'google',
    });

    return {
      success: true,
      company,
      path: 'trigger_success',
      delay,
    };
  }

  console.warn('[OAuth] Layer 3: Trigger timeout, starting fallback creation');

  const defaultCompanyName = userName || email.split('@')[0] || 'My Company';
  company = await createCompanyForUser(userId, email, defaultCompanyName);

  if (company) {
    const delay = Date.now() - startTime;
    console.log(`[OAuth] Layer 3 success: fallback created (${delay}ms)`);

    await recordMetrics({
      userId,
      path: 'fallback_success',
      delay,
      provider: 'google',
    });

    return {
      success: true,
      company,
      path: 'fallback_success',
      delay,
    };
  }

  const delay = Date.now() - startTime;
  console.error(`[OAuth] All layers failed (${delay}ms)`);

  await recordMetrics({
    userId,
    path: 'failed',
    delay,
    provider: 'google',
  });

  return {
    success: false,
    path: 'failed',
    delay,
    error: 'Failed to create company after all attempts',
  };
}

// ============================================================================
// Monitoring and Metrics
// ============================================================================

interface MetricsData {
  userId: string;
  provider: string;
  path: 'existing' | 'trigger_success' | 'fallback_success' | 'failed';
  delay: number;
}

async function recordMetrics(data: MetricsData): Promise<void> {
  const supabase = await createClient();

  await supabase.from('oauth_login_metrics').insert({
    user_id: data.userId,
    provider: data.provider,
    path: data.path,
    trigger_delay_ms: data.delay,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getProviderFromUser(user: { app_metadata?: { provider?: string } } | null): string | null {
  return user?.app_metadata?.provider || null;
}

export function isOAuthProvider(provider: string | null): boolean {
  return provider !== null && provider !== 'email';
}

export function getDefaultCompanyName(user: { user_metadata?: { full_name?: string; name?: string }; email?: string }, provider: string): string {
  switch (provider) {
    case 'google':
      return (
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'My Company'
      );
    case 'github':
      return user.user_metadata?.name || 'My Company';
    default:
      return 'My Company';
  }
}
