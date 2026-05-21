import { headers } from "next/headers";
import type { Brand } from "./active-brand";

type ApiResponse<T> =
  | {
      success: true;
      data?: T;
    }
  | {
      success: false;
      error?: string;
    };

export async function fetchBrandsFromApi(): Promise<Brand[]> {
  const headerStore = await headers();
  const response = await fetch(buildApiUrl("/api/brands", headerStore), {
    cache: "no-store",
    headers: {
      cookie: headerStore.get("cookie") ?? "",
    },
  });

  if (!response.ok) {
    console.error("[Brands] API list failed:", response.status);
    return [];
  }

  const body = (await response.json()) as ApiResponse<Brand[]>;
  if (!body.success || !Array.isArray(body.data)) return [];

  return body.data;
}

export async function buildCurrentDashboardRequest(): Promise<Request> {
  const headerStore = await headers();
  return new Request(buildApiUrl("/dashboard", headerStore), {
    headers: {
      cookie: headerStore.get("cookie") ?? "",
    },
  });
}

function buildApiUrl(path: string, headerStore: Headers): string {
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "localhost:3168";
  const proto =
    headerStore.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  return `${proto}://${host}${path}`;
}
