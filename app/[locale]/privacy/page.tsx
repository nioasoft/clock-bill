import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";
import { brandName } from "@/lib/brand";
import { Link } from "@/src/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal.privacy");
  const brand = brandName(await getLocale());
  return {
    title: `${t("metaTitle")} | ${brand}`,
    description: t("metaDescription", { brand }),
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("Legal.privacy");
  const brand = brandName(await getLocale());

  return (
    <LegalPage title={t("title")} updated={t("updated")}>
      <section>
        <p>{t("intro", { brand })}</p>
      </section>

      <section>
        <h2>{t("collect.heading")}</h2>
        <ul>
          <li>
            {t.rich("collect.item1", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("collect.item2", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("collect.item3", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
        </ul>
        <p>{t("collect.note")}</p>
      </section>

      <section>
        <h2>{t("use.heading")}</h2>
        <p>{t("use.intro")}</p>
        <ul>
          <li>{t("use.item1")}</li>
          <li>{t("use.item2")}</li>
          <li>{t("use.item3")}</li>
          <li>{t("use.item4")}</li>
        </ul>
        <p>{t("use.note")}</p>
      </section>

      <section>
        <h2>{t("providers.heading")}</h2>
        <p>{t("providers.intro")}</p>
        <ul>
          <li>
            {t.rich("providers.item1", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("providers.item2", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("providers.item3", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("providers.item4", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("providers.item5", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
        </ul>
        <p>{t("providers.note")}</p>
      </section>

      <section>
        <h2>{t("storage.heading")}</h2>
        <p>{t("storage.body")}</p>
      </section>

      <section>
        <h2>{t("security.heading")}</h2>
        <p>{t("security.body")}</p>
      </section>

      <section>
        <h2>{t("incident.heading")}</h2>
        <p>{t("incident.body")}</p>
      </section>

      <section>
        <h2>{t("cookies.heading")}</h2>
        <p>{t("cookies.body")}</p>
      </section>

      <section>
        <h2>{t("rights.heading")}</h2>
        <p>{t("rights.intro")}</p>
        <ul>
          <li>
            {t.rich("rights.item1", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("rights.item2", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("rights.item3", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("rights.item4", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("rights.item5", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
        </ul>
        <p>{t("rights.note")}</p>
      </section>

      <section>
        <h2>{t("retention.heading")}</h2>
        <p>{t("retention.body")}</p>
      </section>

      <section>
        <h2>{t("minors.heading")}</h2>
        <p>{t("minors.body")}</p>
      </section>

      <section>
        <h2>{t("changes.heading")}</h2>
        <p>{t("changes.body")}</p>
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
