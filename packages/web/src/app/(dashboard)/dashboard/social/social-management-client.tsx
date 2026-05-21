"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  AtSign,
  Facebook,
  Instagram,
  Linkedin,
  Trash2,
  Twitter,
} from "lucide-react";
import { BrandSwitcher } from "@/components/ui/brand-switcher";
import { cn } from "@/lib/utils";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shared/ui/table";
import type { Platform } from "@/lib/social/types";

type PlatformWithLinkedIn = Platform;
type PostStatus =
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";
type StatusFilter = "all" | PostStatus;
type PlatformFilter = "all" | PlatformWithLinkedIn;

export type SocialAccountStatus =
  | "connected"
  | "token-expired"
  | "disconnected";

export type SocialAccountView = {
  id: string;
  platform: PlatformWithLinkedIn;
  platformUsername: string | null;
  status: SocialAccountStatus;
  connectedAt: string;
  disconnectedAt: string | null;
  tokenExpiresAt: string | null;
  lastPublishedAt: string | null;
};

type SocialPostView = {
  id: string;
  socialAccountId: string | null;
  platform: PlatformWithLinkedIn | null;
  contentSnippet: string;
  scheduledAt: string;
  publishedAt: string | null;
  status: PostStatus;
  metrics: Record<string, unknown>;
};

type PostsPayload = {
  success: true;
  data: {
    posts: SocialPostView[];
    pagination: {
      limit: number;
      offset: number;
      total: number | null;
      hasMore: boolean;
    };
  };
};

export type SocialManagementClientProps = {
  brands: { id: string; name: string }[];
  activeBrandId: string;
  activeBrandName: string;
  initialAccounts: SocialAccountView[];
  plan: "solo" | "pro";
  activeBrandConnectedCount: number;
  companyConnectedCount: number;
  metaOAuthPublicEnabled: boolean;
};

const PAGE_SIZE = 10;
const PER_BRAND_CHANNEL_CAP = 4;
const COMPANY_CHANNEL_CAP_BY_PLAN = {
  solo: 4,
  pro: 20,
} as const;

const PLATFORM_LABELS: Record<PlatformWithLinkedIn, string> = {
  instagram: "Instagram",
  threads: "Threads",
  facebook: "Facebook",
  x: "X",
  linkedin: "LinkedIn",
};

const PLATFORM_ORDER: PlatformWithLinkedIn[] = [
  "instagram",
  "threads",
  "facebook",
  "x",
  "linkedin",
];

const STATUS_LABELS: Record<SocialAccountStatus | PostStatus, string> = {
  connected: "connected",
  "token-expired": "token-expired",
  disconnected: "disconnected",
  scheduled: "scheduled",
  publishing: "publishing",
  published: "published",
  failed: "failed",
  cancelled: "cancelled",
};

function isMetaFamily(platform: PlatformWithLinkedIn): boolean {
  return (
    platform === "instagram" ||
    platform === "threads" ||
    platform === "facebook"
  );
}

