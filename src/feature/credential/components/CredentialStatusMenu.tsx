import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterTrigger } from "@shared/components/FilterTrigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";

export type CredentialReviewStatus = "all" | "pending" | "approved" | "rejected" | "revoked";
export type CredentialExtractFilter = "any" | "unextracted" | "pending" | "succeeded" | "failed";

interface CredentialStatusMenuProps {
  review: CredentialReviewStatus;
  extract: CredentialExtractFilter;
  onReviewChange: (value: CredentialReviewStatus) => void;
  onExtractChange: (value: CredentialExtractFilter) => void;
  pendingCount?: number;
}

const REVIEW_OPTIONS: { key: CredentialReviewStatus; labelKey: string }[] = [
  { key: "all", labelKey: "cred.review.all" },
  { key: "pending", labelKey: "cred.review.pendingReview" },
  { key: "approved", labelKey: "cred.review.approved" },
  { key: "rejected", labelKey: "cred.review.rejected" },
  { key: "revoked", labelKey: "cred.review.revoked" },
];

const EXTRACT_OPTIONS: { key: CredentialExtractFilter; labelKey: string }[] = [
  { key: "any", labelKey: "cred.extract.any" },
  { key: "unextracted", labelKey: "cred.extract.unextracted" },
  { key: "pending", labelKey: "cred.extract.pendingExtraction" },
  { key: "succeeded", labelKey: "cred.extract.succeeded" },
  { key: "failed", labelKey: "cred.extract.failed" },
];

export function CredentialStatusMenu({
  review,
  extract,
  onReviewChange,
  onExtractChange,
  pendingCount,
}: CredentialStatusMenuProps) {
  const { t } = useTranslation();

  const reviewLabel = REVIEW_OPTIONS.find((opt) => opt.key === review)?.labelKey;
  const extractLabel = EXTRACT_OPTIONS.find((opt) => opt.key === extract)?.labelKey;

  const activeParts = [
    review !== "all" && reviewLabel ? t(reviewLabel) : null,
    extract !== "any" && extractLabel ? t(extractLabel) : null,
  ].filter((part): part is string => part !== null);

  const triggerLabel =
    activeParts.length > 0 ? activeParts.join(" · ") : t("cred.status.menuLabel");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTrigger active={review !== "all" || extract !== "any"}>
          {triggerLabel}
        </FilterTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t("cred.review.menuLabel")}</DropdownMenuLabel>
        {REVIEW_OPTIONS.map((opt) => {
          const active = opt.key === review;
          const showCount =
            opt.key === "pending" && typeof pendingCount === "number" && pendingCount > 0;
          return (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => onReviewChange(opt.key)}
              className="flex cursor-pointer items-center justify-between gap-2"
            >
              <span className={active ? "font-bold" : ""}>{t(opt.labelKey)}</span>
              <span className="flex items-center gap-1.5">
                {showCount && (
                  <span className="rounded-full bg-gold px-1.5 text-[10px] font-bold text-navy">
                    {pendingCount}
                  </span>
                )}
                {active && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("cred.extract.menuLabel")}</DropdownMenuLabel>
        {EXTRACT_OPTIONS.map((opt) => {
          const active = opt.key === extract;
          return (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => onExtractChange(opt.key)}
              className="flex cursor-pointer items-center justify-between"
            >
              <span className={active ? "font-bold" : ""}>{t(opt.labelKey)}</span>
              {active && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
