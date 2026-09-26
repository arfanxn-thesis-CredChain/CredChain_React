/* eslint-disable react-refresh/only-export-components */
import { useTranslation } from "react-i18next";
import { Ban, CalendarX, CheckCircle2, Clock, XCircle, type LucideIcon } from "lucide-react";
import { Badge, type StatusTone } from "@ui/badge";
import type { CredentialStatus } from "@shared/types/api";

const TONE_MAP: Record<CredentialStatus, StatusTone> = {
  pending: "gold",
  approved: "green",
  rejected: "error",
  revoked: "gray",
  expired: "amber",
};

const ICON_MAP: Record<CredentialStatus, LucideIcon> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  revoked: Ban,
  expired: CalendarX,
};

export const LABEL_KEY: Record<CredentialStatus, string> = {
  pending: "cred.lifecycle.pending",
  approved: "cred.lifecycle.approved",
  rejected: "cred.lifecycle.rejected",
  revoked: "cred.lifecycle.revoked",
  expired: "cred.lifecycle.expired",
};

export const STATUS_SURFACE: Record<CredentialStatus, string> = {
  pending: "border-gray-100 hover:border-gold/50 hover:shadow-md",
  approved: "border-gray-100 hover:border-gold/50 hover:shadow-md",
  rejected: "border-error/20 bg-error/5",
  revoked: "border-gray-200 bg-gray-50",
  expired: "border-amber-200 bg-amber-50/30",
};

export function getCredentialStatusLabelKey(
  status: CredentialStatus,
  isSubmission?: boolean,
): string {
  if (status === "approved" && isSubmission === false) {
    return "cred.card.registered";
  }
  return LABEL_KEY[status];
}

export interface CredentialStatusBadgeProps {
  status: CredentialStatus;
  isSubmission?: boolean;
  className?: string;
}

export function CredentialStatusBadge({
  status,
  isSubmission,
  className,
}: CredentialStatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <Badge tone={TONE_MAP[status]} icon={ICON_MAP[status]} className={className}>
      {t(getCredentialStatusLabelKey(status, isSubmission))}
    </Badge>
  );
}
