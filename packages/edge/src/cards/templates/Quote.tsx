import { LogoMark } from "./Logo";
import { brandPrimaryColor, quoteText } from "./helpers";
import type { CardTemplateProps } from "../types";

export function Quote({ brand, article, size }: CardTemplateProps) {
  const quoteMaxWidth = Math.round(size.width * 0.82);

  return (
    <section
      style={{
        width: size.width,
        height: size.height,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: size.height > size.width ? 88 : 72,
        background: brandPrimaryColor(brand),
        color: "#ffffff",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ fontSize: 38, fontWeight: 700, opacity: 0.78 }}>
        {brand.name}
      </div>
      <blockquote
        style={{
          margin: 0,
          maxWidth: quoteMaxWidth,
          fontSize: size.height > size.width ? 84 : 72,
          lineHeight: 1.04,
          fontWeight: 800,
        }}
      >
        "{quoteText(article)}"
      </blockquote>
      <footer
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 36,
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 650, opacity: 0.88 }}>
          {article.title}
        </div>
        <LogoMark brand={brand} />
      </footer>
    </section>
  );
}
