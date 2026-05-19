import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WebsiteCard } from "../WebsiteCard";

const website = {
  id: "website-1",
  website_name: "Demo Store",
  wordpress_url: "https://demo.example.com",
  is_active: true,
  is_platform_blog: false,
  auto_schedule_enabled: false,
};

const labels = {
  autoSchedule: "Auto schedule",
  platformBlog: "Platform blog",
  seoEditButton: "SEO Edit",
  status: "Status",
  viewArticles: "View articles",
  edit: "Edit",
  delete: "Delete",
};

describe("WebsiteCard", () => {
  it("renders the SEO edit button when SHOPLINE is connected", () => {
    render(
      <WebsiteCard
        website={website}
        labels={labels}
        shoplineConnected={true}
      />,
    );

    expect(screen.getByRole("link", { name: /seo edit/i })).toBeInTheDocument();
  });

  it("does not render the SEO edit button when SHOPLINE is not connected", () => {
    render(
      <WebsiteCard
        website={website}
        labels={labels}
        shoplineConnected={false}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /seo edit/i }),
    ).not.toBeInTheDocument();
  });

  it("links the SEO edit button to the website SHOPLINE dashboard", () => {
    render(
      <WebsiteCard
        website={website}
        labels={labels}
        shoplineConnected={true}
      />,
    );

    expect(screen.getByRole("link", { name: /seo edit/i })).toHaveAttribute(
      "href",
      "/dashboard/websites/website-1/shopline",
    );
  });
});
