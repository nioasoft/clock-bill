import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";
import { brandName } from "@/lib/brand";
import { Link } from "@/src/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal.terms");
  const brand = brandName(await getLocale());
  return {
    title: `${t("metaTitle")} | ${brand}`,
    description: t("metaDescription", { brand }),
  };
}

export default async function TermsPage() {
  const t = await getTranslations("Legal.terms");
  const brand = brandName(await getLocale());

  return (
    <LegalPage title={t("title")} updated={t("updated")}>
      <section>
        <p>
          {t.rich("intro", {
            brand,
            privacyLink: (chunks) => <Link href="/privacy">{chunks}</Link>,
          })}
        </p>
      </section>

      <section>
        <h2>{t("account.heading")}</h2>
        <ul>
          <li>{t("account.item1")}</li>
          <li>{t("account.item2")}</li>
          <li>{t("account.item3")}</li>
          <li>{t("account.item4")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("permitted.heading")}</h2>
        <p>{t("permitted.intro")}</p>
        <ul>
          <li>{t("permitted.item1")}</li>
          <li>{t("permitted.item2")}</li>
          <li>{t("permitted.item3")}</li>
          <li>{t("permitted.item4")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("notTaxDocs.heading")}</h2>
        <p>
          {t.rich("notTaxDocs.body", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </section>

      <section>
        <h2>{t("noAdvice.heading")}</h2>
        <p>{t("noAdvice.body")}</p>
      </section>

      <section>
        <h2>{t("yourData.heading")}</h2>
        <p>
          {t.rich("yourData.body", {
            privacyLink: (chunks) => <Link href="/privacy">{chunks}</Link>,
          })}
        </p>
      </section>

      <section>
        <h2>{t("ip.heading")}</h2>
        <p>{t("ip.body")}</p>
      </section>

      <section>
        <h2>{t("pricing.heading")}</h2>
        <p>{t("pricing.body")}</p>
      </section>

      <section>
        <h2>{t("payment.heading")}</h2>
        <p>{t("payment.processor")}</p>
        <p>{t("payment.billing")}</p>
        <p>{t("payment.priceChanges")}</p>
        <p>{t("payment.cancellation")}</p>
        <p>{t("payment.refunds")}</p>
        <p>{t("payment.downgrade")}</p>
        <p>{t("payment.freeTier")}</p>
      </section>

      <section>
        <h2>{t("availability.heading")}</h2>
        <p>{t("availability.body")}</p>
      </section>

      <section>
        <h2>{t("liability.heading")}</h2>
        <p>{t("liability.body")}</p>
      </section>

      <section>
        <h2>{t("indemnity.heading")}</h2>
        <p>{t("indemnity.body")}</p>
      </section>

      <section>
        <h2>{t("thirdParty.heading")}</h2>
        <p>{t("thirdParty.body")}</p>
      </section>

      <section>
        <h2>{t("forceMajeure.heading")}</h2>
        <p>{t("forceMajeure.body")}</p>
      </section>

      <section>
        <h2>{t("suspension.heading")}</h2>
        <p>{t("suspension.body")}</p>
      </section>

      <section>
        <h2>{t("changes.heading")}</h2>
        <p>{t("changes.body")}</p>
      </section>

      <section>
        <h2>{t("general.heading")}</h2>
        <ul>
          <li>{t("general.item1")}</li>
          <li>{t("general.item2")}</li>
          <li>{t("general.item3")}</li>
          <li>{t("general.item4")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("law.heading")}</h2>
        <p>{t("law.body")}</p>
      </section>

      <section>
        <h2>{t("contact.heading")}</h2>
        <p>
          {t.rich("contact.body", {
            contactLink: (chunks) => <Link href="/contact">{chunks}</Link>,
          })}
        </p>
      </section>
    </LegalPage>
  );
}
