import { expect, test } from "@playwright/test";

test.skip(
  !process.env.STRIPE_API_KEY_TEST,
  "Stripe Checkout e2e requires STRIPE_API_KEY_TEST. Run locally with op run; CI skips without it.",
);

test.describe("Stripe Checkout onboarding", () => {
  test("completes signup to trial-pending welcome through Stripe Checkout", async ({
    page,
  }) => {
    const visitedUrls: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        visitedUrls.push(frame.url());
      }
    });

    const email = `stripe-checkout-${Date.now()}@example.com`;
    const password = `Test-${Date.now()}-password`;

    await page.goto("/signup?plan=solo_monthly");
    await expect(page).toHaveURL(/\/login\?mode=signup.*plan=solo_monthly/);

    await page.getByLabel(/email|電子信箱/i).fill(email);
    const passwordFields = page.locator('input[type="password"]');
    await passwordFields.nth(0).fill(password);
    await passwordFields.nth(1).fill(password);
    await page.getByRole("button", { name: /註冊|register|sign up/i }).click();

    await expect(page).toHaveURL(/\/onboarding\/billing\?plan=solo_monthly/, {
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 45_000 });

    await page.getByLabel(/card number/i).fill("4242 4242 4242 4242");
    await page.getByLabel(/expiration|expiry/i).fill("12 / 34");
    await page.getByLabel(/security code|cvc/i).fill("123");

    const nameOnCard = page.getByLabel(/cardholder name|name on card/i);
    if ((await nameOnCard.count()) > 0) {
      await nameOnCard.fill("Stripe Test Buyer");
    }

    const country = page.getByLabel(/country or region|country/i);
    if ((await country.count()) > 0) {
      await country.selectOption("US").catch(async () => {
        await country.fill("United States");
      });
    }

    const postalCode = page.getByLabel(/zip|postal code/i);
    if ((await postalCode.count()) > 0) {
      await postalCode.fill("94107");
    }

    await page
      .getByRole("button", {
        name: /start trial|subscribe|pay|submit|confirm/i,
      })
      .click();

    await expect(page).toHaveURL(/\/onboarding\/welcome\?session_id=cs_/, {
      timeout: 60_000,
    });
    await expect(
      page.getByText(/It might take a moment for your trial to fully activate/),
    ).toBeVisible();

    expect(visitedUrls.some((url) => url.includes("/signup"))).toBe(true);
    expect(
      visitedUrls.some((url) =>
        url.includes("/onboarding/billing?plan=solo_monthly"),
      ),
    ).toBe(true);
    expect(visitedUrls.some((url) => url.includes("checkout.stripe.com"))).toBe(
      true,
    );
    expect(visitedUrls.some((url) => url.includes("/onboarding/welcome"))).toBe(
      true,
    );
  });
});
