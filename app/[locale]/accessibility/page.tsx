import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";
import { brandName } from "@/lib/brand";
import { Link } from "@/src/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal.accessibility");
  const brand = brandName(await getLocale());

  return {
    title: `${t("metaTitle")} | ${brand}`,
    description: t("metaDescription", { brand }),
  };
}

export default async function AccessibilityPage() {
  const t = await getTranslations("Legal.accessibility");
  const brand = brandName(await getLocale());

  return (
    <LegalPage title={t("title")} updated={t("updated")}>
      <section>
        <p>{t("intro", { brand })}</p>
      </section>

      <section>
        <h2>{t("scope.heading")}</h2>
        <p>{t("scope.body")}</p>
      </section>

      <section>
        <h2>{t("features.heading")}</h2>
        <ul>
          <li>{t("features.item1")}</li>
          <li>{t("features.item2")}</li>
          <li>{t("features.item3")}</li>
          <li>{t("features.item4")}</li>
          <li>{t("features.item5")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("limitations.heading")}</h2>
        <p>{t("limitations.body")}</p>
      </section>

      <section>
        <h2>{t("compatibility.heading")}</h2>
        <p>{t("compatibility.body")}</p>
      </section>

      <section>
        <h2>{t("contact.heading")}</h2>
        <p>{t("contact.body")}</p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <a href={`mailto:${t("contact.email")}`}>{t("contact.emailLabel")}</a>
          <Link href="/contact">{t("contact.formLabel")}</Link>
        </p>
      </section>
    </LegalPage>
  );
}
