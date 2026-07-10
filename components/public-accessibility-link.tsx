import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";

interface PublicAccessibilityLinkProps {
  className?: string;
}

/** Keeps the accessibility statement discoverable on standalone public pages. */
export function PublicAccessibilityLink({ className = "" }: PublicAccessibilityLinkProps) {
  const t = useTranslations("common");

  return (
    <Link href="/accessibility" className={className}>
      {t("accessibilityStatement")}
    </Link>
  );
}
