import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { getStripeClient } from "@/lib/payments/stripe/server";

type WelcomePageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const params = await searchParams;
  const sessionId = params.session_id;

  if (!sessionId) {
    redirect("/pricing?error=missing_checkout_session");
  }

  const session = await getStripeClient().retrieveCheckoutSession(sessionId);
  const hasAcceptedTrialPayment =
    session.mode === "subscription" &&
    (session.payment_status === "paid" ||
      session.payment_status === "no_payment_required");

  if (!hasAcceptedTrialPayment) {
    redirect("/pricing?error=checkout_incomplete");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-500/10">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
        </div>
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Trial active
        </p>
        <h1 className="mt-3 text-3xl font-semibold">您的試用已開始</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          It might take a moment for your trial to fully activate. We are
          finishing the billing sync in the background.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          前往 Dashboard
        </Link>
      </section>
    </main>
  );
}
