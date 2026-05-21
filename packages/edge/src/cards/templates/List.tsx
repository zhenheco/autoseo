import { LogoMark } from "./Logo";
import { articleTakeaways, brandPrimaryColor } from "./helpers";
import type { CardTemplateProps } from "../types";

export function List({ brand, article, size }: CardTemplateProps) {
  const takeaways = articleTakeaways(article).slice(0, 3);
  const titleMaxWidth = Math.round(size.width * 0.78);

  return (
    <section
      style={{
        width: size.width,
        height: size.height,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: size.height > size.width ? 86 : 70,
        background: "#ffffff",
        color: "#111827",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <header>
        <div
          style={{
            color: brandPrimaryColor(brand),
            fontSize: 34,
            fontWeight: 800,
            marginBottom: 32,
          }}
        >
          {brand.name}
        </div>
        <h1
          style={{
            margin: 0,
            maxWidth: titleMaxWidth,
            fontSize: size.height > size.width ? 72 : 58,
            lineHeight: 1.06,
            fontWeight: 860,
          }}
        >
          {article.title}
        </h1>
      </header>
      <ol
        style={{
          display: "flex",
          flexDirection: "column",
          gap: size.height > size.width ? 44 : 32,
          margin: 0,
          padding: 0,
          listStyle: "none",
        }}
      >
        {takeaways.map((takeaway, index) => (
          <li
            key={takeaway}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 28,
              fontSize: size.height > size.width ? 54 : 44,
              lineHeight: 1.16,
              fontWeight: 720,
            }}
          >
            <span
              style={{
                flex: "0 0 auto",
                width: 68,
                height: 68,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: brandPrimaryColor(brand),
                color: "#ffffff",
                fontSize: 34,
                fontWeight: 850,
              }}
            >
              {index + 1}
            </span>
            <span>{takeaway}</span>
          </li>
        ))}
      </ol>
      <footer style={{ display: "flex", justifyContent: "flex-end" }}>
        <LogoMark brand={brand} />
      </footer>
    </section>
  );
}
