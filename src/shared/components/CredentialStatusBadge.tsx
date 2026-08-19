import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileQuestion,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { StatusPill } from "@shared/components/StatusPill";
import type { ExtractStatus } from "@shared/types/api";

interface CredentialStatusBadgeProps {
  revoked: boolean;
  extractStatus?: ExtractStatus;
  showExtractStatus?: boolean;
}

export function CredentialStatusBadge({
  revoked,
  extractStatus,
  showExtractStatus,
}: CredentialStatusBadgeProps) {
  const { t } = useTranslation();

  if (revoked) {
    return (
      <StatusPill tone="error" icon={ShieldAlert}>
        {t("cred.status.revoked")}
      </StatusPill>
    );
  }

  if (showExtractStatus && extractStatus) {
    switch (extractStatus) {
      case "unextracted":
        return (
          <StatusPill tone="gray" icon={FileQuestion}>
            {t("cred.extract.unextracted")}
          </StatusPill>
        );
      case "pending":
        return (
          <StatusPill tone="gold" icon={Clock}>
            {t("cred.extract.pendingExtraction")}
          </StatusPill>
        );
      case "succeeded":
        return (
          <StatusPill tone="green" icon={CheckCircle2}>
            {t("cred.extract.succeeded")}
          </StatusPill>
        );
      case "failed":
        return (
          <StatusPill tone="error" icon={AlertTriangle}>
            {t("cred.extract.failed")}
          </StatusPill>
        );
    }
  }

  return (
    <StatusPill tone="green" icon={ShieldCheck}>
      {t("cred.status.active")}
    </StatusPill>
  );
}
