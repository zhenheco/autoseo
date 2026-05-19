#!/usr/bin/env tsx

import { ShoplineClient } from "../src/lib/shopline/client";
import { resolveShoplineCliAuth } from "../src/lib/shopline/cli-auth";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
} from "../src/lib/shopline/oauth";

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): { command: string; args: Args } {
  const [command = "help", ...rest] = argv;
  const args: Args = {};

  for (let index = 0; index < rest.length; index++) {
    const item = rest[index];
    if (!item.startsWith("--")) continue;

    const key = item.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index++;
  }

  return { command, args };
}

function arg(args: Args, name: string, envName?: string): string | undefined {
  const value = args[name];
  if (typeof value === "string" && value.length > 0) return value;
  if (envName && process.env[envName]) return process.env[envName];
  return undefined;
}

function requireValue(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required`);
  return value;
}

function printHelp(): void {
  console.log(`Usage:
  pnpm shopline:cli install-url --shop-handle <handle> [--workspace-id cli] [--site-id cli]
  pnpm shopline:cli check --shop-handle <handle> --access-token <token>
  pnpm shopline:cli check --company-id <companyId> --website-id <websiteId>
  pnpm shopline:cli products --shop-handle <handle> --access-token <token> [--limit 5]
  pnpm shopline:cli products --company-id <companyId> --shop-handle <handle> [--limit 5]
  pnpm shopline:cli seo-update --product-id <id> --seo-title <t> --seo-description <d> [--handle <h>] [--shop-handle <handle> --access-token <token>]
  pnpm shopline:cli seo-update --product-id <id> --seo-title <t> --company-id <companyId> --website-id <websiteId>
  pnpm shopline:cli exchange-code --shop-handle <handle> --code <oauth-code>

Env fallbacks:
  SHOPLINE_SHOP_HANDLE
  SHOPLINE_ACCESS_TOKEN
  SHOPLINE_COMPANY_ID
  SHOPLINE_WEBSITE_ID
  SHOPLINE_CLIENT_ID
  SHOPLINE_CLIENT_SECRET
  SHOPLINE_REDIRECT_URI
  SHOPLINE_CUSTOMIZED_INSTALL_URL_TEMPLATE
  OAUTH_STATE_SECRET

Secrets are accepted as input but never printed.`);
}

async function installUrl(args: Args): Promise<void> {
  const shopHandle = requireValue(
    arg(args, "shop-handle", "SHOPLINE_SHOP_HANDLE"),
    "shop handle",
  );
  const workspaceId = arg(args, "workspace-id") ?? "cli";
  const siteId = arg(args, "site-id") ?? "cli";
  const returnTo = arg(args, "return-to");

  const result = await buildAuthorizeUrl({
    workspaceId,
    siteId,
    shopHandle,
    returnTo,
  });
  console.log(`install_url=${result.url}`);
  console.log(`cookie_nonce=${result.cookieNonce}`);
  console.log(
    "cookie_nonce is required only when validating the browser callback state.",
  );
}

async function getClient(
  args: Args,
): Promise<{ client: ShoplineClient; shopHandle: string }> {
  const auth = await resolveShoplineCliAuth({
    args,
    env: process.env,
  });

  const client = new ShoplineClient({
    shopHandle: auth.shopHandle,
    accessToken: auth.accessToken,
  });

  return { client, shopHandle: auth.shopHandle };
}

async function check(args: Args): Promise<void> {
  const { client, shopHandle } = await getClient(args);
  const products = await client.listProducts({ limit: 5 });
  const sitemapUrls = await client.getSitemapUrls();

  console.log("shopline_check=pass");
  console.log(`shop_handle=${shopHandle}`);
  console.log(`shop_domain=${shopHandle}.myshopline.com`);
  console.log(`sample_products=${products.products.length}`);
  console.log(`sitemap_urls=${sitemapUrls.length}`);
}

async function products(args: Args): Promise<void> {
  const { client } = await getClient(args);
  const limit = Number(arg(args, "limit") ?? "5");
  const result = await client.listProducts({ limit });

  console.log(`products_count=${result.products.length}`);
  for (const product of result.products) {
    console.log(`${product.id}\t${product.handle}\t${product.title}`);
  }
  if (result.next?.pageInfo) console.log("next_page_info=present");
  if (result.next?.page) console.log(`next_page=${result.next.page}`);
}

async function seoUpdate(args: Args): Promise<void> {
  const productId = requireValue(arg(args, "product-id"), "product id");
  const seoTitle = arg(args, "seo-title");
  const seoDescription = arg(args, "seo-description");
  const handle = arg(args, "handle");

  if (!seoTitle && !seoDescription && !handle) {
    throw new Error(
      "at least one of --seo-title, --seo-description, --handle is required",
    );
  }

  const { client } = await getClient(args);
  const updated = await client.updateProduct(productId, {
    seo:
      seoTitle || seoDescription
        ? { title: seoTitle, description: seoDescription }
        : undefined,
    handle,
  });

  console.log("shopline_seo_update=pass");
  console.log(`product_id=${updated.id}`);
  console.log(`handle=${updated.handle}`);
  if (updated.seo?.title) console.log(`seo_title=${updated.seo.title}`);
  if (updated.seo?.description)
    console.log(`seo_description_len=${updated.seo.description.length}`);
}

async function exchangeCode(args: Args): Promise<void> {
  const shopHandle = requireValue(
    arg(args, "shop-handle", "SHOPLINE_SHOP_HANDLE"),
    "shop handle",
  );
  const code = requireValue(arg(args, "code"), "oauth code");
  const token = await exchangeCodeForToken(shopHandle, code);

  console.log("shopline_token_exchange=pass");
  console.log(`scope=${token.scope}`);
  console.log(
    `access_token_received=${token.access_token.length > 0 ? "yes" : "no"}`,
  );
  console.log("access_token_value=not_printed");
}

async function main(): Promise<void> {
  const { command, args } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "install-url":
      await installUrl(args);
      return;
    case "check":
      await check(args);
      return;
    case "products":
      await products(args);
      return;
    case "seo-update":
      await seoUpdate(args);
      return;
    case "exchange-code":
      await exchangeCode(args);
      return;
    case "help":
    default:
      printHelp();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