function PlatformIcon({ platform }: { platform: PlatformWithLinkedIn }) {
  const className = "h-4 w-4";
  if (platform === "instagram") return <Instagram className={className} />;
  if (platform === "facebook") return <Facebook className={className} />;
  if (platform === "linkedin") return <Linkedin className={className} />;
  if (platform === "x") return <Twitter className={className} />;
  return <AtSign className={className} />;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusVariant(status: SocialAccountStatus | PostStatus) {
  if (status === "connected" || status === "published") return "default";
  if (status === "failed" || status === "token-expired") return "destructive";
  if (status === "disconnected" || status === "cancelled") return "outline";
  return "secondary";
}

function numberMetric(metrics: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function formatMetrics(metrics: Record<string, unknown>) {
  const impressions = numberMetric(metrics, [
    "impressions",
    "impression_count",
    "views",
    "view_count",
  ]);
  const engagement =
    numberMetric(metrics, ["engagement", "engagements"]) ||
    numberMetric(metrics, ["likes", "like_count"]) +
      numberMetric(metrics, ["comments", "comment_count"]) +
      numberMetric(metrics, ["shares", "share_count", "reposts"]) +
      numberMetric(metrics, ["clicks", "link_clicks"]);

  return `${impressions} / ${engagement}`;
}

function platformConnectHref(platform: PlatformWithLinkedIn, brandId: string) {
  if (platform === "x") {
    return `/api/social/x/connect?brand_id=${encodeURIComponent(brandId)}`;
  }

  if (isMetaFamily(platform)) {
    const params = new URLSearchParams({ brand_id: brandId, platform });
    return `/api/social/meta/connect?${params.toString()}`;
  }

  return null;
}

export function SocialManagementClient({
  brands,
  activeBrandId,
  activeBrandName,
  initialAccounts,
  plan,
  activeBrandConnectedCount,
  companyConnectedCount,
  metaOAuthPublicEnabled,
}: SocialManagementClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [posts, setPosts] = useState<SocialPostView[]>([]);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postsLoading, setPostsLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [disconnectingAccount, setDisconnectingAccount] =
    useState<SocialAccountView | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    setAccounts(initialAccounts);
  }, [initialAccounts]);

  const activeConnectedCount = useMemo(
    () =>
      accounts.filter((account) => account.status !== "disconnected").length,
    [accounts],
  );
  const companyConnectedTotal =
    companyConnectedCount - activeBrandConnectedCount + activeConnectedCount;
  const planLabel = plan === "pro" ? "Pro" : "Solo";
  const companyCap = COMPANY_CHANNEL_CAP_BY_PLAN[plan];
  const brandQuotaFull = activeConnectedCount >= PER_BRAND_CHANNEL_CAP;
  const companyQuotaFull = companyConnectedTotal >= companyCap;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      brandId: activeBrandId,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });

    if (statusFilter !== "all") params.set("status", statusFilter);
    if (platformFilter !== "all") params.set("platform", platformFilter);

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setPostsLoading(true);
        setPostsError(null);
      }
    });

    fetch(`/api/social-posts?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.success) {
          throw new Error(body.error ?? "Failed to load social posts");
        }
        return body as PostsPayload;
      })
      .then((payload) => {
        setPosts(payload.data.posts);
        setHasMorePosts(payload.data.pagination.hasMore);
      })
      .catch((error) => {
        if ((error as Error).name === "AbortError") return;
        setPostsError((error as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPostsLoading(false);
      });

    return () => controller.abort();
  }, [activeBrandId, offset, platformFilter, statusFilter]);

  function switchBrand(nextBrandId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("brand", nextBrandId);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  function updateStatusFilter(nextStatus: StatusFilter) {
    setStatusFilter(nextStatus);
    setOffset(0);
  }

  function updatePlatformFilter(nextPlatform: PlatformFilter) {
    setPlatformFilter(nextPlatform);
    setOffset(0);
  }

  async function confirmDisconnect() {
    if (!disconnectingAccount) return;

    setIsDisconnecting(true);
    setDisconnectError(null);

    try {
      const response = await fetch(
        `/api/social-accounts/${disconnectingAccount.id}`,
        { method: "DELETE" },
      );
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? "Failed to disconnect account");
      }

      const disconnectedAt =
        body.data?.disconnectedAt ?? new Date().toISOString();
      setAccounts((current) =>
        current.map((account) =>
          account.id === disconnectingAccount.id
            ? {
                ...account,
                status: "disconnected",
                disconnectedAt,
              }
            : account,
        ),
      );
      setDisconnectingAccount(null);
    } catch (error) {
      setDisconnectError((error as Error).message);
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-foreground">
            Social
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeBrandName}
          </p>
        </div>
        <BrandSwitcher
          brands={brands}
          activeBrandId={activeBrandId}
          onSwitch={switchBrand}
          className="static z-auto border-0 bg-transparent p-0"
        />
      </div>

      {!metaOAuthPublicEnabled && (
        <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Meta connect pending review
          </div>
          <Link
            href="/docs/runbooks/meta-app-review.md"
            className="text-sm font-medium text-amber-950 underline underline-offset-4"
          >
            Meta App Review runbook
          </Link>
        </div>
      )}

      <Card className="rounded-lg border-border/60 shadow-sm">
        <CardHeader className="gap-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>
                {activeConnectedCount} of {PER_BRAND_CHANNEL_CAP} connected (
                {planLabel} plan)
              </CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              {companyConnectedTotal} of {companyCap} channels used
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {PLATFORM_ORDER.map((platform) => {
              const existing = accounts.find(
                (account) =>
                  account.platform === platform &&
                  account.status !== "disconnected",
              );
              const href = platformConnectHref(platform, activeBrandId);
              const disabledByMeta =
                isMetaFamily(platform) && !metaOAuthPublicEnabled;
              const disabledByQuota =
                !existing && (brandQuotaFull || companyQuotaFull);
              const label = PLATFORM_LABELS[platform];

              return (
                <div
                  key={platform}
                  className="rounded-lg border border-border/70 bg-background p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
                      <PlatformIcon platform={platform} />
                    </span>
                    <div className="font-medium">{label}</div>
                  </div>
                  <div className="mt-4">
                    {existing ? (
                      <Button variant="outline" className="w-full" disabled>
                        Connected
                      </Button>
                    ) : platform === "linkedin" ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled
                        aria-label="LinkedIn coming soon"
                      >
                        Coming soon
                      </Button>
                    ) : disabledByMeta ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled
                        aria-label={`${label} Pending review`}
                      >
                        Pending review
                      </Button>
                    ) : disabledByQuota ? (
                      <Button variant="outline" className="w-full" disabled>
                        Quota full
                      </Button>
                    ) : href ? (
                      <Button asChild className="w-full">
                        <Link href={href} aria-label={`Connect ${label}`}>
                          Connect
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Published</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No social accounts connected.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={account.platform} />
                        {PLATFORM_LABELS[account.platform]}
                      </div>
                    </TableCell>
                    <TableCell>{account.platformUsername ?? "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant(account.status)}
                        className="capitalize"
                      >
                        {STATUS_LABELS[account.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(account.lastPublishedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={account.status === "disconnected"}
                        onClick={() => setDisconnectingAccount(account)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Disconnect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-border/60 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Published Posts</CardTitle>
              <CardDescription>
                Last 30 social posts for this brand.
              </CardDescription>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-medium text-muted-foreground">
                Status
                <select
                  aria-label="Status"
                  value={statusFilter}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  onChange={(event) =>
                    updateStatusFilter(event.target.value as StatusFilter)
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="publishing">Publishing</option>
                  <option value="published">Published</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Platform
                <select
                  aria-label="Platform"
                  value={platformFilter}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  onChange={(event) =>
                    updatePlatformFilter(event.target.value as PlatformFilter)
                  }
                >
                  <option value="all">All platforms</option>
                  {PLATFORM_ORDER.map((platform) => (
                    <option key={platform} value={platform}>
                      {PLATFORM_LABELS[platform]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {postsError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {postsError}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Impressions / Engagement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {postsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center">
                    Loading posts...
                  </TableCell>
                </TableRow>
              ) : posts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No social posts found.
                  </TableCell>
                </TableRow>
              ) : (
                posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      {post.platform ? (
                        <div className="flex items-center gap-2">
                          <PlatformIcon platform={post.platform} />
                          {PLATFORM_LABELS[post.platform]}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <span className="line-clamp-2">
                        {post.contentSnippet}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(post.scheduledAt)}</TableCell>
                    <TableCell>{formatDate(post.publishedAt)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant(post.status)}
                        className="capitalize"
                      >
                        {STATUS_LABELS[post.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatMetrics(post.metrics)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() =>
                setOffset((current) => Math.max(0, current - PAGE_SIZE))
              }
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasMorePosts}
              onClick={() => setOffset((current) => current + PAGE_SIZE)}
            >
              Next page
            </Button>
          </div>
        </CardContent>
      </Card>

      {disconnectingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="disconnect-social-account-title"
            className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg"
          >
            <h2
              id="disconnect-social-account-title"
              className="text-lg font-semibold tracking-normal"
            >
              Disconnect social account?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {PLATFORM_LABELS[disconnectingAccount.platform]}{" "}
              {disconnectingAccount.platformUsername ?? "account"} will stop
              publishing for {activeBrandName}.
            </p>
            {disconnectError && (
              <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {disconnectError}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDisconnectingAccount(null)}
                disabled={isDisconnecting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmDisconnect}
                disabled={isDisconnecting}
                className={cn(isDisconnecting && "opacity-80")}
              >
                Disconnect account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
