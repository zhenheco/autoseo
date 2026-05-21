import { LogoMark } from "./Logo";
import {
  articleHeroImageUrl,
  articleSubtitle,
  brandPrimaryColor,
} from "./helpers";
import type { CardTemplateProps } from "../types";

export function Hero({ brand, article, size }: CardTemplateProps) {
  const heroImageUrl = articleHeroImageUrl(article);
  const titleMaxWidth = Math.round(size.width * 0.84);
  const subtitleMaxWidth = Math.round(size.width * 0.74);

  return (
    <section
      style={{
        position: "relative",
        width: size.width,
        height: size.height,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: size.height > size.width ? 88 : 72,
        background: heroImageUrl
          ? `linear-gradient(0deg, ${brandPrimaryColor(brand)}cc, ${brandPrimaryColor(brand)}88), url("${heroImageUrl}") center / cover`
          : brandPrimaryColor(brand),
        color: "#ffffff",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 36,
          fontSize: 34,
          fontWeight: 760,
        }}
      >
        <span>{brand.name}</span>
        <LogoMark brand={brand} />
      </header>
      <main>
        <h1
          style={{
            margin: 0,
            maxWidth: titleMaxWidth,
            fontSize: size.height > size.width ? 80 : 66,
            lineHeight: 1.02,
            fontWeight: 900,
          }}
        >
          {article.title}
        </h1>
        <p
          style={{
            margin: "32px 0 0",
            maxWidth: subtitleMaxWidth,
            fontSize: size.height > size.width ? 42 : 34,
            lineHeight: 1.24,
            fontWeight: 580,
            opacity: 0.92,
          }}
        >
          {articleSubtitle(article)}
        </p>
      </main>
    </section>
  );
}
