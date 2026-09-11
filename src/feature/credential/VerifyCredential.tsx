import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  Hash,
  HelpCircle,
  Info,
  Loader2,
  Minus,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useVerifyCredential } from "./api/useVerifyCredential";
import { useMeta } from "./api/useMeta";
import { getVerdictTier, getMethodLabel } from "./lib/verdict";
import { verifyFileSchema } from "./schemas/credential";
import type { CredentialVerifyDTO } from "@shared/types/api";
import { isApiError } from "@shared/api/envelope";
import { useStore } from "@app/store";
import { canAccess, Role } from "@shared/auth/role";
import { Card } from "@ui/card";
import { Button } from "@ui/button";
import { CredentialFileInput } from "./components/CredentialFileInput";
import { CredentialFileModal } from "./components/CredentialFileModal";
import { CredentialStatusBadge } from "@shared/components/CredentialStatusBadge";
import { UserContactBlock } from "@shared/components/UserContactBlock";
import { CopyInlineButton } from "@shared/components/CopyInlineButton";
import { BackLink } from "@shared/components/BackLink";
import { PageHeader } from "@shared/components/PageHeader";
import { formatDate, truncateId } from "@shared/lib/format";
import { cn } from "@shared/lib/cn";

const VERDICT_GRADIENT: Record<string, string> = {
  green: "from-green-500 to-green-600",
  orange: "from-orange-500 to-orange-600",
  red: "from-red-500 to-red-600",
  amber: "from-amber-500 to-amber-600",
  gray: "from-gray-400 to-gray-500",
  "light-gray": "from-gray-300 to-gray-400",
  expired: "from-navy to-slate-700",
};

const VERDICT_ICON: Record<string, typeof ShieldCheck> = {
  green: ShieldCheck,
  orange: ShieldAlert,
  red: AlertTriangle,
  amber: HelpCircle,
  gray: Minus,
  "light-gray": Minus,
  expired: Clock,
};

const VERDICT_ICON_BG: Record<string, string> = {
  green: "bg-white/20",
  orange: "bg-white/20",
  red: "bg-white/20",
  amber: "bg-white/20",
  gray: "bg-white/15",
  "light-gray": "bg-white/15",
  expired: "bg-white/20",
};

const SIMILARITY_BAR_COLOR: Record<string, string> = {
  red: "from-red-400 to-red-500",
  amber: "from-amber-400 to-amber-500",
  gray: "from-gray-400 to-gray-500",
  "light-gray": "from-gray-300 to-gray-400",
  expired: "from-navy to-slate-600",
};

type VerifyState = "idle" | "verifying" | "done";

