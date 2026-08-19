import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@ui/button";
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

  const showPendingBadge = review === "all" && typeof pendingCount === "number" && pendingCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {triggerLabel}
          {showPendingBadge && (
            <span className="ml-1.5 rounded-full bg-gold px-1.5 text-[10px] font-bold text-navy">
              {pendingCount}
            </span>
          )}
          <ChevronDown className="ml-1 h-3 w-3 text-gray-400" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t("cred.review.menuLabel")}</DropdownMenuLabel>
        {REVIEW_OPTIONS.map((opt) => {
          const active = opt.key === review;
          return (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => onReviewChange(opt.key)}
              className="flex cursor-pointer items-center justify-between"
            >
              <span className={active ? "font-bold" : ""}>{t(opt.labelKey)}</span>
              {active && <Check className="h-4 w-4 text-gold" aria-hidden="true" />}
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
