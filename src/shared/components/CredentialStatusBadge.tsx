import { useTranslation } from "react-i18next";
import { Ban, CheckCircle2, Clock, XCircle, type LucideIcon } from "lucide-react";
import { StatusPill, type StatusTone } from "@shared/components/StatusPill";
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

const LABEL_KEY: Record<CredentialStatus, string> = {
  pending: "cred.lifecycle.pending",
  approved: "cred.lifecycle.approved",
  rejected: "cred.lifecycle.rejected",
  revoked: "cred.lifecycle.revoked",
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
    <StatusPill tone={TONE_MAP[status]} icon={ICON_MAP[status]} className={className}>
      {t(LABEL_KEY[status])}
    </StatusPill>
  );
}
