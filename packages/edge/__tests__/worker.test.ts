import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/worker";

type MockHandler = {
  element?: (element: MockElement) => void;
};

class MockElement {
  constructor(
    private readonly source: string,
    private readonly setHtml: (value: string) => void,
  ) {}

  setAttribute(name: string, value: string) {
    const escaped = escapeAttribute(value);
    const attributePattern = new RegExp(`\\s${name}="[^"]*"`, "i");
    if (attributePattern.test(this.source)) {
      this.setHtml(
        this.source.replace(attributePattern, ` ${name}="${escaped}"`),
      );
      return;
    }

    this.setHtml(this.source.replace(/>$/, ` ${name}="${escaped}">`));
  }

  append(content: string) {
    this.setHtml(this.source.replace("</head>", `${content}</head>`));
  }
}

class MockHTMLRewriter {
  private readonly handlers: Array<{ selector: string; handler: MockHandler }> =
    [];

  on(selector: string, handler: MockHandler) {
    this.handlers.push({ selector, handler });
    return this;
  }

  transform(response: Response): Response {
    const stream = new ReadableStream({
      start: async (controller) => {
        const html = await response.text();
        let next = html;
        for (const { selector, handler } of this.handlers) {
          const pattern = selectorPattern(selector);
          next = next.replace(pattern, (source) => {
            let replacement = source;
            handler.element?.(
              new MockElement(source, (value) => {
                replacement = value;
              }),
            );
            return replacement;
          });
        }
        controller.enqueue(new TextEncoder().encode(next));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: response.headers,
      status: response.status,
    });
  }
}

function selectorPattern(selector: string) {
  switch (selector) {
    case 'meta[name="description"]':
      return /<meta\b(?=[^>]*\bname="description")[^>]*>/gi;
    case 'meta[property="og:image"]':
      return /<meta\b(?=[^>]*\bproperty="og:image")[^>]*>/gi;
    case 'meta[property="og:title"]':
      return /<meta\b(?=[^>]*\bproperty="og:title")[^>]*>/gi;
    case 'link[rel="canonical"]':
      return /<link\b(?=[^>]*\brel="canonical")[^>]*>/gi;
    case "head":
      return /<head>[\s\S]*?<\/head>/i;
    default:
      throw new Error(`Unsupported selector in test: ${selector}`);
  }
}

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function kv(rulesByKey: Record<string, unknown>) {
  return {
    get: vi.fn(async (key: string) => rulesByKey[key] ?? null),
  } as unknown as KVNamespace;
}

describe("edge worker", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLRewriter", MockHTMLRewriter);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            [
              "<html><head><title>Demo</title>",
              '<meta name="description" content="Original">',
              '<meta property="og:title" content="Original OG">',
              '<meta property="og:image" content="https://example.com/old.png">',
              '<link rel="canonical" href="https://example.com/old">',
              "</head><body>Hello</body></html>",
            ].join(""),
            { headers: { "content-type": "text/html" } },
          ),
      ),
    );
  });

  it("passes through the upstream response when KV has no matching key", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/products/demo"),
      { EDGE_RULES: kv({}) },
    );

    await expect(response.text()).resolves.toContain(
      '<meta name="description" content="Original">',
    );
  });

  it("injects a meta description rule from KV", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/products/demo"),
      {
        EDGE_RULES: kv({
          "example.com:/products/demo": [
            {
              type: "meta-description",
              value: "A sharper edge-rendered description.",
            },
          ],
        }),
      },
    );

    await expect(response.text()).resolves.toContain(
      '<meta name="description" content="A sharper edge-rendered description.">',
    );
  });

  it("injects multiple rules into the same upstream response", async () => {
    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Demo",
    });
    const response = await worker.fetch(
      new Request("https://example.com/products/demo"),
      {
        EDGE_RULES: kv({
          "example.com:/products/demo": [
            { type: "og-title", value: "Edge OG title" },
            {
              type: "og-image",
              value: "https://cdn.example.com/edge-og.png",
            },
            {
              type: "canonical",
              value: "https://example.com/products/demo",
            },
            { type: "structured-data-jsonld", value: jsonLd },
          ],
        }),
      },
    );

    const html = await response.text();
    expect(html).toContain(
      '<meta property="og:title" content="Edge OG title">',
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://cdn.example.com/edge-og.png">',
    );
    expect(html).toContain(
      '<link rel="canonical" href="https://example.com/products/demo">',
    );
    expect(html).toContain(
      `<script type="application/ld+json">${jsonLd}</script>`,
    );
  });

  it("uses the wildcard host fallback when the path key is missing", async () => {
    const namespace = kv({
      "example.com:*": [
        {
          type: "meta-description",
          value: "Wildcard description for this host.",
        },
      ],
    });

    const response = await worker.fetch(
      new Request("https://example.com/products/demo"),
      { EDGE_RULES: namespace },
    );

    await expect(response.text()).resolves.toContain(
      '<meta name="description" content="Wildcard description for this host.">',
    );
    expect(namespace.get).toHaveBeenNthCalledWith(
      1,
      "example.com:/products/demo",
      "json",
    );
    expect(namespace.get).toHaveBeenNthCalledWith(2, "example.com:*", "json");
  });
});
