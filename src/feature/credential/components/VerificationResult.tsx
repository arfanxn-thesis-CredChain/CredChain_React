import { useTranslation } from "react-i18next";
import { CheckCircle2, CircleHelp, AlertTriangle } from "lucide-react";
import type { CredentialVerifyDTO } from "@shared/types/api";
import { Card } from "@ui/card";
import { Button } from "@ui/button";
import { CredentialStatusBadge } from "@shared/components/CredentialStatusBadge";
import { DetailRow } from "@shared/components/DetailRow";
import { getPublicVerificationDetails, getVerificationPresentation } from "../lib/verdict";

interface Props {
  result: CredentialVerifyDTO;
  onOpenDetails: () => void;
  onReset: () => void;
  canViewPrivate: boolean;
}

export function VerificationResult({ result, onOpenDetails, onReset, canViewPrivate }: Props) {
  const { t, i18n } = useTranslation();
  const presentation = getVerificationPresentation(result);
  const details = getPublicVerificationDetails(result);
  const credential = result.credential;
  const prefix = `cred.verify.report.${presentation.key}`;
  const Icon =
    presentation.tone === "success"
      ? CheckCircle2
      : presentation.tone === "warning"
        ? AlertTriangle
        : CircleHelp;
  const score = result.similarity_score;
  const showScore =
    presentation.candidate &&
    typeof score === "number" &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 1;
  const actionKey = details
    ? "cred.verify.report.viewCredentialDetails"
    : presentation.candidate && canViewPrivate && credential
      ? "cred.verify.report.viewComparedCredential"
      : null;

  return (
    <Card className="overflow-hidden p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-navy" />
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold text-navy">{t(`${prefix}.title`)}</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-gray-700">
            {t(`${prefix}.description`)}
          </p>
          {details && presentation.key !== "exact" && (
            <p className="mt-3 text-sm text-gray-700">{t("cred.verify.report.verified")}</p>
          )}
        </div>
      </div>
      {showScore && (
        <section className="mt-6 border-t border-gray-200 pt-5 text-sm">
          <p className="flex flex-wrap items-baseline gap-3">
            {t("cred.verify.report.score")}
            <strong className="text-2xl text-navy">
              {new Intl.NumberFormat(i18n.language, {
                style: "percent",
                maximumFractionDigits: 1,
              }).format(score)}
            </strong>
          </p>
          <p className="mt-1 text-gray-600">{t("cred.verify.report.scoreLimit")}</p>
        </section>
      )}
      {presentation.candidate && credential && (
        <div className="mt-6 border-t border-gray-200 pt-5">
          <h3 className="font-semibold text-navy">{t("cred.verify.report.comparedCredential")}</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            {t("cred.verify.report.candidateStatus")}
          </p>
        </div>
      )}
      {credential && (
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <DetailRow
            label={t("cred.verify.report.method")}
            value={t(
              details
                ? "cred.verify.report.methodExact"
                : presentation.candidate
                  ? "cred.verify.report.methodText"
                  : "cred.verify.report.methodUnknown",
            )}
          />
          <DetailRow
            label={t("cred.verify.report.status")}
            value={
              <CredentialStatusBadge
                status={credential.status}
                isSubmission={credential.is_submission}
              />
            }
          />
          <DetailRow
            label={t("cred.verify.report.credentialName")}
            value={credential.name || t("common.notSet")}
            className="break-words"
          />
          <DetailRow
            label={t("cred.verify.report.credentialNumber")}
            value={credential.number || t("common.notSet")}
            className="break-words"
          />
          <DetailRow
            label={t("cred.verify.report.type")}
            value={
              (credential.credential_type_name === undefined
                ? details?.credential_type_name
                : credential.credential_type_name) || t("cred.verify.report.unavailable")
            }
            className="break-words"
          />
          <DetailRow
            label={t("cred.verify.report.organization")}
            value={
              (credential.issuer_organization_name === undefined
                ? details?.issuer_organization_name
                : credential.issuer_organization_name) || t("cred.verify.report.unavailable")
            }
            className="break-words"
          />
        </dl>
      )}
      <section className="mt-6 border-t border-gray-200 pt-5">
        <h3 className="font-semibold">{t("cred.verify.report.next")}</h3>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-gray-700">
          {t(`${prefix}.next`)}
        </p>
      </section>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {actionKey && <Button onClick={onOpenDetails}>{t(actionKey)}</Button>}
        <Button variant={actionKey ? "outline" : "primary"} onClick={onReset}>
          {t("cred.verify.report.another")}
        </Button>
      </div>
      <section className="mt-6 border-t border-gray-200 pt-5 text-sm text-gray-600">
        <h3 className="font-semibold text-navy">{t("cred.verify.report.limits")}</h3>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>{t("cred.verify.report.recipientLimit")}</li>
          {credential && <li>{t("cred.verify.report.metadataLimit")}</li>}
          {details?.holder && <li>{t("cred.verify.report.provenance")}</li>}
        </ul>
      </section>
    </Card>
  );
}
