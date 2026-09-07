import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSmartBack } from "@shared/hooks/useSmartBack";
import { cn } from "@shared/lib/cn";

interface BackLinkProps {
  className?: string;
  onClick?: () => void;
}

export function BackLink({ className, onClick }: BackLinkProps) {
  const { t } = useTranslation();
  const handleBack = useSmartBack();

  return (
    <button
      type="button"
      onClick={onClick ?? handleBack}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-gray-500",
        "transition-colors hover:text-navy",
        "rounded-md focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {t("common.back")}
    </button>
  );
}
