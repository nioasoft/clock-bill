"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { usePlan } from "@/hooks/use-plan";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal shown when the user clicks the TrialCard CTA. Summarises what they'll
 * lose on the free tier and offers a direct path to the pricing page.
 */
export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const t = useTranslations("Trial");
  const router = useRouter();
  const { data } = usePlan();

  const count = data?.activeClientCount ?? 0;

  function handleSeePlans() {
    onOpenChange(false);
    router.push("/pricing");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("upgradeTitle")}</DialogTitle>
          <DialogDescription>
            {t("upgradeBody", { limit: 1, count })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("maybeLater")}
          </Button>
          <Button onClick={handleSeePlans}>{t("upgradeCta")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
