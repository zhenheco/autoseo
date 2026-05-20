import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function TermsPage() {
  const t = await getTranslations("legal");
  const terms = await getTranslations("legal.terms");

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
            {terms("title")}
          </h1>

          <div className="prose dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {terms("section1Title")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                {terms("section1Content")}
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{terms("section1List1")}</li>
                <li>{terms("section1List2")}</li>
                <li>{terms("section1List3")}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {terms("section2Title")}
              </h2>

              <h3 className="text-xl font-semibold mb-3 mt-6">
                {terms("section2_1Title")}
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                {terms("section2_1Content")}
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6">
                {terms("section2_2Title")}
              </h3>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{terms("section2_2List1")}</li>
                <li>{terms("section2_2List2")}</li>
                <li>{terms("section2_2List3")}</li>
                <li>{terms("section2_2List4")}</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6">
                {terms("section2_3Title")}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                {terms("section2_3Content")}
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{terms("section2_3List1")}</li>
                <li>{terms("section2_3List2")}</li>
                <li>{terms("section2_3List3")}</li>
                <li>{terms("section2_3List4")}</li>
                <li>{terms("section2_3List5")}</li>
                <li>{terms("section2_3List6")}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {terms("section3Title")}
              </h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{terms("section3List1")}</li>
                <li>{terms("section3List2")}</li>
                <li>{terms("section3List3")}</li>
                <li>{terms("section3List4")}</li>
                <li>{terms("section3List5")}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {terms("section4Title")}
              </h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{terms("section4List1")}</li>
                <li>{terms("section4List2")}</li>
                <li>{terms("section4List3")}</li>
                <li>{terms("section4List4")}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {terms("section5Title")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                {terms("section5Content1")}
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{terms("section5List1")}</li>
                <li>{terms("section5List2")}</li>
                <li>{terms("section5List3")}</li>
                <li>{terms("section5List4")}</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300 mb-3 mt-4">
                {terms("section5Content2")}
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{terms("section5List5")}</li>
                <li>{terms("section5List6")}</li>
                <li>{terms("section5List7")}</li>
                <li>{terms("section5List8")}</li>
              </ul>
              <p className="text-slate-600 dark:text-slate-300 mb-3 mt-4">
                {terms("section5Content3")}
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{terms("section5List9")}</li>
                <li>{terms("section5List10")}</li>
                <li>{terms("section5List11")}</li>
                <li>{terms("section5List12")}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {terms("section6Title")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                {terms("section6Content")}
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{terms("section6List1")}</li>
                <li>{terms("section6List2")}</li>
                <li>{terms("section6List3")}</li>
                <li>{terms("section6List4")}</li>
                <li>{terms("section6List5")}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {terms("section7Title")}
              </h2>

              <h3 className="text-xl font-semibold mb-3 mt-6">
                {terms("section7_1Title")}
              </h3>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>{terms("section7_1List1")}</li>
                <li>{terms("section7_1List2")}</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6">
                {terms("section7_2Title")}
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                {terms("section7_2Content")}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                {terms("section8Title")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                {terms("section8Content")}
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-2">
                {terms("contactEmail")}
              </p>
            </section>

            <section>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("lastUpdated")}：{terms("lastUpdatedDate")}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
