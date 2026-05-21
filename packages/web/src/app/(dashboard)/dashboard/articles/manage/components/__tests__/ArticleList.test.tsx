import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArticleList } from "../ArticleList";
import { ScheduleProvider } from "../ScheduleContext";

vi.mock("next-intl", () => ({
  useLocale: vi.fn(() => "en-US"),
  useTranslations: vi.fn(
    () => (key: string, values?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        "table.noArticles": "No articles",
        "table.selectAll": "Select all",
        "pagination.perPage": "Per page",
        "pagination.page": "Page {current} of {total}",
        "pagination.prev": "Prev",
        "pagination.next": "Next",
        "status.pending": "Pending",
      };
      let message = messages[key] ?? key;
      for (const [name, value] of Object.entries(values ?? {})) {
        message = message.replace(`{${name}}`, String(value));
      }
      return message;
    },
  ),
}));

describe("ArticleList", () => {
  it("renders the EmptyState when no articles are returned", () => {
    render(
      <ScheduleProvider>
        <ArticleList articles={[]} selectableArticleIds={[]} />
      </ScheduleProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "No articles" }),
    ).toBeInTheDocument();
  });
});
