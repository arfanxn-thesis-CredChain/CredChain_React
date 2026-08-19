import { useTranslation } from "react-i18next";
import { Ban, CheckCircle2, Clock, XCircle } from "lucide-react";
import { StatusPill, type StatusTone } from "@shared/components/StatusPill";
import type { CredentialLifecycleStatus } from "@shared/types/api";

const TONE_MAP: Record<CredentialLifecycleStatus, StatusTone> = {
  pending: "gold",
  approved: "green",
  rejected: "error",
  revoked: "gray",
};

const ICON_MAP = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  revoked: Ban,
} as const;

const LABEL_KEY: Record<CredentialLifecycleStatus, string> = {
  pending: "cred.lifecycle.pending",
  approved: "cred.lifecycle.approved",
  rejected: "cred.lifecycle.rejected",
  revoked: "cred.lifecycle.revoked",
};

export function CredentialLifecycleStatusBadge({
  status,
  className,
}: {
  status: CredentialLifecycleStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={TONE_MAP[status]} icon={ICON_MAP[status]} className={className}>
      {t(LABEL_KEY[status])}
    </StatusPill>
  );
}
