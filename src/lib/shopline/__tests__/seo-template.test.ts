import { describe, expect, it } from "vitest";
import { renderSeoTemplate } from "../seo-template";

describe("renderSeoTemplate", () => {
  it("replaces product and shop variables", () => {
    expect(
      renderSeoTemplate("Buy {{product.title}} from {{shop.name}}", {
        product: { title: "Cotton Tee" },
        shop: { name: "Demo Shop" },
      }),
    ).toBe("Buy Cotton Tee from Demo Shop");
  });

  it("renders missing context variables as empty strings", () => {
    expect(
      renderSeoTemplate("{{product.vendor}} {{collection.title}}", {
        product: { title: "Cotton Tee" },
      }),
    ).toBe(" ");
  });

  it("supports multiple variables in one string", () => {
    expect(
      renderSeoTemplate(
        "{{product.title}} | {{product.vendor}} | {{product.type}} | {{shop.name}}",
        {
          product: {
            title: "Cotton Tee",
            vendor: "Acme",
            type: "Apparel",
          },
          shop: { name: "Demo Shop" },
        },
      ),
    ).toBe("Cotton Tee | Acme | Apparel | Demo Shop");
  });

  it("escapes xss-sensitive HTML characters", () => {
    expect(
      renderSeoTemplate("{{product.title}}", {
        product: { title: `<Tee> & 'Quote' "Double"` },
      }),
    ).toBe("&lt;Tee&gt; &amp; &#39;Quote&#39; &quot;Double&quot;");
  });

  it("keeps strings without supported variables unchanged", () => {
    expect(renderSeoTemplate("Static title", {})).toBe("Static title");
  });
});
