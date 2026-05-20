import { Button } from "@shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { Badge } from "@shared/ui/badge";
import { Clock, ExternalLink, Settings } from "lucide-react";
import Link from "next/link";
import { WebsiteStatusToggle } from "../website-status-toggle";

export type WebsiteCardWebsite = {
  id: string;
  website_name: string | null;
  wordpress_url: string | null;
  is_active: boolean | null;
  is_platform_blog: boolean | null;
  auto_schedule_enabled: boolean | null;
};

type WebsiteCardLabels = {
  autoSchedule: string;
  platformBlog: string;
  seoEditButton: string;
  status: string;
  viewArticles: string;
  edit: string;
  delete: string;
};

type WebsiteCardProps = {
  website: WebsiteCardWebsite;
  labels: WebsiteCardLabels;
  shoplineConnected: boolean;
  deleteWebsiteAction?: (formData: FormData) => void | Promise<void>;
};

export function WebsiteCard({
  website,
  labels,
  shoplineConnected,
  deleteWebsiteAction,
}: WebsiteCardProps) {
  const isPlatformBlog = website.is_platform_blog === true;

  return (
    <Card
      className={`hover:shadow-lg transition-shadow ${
        isPlatformBlog
          ? "border-primary/50 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30"
          : ""
      }`}
    >
      <Link href={`/dashboard/websites/${website.id}`}>
        <CardHeader className="cursor-pointer">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{website.website_name}</CardTitle>
            <div className="flex gap-1">
              {website.auto_schedule_enabled && (
                <Badge variant="secondary" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {labels.autoSchedule}
                </Badge>
              )}
              {isPlatformBlog && (
                <Badge
                  variant="default"
                  className="bg-gradient-to-r from-blue-600 to-purple-600"
                >
                  {labels.platformBlog}
                </Badge>
              )}
            </div>
          </div>
          <CardDescription className="break-all">
            {isPlatformBlog ? (
              <a
                href="/blog"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                /blog
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              website.wordpress_url
            )}
          </CardDescription>
        </CardHeader>
      </Link>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {labels.status}
            </span>
            <WebsiteStatusToggle
              websiteId={website.id}
              initialStatus={website.is_active ?? true}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href={`/dashboard/websites/${website.id}`}
              className="min-w-32 flex-1"
            >
              <Button variant="default" size="sm" className="w-full">
                {labels.viewArticles}
              </Button>
            </Link>
            {shoplineConnected && (
              <Link href={`/dashboard/websites/${website.id}/shopline`}>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  {labels.seoEditButton}
                </Button>
              </Link>
            )}
            <Link href={`/dashboard/websites/${website.id}/edit`}>
              <Button variant="outline" size="sm">
                {labels.edit}
              </Button>
            </Link>
            {!isPlatformBlog && deleteWebsiteAction && (
              <form action={deleteWebsiteAction} className="inline">
                <input type="hidden" name="websiteId" value={website.id} />
                <Button
                  variant="outline"
                  size="sm"
                  type="submit"
                  className="text-destructive hover:text-destructive"
                >
                  {labels.delete}
                </Button>
              </form>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
