"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Plus, Tags, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@shared/ui/alert-dialog";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shared/ui/table";
import { Textarea } from "@shared/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";

export interface BrandListItem {
  id: string;
  name: string;
  voiceTone: string | null;
  valueProps: string[];
  isDefault: boolean;
  createdAt: string;
  websiteCount: number;
  socialAccountCount: number | null;
}

export interface BrandQuotaSummary {
  used: number;
  cap: number;
  plan: "Solo" | "Pro";
  upgradeUrl: string;
}

interface BrandsListClientProps {
  initialBrands: BrandListItem[];
  quota: BrandQuotaSummary;
}

type BrandApiResponse =
  | {
      success: true;
      data?: {
        id: string;
        name: string;
      };
    }
  | {
      success: false;
      error?: string;
    };

export function BrandsListClient({
  initialBrands,
  quota,
}: BrandsListClientProps) {
  const t = useTranslations("dashboard.brands");
  const router = useRouter();
  const [brands, setBrands] = useState(initialBrands);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [voiceTone, setVoiceTone] = useState("");
  const [valueProps, setValueProps] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const quotaUsed = brands.length;
  const isAtCap = quotaUsed >= quota.cap;
  const quotaLabel = t("quotaUsage", {
    used: quotaUsed,
    cap: quota.cap,
    plan: quota.plan,
  });

  const formattedBrands = useMemo(
    () =>
      brands.map((brand) => ({
        ...brand,
        createdDate: new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(new Date(brand.createdAt)),
      })),
    [brands],
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          voiceTone: voiceTone.trim() || null,
          valueProps: valueProps
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      const body = (await response.json()) as BrandApiResponse;

      if (!response.ok || !body.success || !body.data?.id) {
        throw new Error(!body.success ? body.error : t("failedToCreate"));
      }

      const createdBrand = body.data;
      setBrands((current) => [
        ...current,
        {
          id: createdBrand.id,
          name: createdBrand.name,
          voiceTone: voiceTone.trim() || null,
          valueProps: valueProps
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          isDefault: false,
          createdAt: new Date().toISOString(),
          websiteCount: 0,
          socialAccountCount: null,
        },
      ]);
      setDialogOpen(false);
      setName("");
      setVoiceTone("");
      setValueProps("");
      router.refresh();
      router.push(
        `/dashboard/brands/${createdBrand.id}/memory?brand=${createdBrand.id}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("failedToCreate"));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(brandId: string) {
    setDeletingId(brandId);
    setError(null);

    try {
      const response = await fetch(`/api/brands/${brandId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(t("failedToDelete"));
      }

      setBrands((current) => current.filter((brand) => brand.id !== brandId));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("failedToDelete"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">{t("title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("description")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{quotaLabel}</span>
            {isAtCap && (
              <Link href={quota.upgradeUrl} className="text-primary underline">
                {t("upgrade")}
              </Link>
            )}
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={isAtCap}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addBrand")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("addBrand")}</DialogTitle>
              <DialogDescription>{t("dialogDescription")}</DialogDescription>
            </DialogHeader>
            <form
              aria-label={t("addBrand")}
              className="space-y-4"
              onSubmit={handleCreate}
            >
              <div className="space-y-2">
                <Label htmlFor="brand-name">{t("name")}</Label>
                <Input
                  id="brand-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand-voice-tone">{t("voiceTone")}</Label>
                <Input
                  id="brand-voice-tone"
                  value={voiceTone}
                  onChange={(event) => setVoiceTone(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand-value-props">{t("valueProps")}</Label>
                <Textarea
                  id="brand-value-props"
                  value={valueProps}
                  placeholder={t("valuePropsPlaceholder")}
                  onChange={(event) => setValueProps(event.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? t("creating") : t("create")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {brands.length === 0 ? (
        <EmptyState
          icon={<Tags className="h-6 w-6" />}
          title={t("noBrandsYet")}
          description={t("emptyDescription")}
          action={{
            label: t("createFirstBrand"),
            onClick: () => setDialogOpen(true),
          }}
        />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("websitesLinked")}</TableHead>
                <TableHead>{t("socialAccountsLinked")}</TableHead>
                <TableHead>{t("created")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formattedBrands.map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{brand.name}</span>
                      {brand.isDefault && (
                        <Badge variant="secondary">{t("defaultBadge")}</Badge>
                      )}
                    </div>
                    {brand.voiceTone && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {brand.voiceTone}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{brand.websiteCount}</TableCell>
                  <TableCell>
                    {brand.socialAccountCount ?? t("socialAccountsUnavailable")}
                  </TableCell>
                  <TableCell>{brand.createdDate}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/brands/${brand.id}/memory`}>
                          {t("edit")}
                        </Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("delete")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("deleteTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("deleteDescription")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => void handleDelete(brand.id)}
                              disabled={deletingId === brand.id}
                            >
                              {t("confirmDelete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
