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
    const transformed = response.text().then((html) => {
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
      return next;
    });

    return new Response(transformed, {
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
            '<html><head><title>Demo</title><meta name="description" content="Original"></head><body>Hello</body></html>',
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
});