export function VerifyCredential() {
  const { t } = useTranslation();
  const [state, setState] = useState<VerifyState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<CredentialVerifyDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { user, isAuthenticated } = useStore();
  const verify = useVerifyCredential();
  const { data: meta } = useMeta();

  const handleFileChange = (f: File | null) => {
    if (!f) {
      setFile(null);
      setFileError(null);
      setResult(null);
      setError(null);
      setState("idle");
      return;
    }
    const parsed = verifyFileSchema.safeParse(f);
    if (!parsed.success) {
      setFileError(parsed.error.issues[0].message);
      return;
    }
    setFile(f);
    setFileError(null);
  };

  const handleVerify = async () => {
    if (!file) return;
    setState("verifying");
    setError(null);
    setResult(null);
    try {
      const resp = await verify.mutateAsync(file);
      setResult({
        verdict_code: resp.verdict_code,
        similarity_score: resp.similarity_score ?? null,
        similarity_percent: resp.similarity_percent ?? null,
        description: resp.description,
        credential: resp.credential ?? null,
      });
      setState("done");
    } catch (e) {
      setError(isApiError(e) ? t(e.messageKey) : t("cred.verify.failed"));
      setState("idle");
    }
  };

  const handleReset = () => {
    setState("idle");
    setFile(null);
    setFileError(null);
    setResult(null);
    setError(null);
  };

  const tier = result ? getVerdictTier(result.verdict_code) : "light-gray";
  const method = result ? getMethodLabel(result.similarity_score, result.verdict_code) : "hash";
  const hasCredential = result?.credential != null;

  const isHolderOfCredential =
    isAuthenticated && hasCredential && user?.id === result.credential!.holder_user_id;
  const isIssuerOrAbove = isAuthenticated && canAccess(user?.role, Role.ISSUER);
  const canViewCredential = hasCredential && (isIssuerOrAbove || isHolderOfCredential);

  const VerdictIcon = VERDICT_ICON[tier];
  const showSimilarity = result?.similarity_score != null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <BackLink />
      <PageHeader title={t("cred.verify.title")} description={t("cred.verify.description")} />

      {/* Upload Card */}
      <Card className="overflow-hidden p-6 sm:p-8">
        <CredentialFileInput
          file={file}
          onChange={handleFileChange}
          onExpand={() => setPreviewOpen(true)}
          error={fileError ?? undefined}
        />

        {error && (
          <p className="mt-4 text-sm text-error" role="alert">
            {error}
          </p>
        )}

        <Button
          variant="primary"
          size="lg"
          className="mt-5 w-full"
          disabled={!file || state === "verifying"}
          onClick={handleVerify}
        >
          {state === "verifying" ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
              {t("cred.verify.processing")}
            </>
          ) : (
            <>
              <Search className="mr-2 h-5 w-5" aria-hidden="true" />
              {t("cred.verify.verifyNow")}
            </>
          )}
        </Button>

        {file && (
          <CredentialFileModal
            file={file}
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
          />
        )}
      </Card>

      {/* Result Card */}
      {result && state === "done" && (
        <div role="status" aria-live="polite">
          <Card className="overflow-hidden p-6 sm:p-8">
            {/* Verdict Banner */}
            <div
              className={cn(
                "mb-5 rounded-xl bg-gradient-to-br p-6 text-center text-white md:p-8",
                VERDICT_GRADIENT[tier],
              )}
            >
              <div
                className={cn(
                  "mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full",
                  VERDICT_ICON_BG[tier],
                )}
              >
                <VerdictIcon className="h-8 w-8" aria-hidden="true" />
              </div>
              <h3 className="font-display text-2xl font-extrabold tracking-tight">
                {result.description ?? t("cred.verify.failed")}
              </h3>
              {tier === "expired" && result.credential?.expires_at && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-white/90">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t("cred.verify.expiredOn", { date: formatDate(result.credential.expires_at) })}
                </p>
              )}
            </div>

            <div>
              {/* Similarity Bar (fuzzy only) */}
              {showSimilarity && (
                <div className="mb-4">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{t("cred.verify.similarityLabel")}</span>
                    <span
                      className="font-bold"
                      style={{
                        color:
                          tier === "red" ? "#EF4444" : tier === "amber" ? "#D97706" : "#6B7280",
                      }}
                    >
                      {result.similarity_percent}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={cn(
                        "h-full rounded-full bg-gradient-to-r",
                        SIMILARITY_BAR_COLOR[tier] ?? "from-gray-400 to-gray-500",
                      )}
                      style={{ width: `${(result.similarity_score ?? 0) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}

              {/* Method Badge */}
              <div
                className={cn(
                  "mb-5 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm",
                  method === "hash" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700",
                )}
              >
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-bold",
                    method === "hash" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700",
                  )}
                >
                  {method === "hash" ? "HASH" : "AI"}
                </span>
                {t(`cred.verify.method.${method}`)}
              </div>

              {/* Credential Section */}
              {hasCredential && (
                <div className="border-t border-gray-100 pt-5">
                  {/* Status + Issuer metadata */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <CredentialStatusBadge status={result.credential!.status} />
                    {meta?.issuing_organization_name && (
                      <span className="flex items-center gap-1.5 text-sm text-navy/60">
                        <Building2 className="h-4 w-4 shrink-0 text-gold/70" aria-hidden="true" />
                        {meta.issuing_organization_name}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <h4 className="font-bold text-lg text-navy">{result.credential!.name}</h4>

                  {/* Credential ULID — shield icon */}
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                    <span className="shrink-0 truncate font-mono text-gray-500">
                      {truncateId(result.credential!.id)}
                    </span>
                    <CopyInlineButton
                      value={result.credential!.id}
                      ariaLabel={t("cred.copy.credentialId")}
                      className="shrink-0"
                    />
                  </div>

                  {/* ID Token — credit card icon (issuer+ only) */}
                  {isIssuerOrAbove && result.credential!.token_id && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <svg
                        className="h-4 w-4 shrink-0 text-gray-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="2" y="6" width="20" height="12" rx="2" />
                        <path d="M2 10h20" />
                      </svg>
                      <span className="shrink-0 truncate font-mono text-gray-500">
                        {truncateId(result.credential!.token_id)}
                      </span>
                      <CopyInlineButton
                        value={result.credential!.token_id}
                        ariaLabel={t("cred.verify.tokenId")}
                        className="shrink-0"
                      />
                    </div>
                  )}

                  {/* File Hash — hash icon */}
                  {result.credential!.file_hash && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <Hash className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                      <span className="shrink-0 truncate font-mono text-gray-500">
                        {truncateId(result.credential!.file_hash)}
                      </span>
                      <CopyInlineButton
                        value={result.credential!.file_hash}
                        ariaLabel={t("cred.verify.fileHash")}
                        className="shrink-0"
                      />
                    </div>
                  )}

                  {/* Organization — building icon */}
                  {(result.credential!.issuer_organization?.name ||
                    result.credential!.issuer_organization_id) && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <Building2 className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                      <span className="shrink-0 text-gray-500 font-medium">
                        {t("cred.parties.issuerOrganization")}:
                      </span>
                      {result.credential!.issuer_organization?.name ? (
                        <span className="truncate font-semibold text-navy">
                          {result.credential!.issuer_organization.name}
                        </span>
                      ) : (
                        <span className="shrink-0 truncate font-mono text-gray-500">
                          {truncateId(result.credential!.issuer_organization_id!)}
                        </span>
                      )}
                      {result.credential!.issuer_organization_id && (
                        <CopyInlineButton
                          value={result.credential!.issuer_organization_id}
                          ariaLabel={t("cred.verify.orgId")}
                          className="shrink-0"
                        />
                      )}
                    </div>
                  )}

                  {/* Number — hash icon (only when present) */}
                  {result.credential!.number != null && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <Hash className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                      <span className="shrink-0 truncate font-mono text-gray-500">
                        {truncateId(result.credential!.number)}
                      </span>
                      <CopyInlineButton
                        value={result.credential!.number}
                        ariaLabel={t("cred.verify.number")}
                        className="shrink-0"
                      />
                    </div>
                  )}

                  {/* Holder (auth-aware) */}
                  {canViewCredential && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <UserContactBlock
                        labelType="full"
                        user={result.credential!.holder}
                        fallbackId={result.credential!.holder_user_id}
                        copyPrefix="holder"
                      />
                    </div>
                  )}

                  {/* Issuer (name + role badge only) */}
                  {canViewCredential && (
                    <div className="mb-3 border-t border-gray-100 pt-3">
                      <UserContactBlock
                        labelType="compact"
                        user={result.credential!.issuer}
                        fallbackId={result.credential!.issuer_user_id}
                        copyPrefix="issuer"
                      />
                    </div>
                  )}

                  {/* Revoker (conditional: revoked + auth-aware) */}
                  {canViewCredential &&
                    result.credential!.revoked_at !== null &&
                    result.credential!.revoker && (
                      <div className="mb-3 border-t border-gray-100 pt-3">
                        <UserContactBlock
                          labelType="compact"
                          user={result.credential!.revoker}
                          fallbackId={result.credential!.revoker_user_id ?? ""}
                          copyPrefix="revoker"
                          tone="error"
                        />
                      </div>
                    )}

                  {/* Issued Date */}
                  <div className="flex items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-500">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                    {t("cred.card.issued")} {formatDate(result.credential!.issued_at)}
                  </div>

                  {/* Unchecked-number disclaimer */}
                  <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-500">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                    <span>{t("verify.numberNotChecked")}</span>
                  </div>
                </div>
              )}

              {/* No Match Guidance */}
              {!hasCredential && (
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-1.5 text-sm font-semibold text-navy">
                    {t("cred.verify.whatThisMeans")}
                  </p>
                  <p className="text-xs text-gray-500">{t("cred.verify.noMatchReason1")}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-5 flex gap-3">
                {canViewCredential && (
                  <Button asChild variant="primary" className="flex-1">
                    <Link to={`/credentials/${result.credential!.id}`}>
                      {t("cred.verify.viewCredential")}
                    </Link>
                  </Button>
                )}
                <Button
                  variant={canViewCredential ? "outline" : "primary"}
                  className={canViewCredential ? "flex-1" : "w-full"}
                  onClick={handleReset}
                >
                  {t("cred.verify.verifyAnother")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
