import { getUser } from "@shared/auth";
import { checkPagePermission } from "@shared/auth/permissions";
import { createClient } from "@shared/supabase";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Bot,
  Facebook,
  FileText,
  Instagram,
  Linkedin,
  Megaphone,
  PenLine,
  Plus,
  Share2,
  Square,
  Sparkles,
  TrendingUp,
  Twitter,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { IconLabel } from "@/components/ui/icon-label";
import { resolveActiveBrandFromCandidates } from "@/lib/brands/active-brand";
import { fetchBrandsFromApi } from "@/lib/brands/server-api";
import {
  type FlywheelOverview,
  type FlywheelTrendSignal,
  type PublishedFeedItem,
  type QueryClient,
  loadFlywheelOverview,
} from "@/lib/dashboard/flywheel-overview";
import { AutomationStatusCard } from "./automation-status-card";

type DashboardPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

type DashboardSearchParams = {
  brand?: string;
};

const SOURCE_LABELS: Record<string, string> = {
  perplexity: "Perplexity",
  gsc: "GSC",
  google_trends: "Google Trends",
  manual: "Manual",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams = Promise.resolve<DashboardSearchParams>({}),
}: DashboardPageProps) {
  await checkPagePermission("canAccessDashboard");

  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const [brands, params, headerStore, supabase] = await Promise.all([
    fetchBrandsFromApi(),
    searchParams,
    headers(),
    createClient(),
  ]);

  const requestUrl = new URL("https://dashboard.local/dashboard");
  if (params.brand) {
    requestUrl.searchParams.set("brand", params.brand);
  }

  const activeBrand = resolveActiveBrandFromCandidates(
    new Request(requestUrl, {
      headers: {
        cookie: headerStore.get("cookie") ?? "",
      },
    }),
    brands,
  );

  if (!activeBrand) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          className="min-h-[420px]"
          icon={<Sparkles className="h-6 w-6" aria-hidden />}
          title="Create your first brand"
          description="Dashboard flywheel insights appear after a brand exists."
          action={{ label: "Create brand", href: "/dashboard/brands" }}
        />
      </div>
    );
  }

  const overview = await loadFlywheelOverview(
    supabase as unknown as QueryClient,
    activeBrand.id,
  );

  if (overview.articleCount === 0) {
    return (
      <DashboardOnboardingEmptyState
        brandId={activeBrand.id}
        brandName={activeBrand.name}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Active brand: {activeBrand.name}
          </p>
          <h1 className="text-3xl font-semibold tracking-normal">
            Flywheel overview
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Weekly topic discovery, publishing activity, performance, and
            automation health for the selected brand.
          </p>
        </div>
        <Button asChild>
          <Link href={newArticleHref(activeBrand.id)}>
            <Plus className="h-4 w-4" aria-hidden />
            New article
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <RecommendedTopicsCard
          brandId={activeBrand.id}
          signals={overview.trendSignals}
        />
        <PerformanceSnapshotCard overview={overview} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentlyPublishedCard items={overview.recentlyPublished} />
        <AutomationStatusCard
          brandId={activeBrand.id}
          automationLevel={activeBrand.automation_level}
          autoArticlesPerWeek={activeBrand.auto_articles_per_week}
          initialScheduled={overview.automation.scheduled}
          initialPublished={overview.automation.published}
        />
      </div>

      <QuickActionsCard brandId={activeBrand.id} />
    </div>
  );
}

