export type EdgeRule =
  | { type: "meta-description"; value: string }
  | { type: "og-image"; value: string }
  | { type: "og-title"; value: string }
  | { type: "canonical"; value: string }
  | { type: "structured-data-jsonld"; value: string };

export function applyHtmlRewrites(
  response: Response,
  rules: EdgeRule[],
): Response {
  const rewriter = new HTMLRewriter();

  for (const rule of rules) {
    switch (rule.type) {
      case "meta-description":
        rewriter.on('meta[name="description"]', {
          element(element) {
            element.setAttribute("content", rule.value);
          },
        });
        break;
      case "og-image":
        rewriter.on('meta[property="og:image"]', {
          element(element) {
            element.setAttribute("content", rule.value);
          },
        });
        break;
      case "og-title":
        rewriter.on('meta[property="og:title"]', {
          element(element) {
            element.setAttribute("content", rule.value);
          },
        });
        break;
      case "canonical":
        rewriter.on('link[rel="canonical"]', {
          element(element) {
            element.setAttribute("href", rule.value);
          },
        });
        break;
      case "structured-data-jsonld":
        rewriter.on("head", {
          element(element) {
            element.append(
              `<script type="application/ld+json">${rule.value}</script>`,
              { html: true },
            );
          },
        });
        break;
    }
  }

  return rewriter.transform(response);
}
