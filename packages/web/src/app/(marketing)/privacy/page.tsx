import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function PrivacyPage() {
  const t = await getTranslations("legal");
  const p = await getTranslations("legal.privacy");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("returnHome")}
          </Button>
        </Link>

        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {p("title")}
          </h1>

          <div className="prose dark:prose-invert max-w-none">
            <section className="mb-8">
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                {p("intro")}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {p("section1Title")}
              </h2>

              <p className="text-slate-600 dark:text-slate-300 mb-3">
                {p("section1Content1")}
              </p>

              <p className="text-slate-600 dark:text-slate-300 mb-3">
                {p("section1Content2")}
              </p>

              <p className="text-slate-600 dark:text-slate-300 mb-3">
                {p("section1Content3")}
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{p("section1List1")}</li>
                <li>{p("section1List2")}</li>
                <li>{p("section1List3")}</li>
              </ul>

              <p className="text-slate-600 dark:text-slate-300 mt-4">
                {p("section1Content4")}
              </p>

              <p className="text-slate-600 dark:text-slate-300 mt-4">
                {p("section1Content5")}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {p("section2Title")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                {p("section2Content1")}
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{p("section2List1")}</li>
                <li>{p("section2List2")}</li>
                <li>{p("section2List3")}</li>
                <li>{p("section2List4")}</li>
              </ul>

              <p className="text-slate-600 dark:text-slate-300 mt-4">
                {p("section2Content2")}
              </p>

              <p className="text-slate-600 dark:text-slate-300 mt-4">
                {p("section2Content3")}
              </p>

              <p className="text-slate-600 dark:text-slate-300 mt-4">
                {p("section2Content4")}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {p("section3Title")}
              </h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{p("section3List1")}</li>
                <li>{p("section3List2")}</li>
                <li>{p("section3List3")}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {p("section4Title")}
              </h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{p("section4List1")}</li>
                <li>{p("section4List2")}</li>
                <li>{p("section4List3")}</li>
                <li>{p("section4List4")}</li>
                <li>{p("section4List5")}</li>
                <li>{p("section4List6")}</li>
                <li>{p("section4List7")}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {p("section5Title")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                {p("section5Content")}
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{p("section5List1")}</li>
                <li>{p("section5List2")}</li>
                <li>{p("section5List3")}</li>
                <li>{p("section5List4")}</li>
                <li>{p("section5List5")}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {p("section6Title")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                {p("section6Content")}
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-2">
                {p("section6_1Title")}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                {p("section6_1Content")}
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{p("section6_1List1")}</li>
                <li>{p("section6_1List2")}</li>
                <li>{p("section6_1List3")}</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300 mt-3">
                {p("section6_1Scope")}
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-2">
                {p("section6_2Title")}
              </h3>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{p("section6_2List1")}</li>
                <li>{p("section6_2List2")}</li>
                <li>{p("section6_2List3")}</li>
                <li>{p("section6_2List4")}</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300 mt-3">
                {p("section6_2Content")}
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-2">
                {p("section6_3Title")}
              </h3>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{p("section6_3List1")}</li>
                <li>{p("section6_3List2")}</li>
                <li>{p("section6_3List3")}</li>
              </ul>

              <h3 className="text-xl font-semibold mt-4 mb-2">
                {p("section6_4Title")}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                {p("section6_4Content")}
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{p("section6_4List1")}</li>
                <li>
                  {p("section6_4List2")}{" "}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {p("googleAccountSettings")}
                  </a>
                </li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300 mt-3">
                {p("section6_4Content2")}
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-2">
                {p("section6_5Title")}
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                {p("section6_5Content")}{" "}
                <a
                  href="https://developers.google.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {p("googleApiTerms")}
                </a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {p("section7Title")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                {p("section7Content")}
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{p("section7List1")}</li>
                <li>{p("section7List2")}</li>
                <li>{p("section7List3")}</li>
                <li>{p("section7List4")}</li>
                <li>{p("section7List5")}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {p("section8Title")}
              </h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{p("section8List1")}</li>
                <li>{p("section8List2")}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {p("section9Title")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                {p("section9Content")}
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-2">
                {p("contactEmail")}
              </p>
            </section>

            <section>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("lastUpdated")}：{p("lastUpdatedDate")}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
