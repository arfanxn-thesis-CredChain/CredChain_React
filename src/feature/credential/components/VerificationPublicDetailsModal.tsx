import { useTranslation } from "react-i18next";
import type { VerificationPublicDetailsDTO } from "@shared/types/api";
import { DetailEditForm } from "@shared/components/DetailEditForm";
import { EyebrowLabel } from "@shared/components/EyebrowLabel";
import { UserContactBlock } from "@shared/components/UserContactBlock";
import { CredentialStatusBadge } from "@shared/components/CredentialStatusBadge";
import { CredentialDetailLayout } from "./CredentialDetailLayout";
import { CredentialSystemFacts } from "./CredentialSystemFacts";
import { CredentialFilePreview } from "./CredentialViewFilePreview";
import { buildCredentialReadFields } from "../lib/credential-detail-fields";

interface Props {
  details: VerificationPublicDetailsDTO | null;
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export function VerificationPublicDetailsModal({
  details,
  file,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: Props) {
  const { t, i18n } = useTranslation();
  if (!details) return null;
  const fields = buildCredentialReadFields(
    {
      ...details,
      issuer_organization_id: undefined,
      type: details.credential_type_name ? { name: details.credential_type_name } : null,
      issuer_organization: details.issuer_organization_name
        ? { name: details.issuer_organization_name }
        : null,
    },
    t,
    i18n.language,
  );
  const status = (
    <CredentialStatusBadge status={details.status} isSubmission={details.is_submission} />
  );
  return (
    <CredentialDetailLayout
      title={details.name}
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      filePanel={
        file ? (
          <CredentialFilePreview
            blob={file}
            name={file.name}
            allowDownload={false}
            sourceLabel={t("cred.verify.report.uploadedFile")}
            statusSlot={status}
          />
        ) : (
          status
        )
      }
      details={
        <DetailEditForm
          title={t("cred.detail.cardTitle")}
          fields={fields}
          canEdit={false}
          onSave={async () => false}
          isSaving={false}
        />
      }
      parties={
        <div className="space-y-2">
          <EyebrowLabel as="span" className="block text-navy">
            {t("cred.detail.holder")}
          </EyebrowLabel>
          <UserContactBlock
            user={details.holder}
            fallbackId={t("common.notSet")}
            copyPrefix="holder"
            labelType="full"
            layout="grid"
            blockLinks
            resolveUnits={false}
          >
            {details.is_submission && (
              <p className="text-xs text-gray-500">{t("cred.parties.selfSubmitted")}</p>
            )}
          </UserContactBlock>
        </div>
      }
      footer={<CredentialSystemFacts credential={details} />}
    />
  );
}
