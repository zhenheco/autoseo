import { redirect } from "next/navigation";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const url = new URL("/", "https://placeholder.local");

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      url.searchParams.set(key, value);
    }
  }

  redirect(`${url.pathname}${url.search}#pricing`);
}
