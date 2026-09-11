/* eslint-disable react-refresh/only-export-components */
import { useTranslation } from "react-i18next";
import { Ban, CheckCircle2, Clock, XCircle, type LucideIcon } from "lucide-react";
import { Badge, type StatusTone } from "@ui/badge";
import type { CredentialStatus } from "@shared/types/api";

const TONE_MAP: Record<CredentialStatus, StatusTone> = {
  pending: "gold",
  approved: "green",
  rejected: "error",
  revoked: "gray",
};

const ICON_MAP: Record<CredentialStatus, LucideIcon> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  revoked: Ban,
};

export const LABEL_KEY: Record<CredentialStatus, string> = {
  pending: "cred.lifecycle.pending",
  approved: "cred.lifecycle.approved",
  rejected: "cred.lifecycle.rejected",
  revoked: "cred.lifecycle.revoked",
};

export const STATUS_SURFACE: Record<CredentialStatus, string> = {
  pending: "border-gray-100 hover:border-gold/50 hover:shadow-md",
  approved: "border-gray-100 hover:border-gold/50 hover:shadow-md",
  rejected: "border-error/20 bg-error/5",
  revoked: "border-gray-200 bg-gray-50",
};

export function CredentialStatusBadge({
  status,
  className,
}: {
  status: CredentialStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Badge tone={TONE_MAP[status]} icon={ICON_MAP[status]} className={className}>
      {t(LABEL_KEY[status])}
    </Badge>
  );
}
