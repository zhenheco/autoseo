type SeoTemplateContext = {
  product?: {
    title?: string;
    vendor?: string;
    type?: string;
  };
  collection?: {
    title?: string;
  };
  shop?: {
    name?: string;
  };
};

const VARIABLE_GETTERS: Record<
  string,
  (context: SeoTemplateContext) => string | undefined
> = {
  "product.title": (context) => context.product?.title,
  "product.vendor": (context) => context.product?.vendor,
  "product.type": (context) => context.product?.type,
  "collection.title": (context) => context.collection?.title,
  "shop.name": (context) => context.shop?.name,
};

export function renderSeoTemplate(
  template: string,
  context: SeoTemplateContext,
): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, variable) => {
    const getter = VARIABLE_GETTERS[String(variable).trim()];
    if (!getter) return match;

    return escapeHtml(getter(context) ?? "");
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