function RecommendedTopicsCard({
  brandId,
  signals,
}: {
  brandId: string;
  signals: FlywheelTrendSignal[];
}) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <IconLabel
          as="div"
          icon={<TrendingUp className="h-5 w-5 text-primary" aria-hidden />}
        >
          <CardTitle>This week&apos;s recommended topics</CardTitle>
        </IconLabel>
        <CardDescription>
          Top trend signals ranked by confidence for the active brand.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Trend research will appear after the next signal refresh.
          </div>
        ) : (
          <div className="space-y-3">
            {signals.map((signal) => (
              <div
                key={signal.id}
                className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-sm font-semibold">
                      {signal.topic}
                    </h2>
                    <Badge variant="secondary">
                      {SOURCE_LABELS[signal.source] ?? signal.source}
                    </Badge>
                    <Badge variant="outline">
                      {Math.round(signal.confidence * 100)}%
                    </Badge>
                  </div>
                </div>
                <Button asChild size="sm">
                  <Link href={newArticleHref(brandId, signal)}>
                    <PenLine className="h-4 w-4" aria-hidden />
                    Generate article
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentlyPublishedCard({ items }: { items: PublishedFeedItem[] }) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <IconLabel
            as="div"
            icon={<FileText className="h-5 w-5 text-primary" aria-hidden />}
          >
            <CardTitle>Recently published</CardTitle>
          </IconLabel>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/articles">View all</Link>
          </Button>
        </div>
        <CardDescription>
          Articles and social posts published in the last 7 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No articles or social posts were published this week.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <FeedRow key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeedRow({ item }: { item: PublishedFeedItem }) {
  const href =
    item.type === "article"
      ? `/dashboard/articles/${item.id}`
      : item.articleId
        ? `/dashboard/articles/${item.articleId}`
        : "/dashboard/social";

  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg border bg-background p-4 transition-colors hover:bg-muted/40"
    >
      <span className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
        <PlatformGlyph
          platform={item.type === "article" ? "article" : item.platform}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {item.title}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {item.type === "article" ? "Article" : platformLabel(item.platform)} ·{" "}
          {formatDateTime(item.publishedAt)}
        </span>
      </span>
      {item.type === "social" && (
        <Badge variant="outline">{item.engagement.toLocaleString()} eng.</Badge>
      )}
    </Link>
  );
}

function PlatformGlyph({ platform }: { platform: string }) {
  if (platform === "article") {
    return <FileText className="h-4 w-4" aria-hidden />;
  }
  if (platform === "instagram") {
    return <Instagram className="h-4 w-4" aria-hidden />;
  }
  if (platform === "facebook") {
    return <Facebook className="h-4 w-4" aria-hidden />;
  }
  if (platform === "linkedin") {
    return <Linkedin className="h-4 w-4" aria-hidden />;
  }
  if (platform === "x") {
    return <Twitter className="h-4 w-4" aria-hidden />;
  }
  return <Share2 className="h-4 w-4" aria-hidden />;
}

function PerformanceSnapshotCard({ overview }: { overview: FlywheelOverview }) {
  const { performance } = overview;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <IconLabel
          as="div"
          icon={<BarChart3 className="h-5 w-5 text-primary" aria-hidden />}
        >
          <CardTitle>Performance snapshot</CardTitle>
        </IconLabel>
        <CardDescription>Last 7 days across all sources.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <KpiTile
          label="Total pageviews"
          value={performance.totalPageviews.toLocaleString()}
        />
        <KpiTile
          label="Total social engagement"
          value={performance.totalSocialEngagement.toLocaleString()}
        />
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Top article
          </p>
          {performance.topArticle ? (
            <Link
              href={`/dashboard/articles/${performance.topArticle.id}`}
              className="mt-2 block text-base font-semibold leading-6 text-primary hover:underline"
            >
              Top article: {performance.topArticle.title}
            </Link>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No views yet</p>
          )}
        </div>
        <KpiTile
          label="Top platform"
          value={
            performance.topPlatform
              ? platformLabel(performance.topPlatform.platform)
              : "None"
          }
          detail={
            performance.topPlatform
              ? `${performance.topPlatform.engagement.toLocaleString()} engagement`
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
}

function KpiTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-normal">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function QuickActionsCard({ brandId }: { brandId: string }) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <IconLabel
          as="div"
          icon={<Sparkles className="h-5 w-5 text-primary" aria-hidden />}
        >
          <CardTitle>Quick actions</CardTitle>
        </IconLabel>
        <CardDescription>
          Common next steps for keeping the content flywheel moving.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <Button asChild>
          <Link href={newArticleHref(brandId)}>
            <Plus className="h-4 w-4" aria-hidden />
            Generate new article
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/dashboard/social?brand=${brandId}`}>
            <Megaphone className="h-4 w-4" aria-hidden />
            Connect social
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/dashboard/brands/${brandId}/memory`}>
            <Bot className="h-4 w-4" aria-hidden />
            Edit brand memory
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function DashboardOnboardingEmptyState({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <EmptyState
        className="min-h-[520px]"
        icon={<Sparkles className="h-6 w-6" aria-hidden />}
        title="Start this brand's flywheel"
        description={`${brandName} has no articles yet. Complete the setup checklist to start collecting recommendations, publishing, and performance feedback.`}
        action={{
          label: "Create first article",
          href: newArticleHref(brandId),
        }}
      />
      <div className="mt-4 rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">Onboarding checklist</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            "Connect a social account",
            "Set brand voice",
            "Generate first article",
            "Configure trend keywords",
          ].map((item) => (
            <IconLabel
              key={item}
              as="div"
              className="text-sm"
              icon={
                <Square className="h-4 w-4 text-muted-foreground" aria-hidden />
              }
            >
              <span>{item}</span>
            </IconLabel>
          ))}
        </div>
      </div>
    </div>
  );
}

function newArticleHref(brandId: string, signal?: FlywheelTrendSignal) {
  const params = new URLSearchParams({ brand: brandId });
  if (signal) {
    params.set("topic", signal.topic);
    params.set("trend", signal.id);
  }
  return `/dashboard/articles/new?${params.toString()}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function platformLabel(platform: string) {
  const labels: Record<string, string> = {
    instagram: "Instagram",
    threads: "Threads",
    facebook: "Facebook",
    x: "X",
    linkedin: "LinkedIn",
    social: "Social",
  };
  return labels[platform] ?? platform;
}
