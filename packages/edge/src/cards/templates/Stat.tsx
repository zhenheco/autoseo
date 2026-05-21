import { LogoMark } from "./Logo";
import {
  brandPrimaryColor,
  brandSecondaryColor,
  statText,
} from "./helpers";
import type { CardTemplateProps } from "../types";

export function Stat({ brand, article, size }: CardTemplateProps) {
  const stat = statText(article);
  const labelMaxWidth = Math.round(size.width * 0.72);
  const titleMaxWidth = Math.round(size.width * 0.62);

  return (
    <section
      style={{
        width: size.width,
        height: size.height,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: size.height > size.width ? 92 : 76,
        background: brandSecondaryColor(brand),
        color: "#0f172a",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          alignSelf: "flex-start",
          borderRadius: 999,
          padding: "18px 30px",
          background: brandPrimaryColor(brand),
          color: "#ffffff",
          fontSize: 30,
          fontWeight: 750,
        }}
      >
        {brand.name}
      </div>
      <main>
        <div
          style={{
            color: brandPrimaryColor(brand),
            fontSize: size.height > size.width ? 260 : 220,
            lineHeight: 0.9,
            fontWeight: 900,
          }}
        >
          {stat.number}
        </div>
        <div
          style={{
            maxWidth: labelMaxWidth,
            marginTop: 28,
            fontSize: size.height > size.width ? 76 : 64,
            lineHeight: 1.05,
            fontWeight: 820,
          }}
        >
          {stat.label}
        </div>
      </main>
      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 36,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 650, maxWidth: titleMaxWidth }}>
          {article.title}
        </div>
        <LogoMark brand={brand} />
      </footer>
    </section>
  );
}
