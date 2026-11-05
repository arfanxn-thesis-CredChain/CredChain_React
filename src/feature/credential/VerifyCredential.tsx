import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Search } from "lucide-react";
import { useVerifyCredential } from "./api/useVerifyCredential";
import { useCredential } from "./api/useCredential";
import { getPublicVerificationDetails, getVerificationPresentation } from "./lib/verdict";
import { CredentialDetailModal } from "./CredentialDetailModal";
import { verifyFileSchema } from "./schemas/credential";
import type { CredentialVerifyDTO } from "@shared/types/api";
import { isApiError } from "@shared/api/envelope";
import { useStore } from "@app/store";
import { canAccess, Role } from "@shared/auth/role";
import { Card } from "@ui/card";
import { Button } from "@ui/button";
import { CredentialFileInput } from "./components/CredentialFileInput";
import { CredentialFileModal } from "./components/CredentialFileModal";
import { VerificationResult } from "./components/VerificationResult";
import { VerificationPublicDetailsModal } from "./components/VerificationPublicDetailsModal";
import { BackLink } from "@shared/components/BackLink";
import { PageHeader } from "@shared/components/PageHeader";

type VerifyState = "idle" | "verifying" | "done";

export function VerifyCredential() {
  const { t } = useTranslation();
  const [state, setState] = useState<VerifyState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<CredentialVerifyDTO | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsIdentity, setDetailsIdentity] = useState<string | null>(null);
  const [detailsMode, setDetailsMode] = useState<"private" | "public">("public");
  const uploadPanel = useRef<HTMLDivElement>(null);
  const previewTrigger = useRef<HTMLElement | null>(null);
  const focusUpload = useRef(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const detailsTrigger = useRef<HTMLElement | null>(null);
  const requestGeneration = useRef(0);
  const { user, isAuthenticated } = useStore();
  const verify = useVerifyCredential();

  useEffect(
    () => () => {
      requestGeneration.current += 1;
    },
    [],
  );
  useEffect(() => {
    if (state === "done" && result) resultHeading.current?.focus();
  }, [state, result]);
  useEffect(() => {
    if (!file && focusUpload.current) {
      uploadPanel.current?.querySelector<HTMLElement>('[role="button"][tabindex="0"]')?.focus();
      focusUpload.current = false;
    }
  }, [file]);
  useEffect(
    () =>
      useStore.subscribe((next, previous) => {
        if (
          next.isAuthenticated !== previous.isAuthenticated ||
          next.user?.id !== previous.user?.id ||
          next.user?.role !== previous.user?.role
        ) {
          setDetailsOpen(false);
          setDetailsIdentity(null);
        }
      }),
    [],
  );

  const clearResult = () => {
    requestGeneration.current += 1;
    setPreviewOpen(false);
    setDetailsOpen(false);
    setFileError(null);
    setResult(null);
    setErrorKey(null);
    setState("idle");
  };
  const handleFileChange = (next: File | null) => {
    if (next) {
      const parsed = verifyFileSchema.safeParse(next);
      if (!parsed.success) {
        setFileError(parsed.error.issues[0].message);
        return;
      }
    }
    focusUpload.current = next === null;
    clearResult();
    setFile(next);
  };
  const handleVerify = async () => {
    if (!file) return;
    const generation = ++requestGeneration.current;
    setState("verifying");
    setErrorKey(null);
    setResult(null);
    setDetailsOpen(false);
    try {
      const response = await verify.mutateAsync(file);
      if (generation !== requestGeneration.current) return;
      setResult({
        ...response,
        similarity_score: response.similarity_score ?? null,
        similarity_percent: response.similarity_percent ?? null,
        credential: response.credential ?? null,
        exact_match_confirmed: response.exact_match_confirmed === true,
        public_details: response.public_details ?? null,
      });
      setState("done");
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setErrorKey(isApiError(error) ? error.messageKey : "cred.verify.failed");
      setState("idle");
    }
  };
  const handleReset = () => handleFileChange(null);

  const matchedId = result?.credential?.id ?? "";
  const publicDetails = result ? getPublicVerificationDetails(result) : null;
  const candidate = result ? getVerificationPresentation(result).candidate : false;
  const detail = useCredential(isAuthenticated && (publicDetails || candidate) ? matchedId : "");
  const identity = isAuthenticated && user ? `${user.id}:${user.role}` : "anonymous";
  const canViewPrivate =
    isAuthenticated &&
    !detail.error &&
    detail.data?.id === matchedId &&
    (canAccess(user?.role, Role.ISSUER) || detail.data.holder_user_id === user?.id);
  const privateOpen =
    detailsOpen &&
    detailsMode === "private" &&
    canViewPrivate &&
    detailsIdentity === `${identity}:${matchedId}`;
  const publicOpen =
    detailsOpen &&
    (detailsMode === "public" || !canViewPrivate) &&
    detailsIdentity === `${identity}:${matchedId}`;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <BackLink />
      <PageHeader title={t("cred.verify.title")} description={t("cred.verify.description")} />
      <div ref={uploadPanel}>
        <Card className="p-6 sm:p-8">
          <CredentialFileInput
            file={file}
            onChange={handleFileChange}
            onExpand={() => {
              previewTrigger.current = document.activeElement as HTMLElement;
              setPreviewOpen(true);
            }}
            error={fileError ?? undefined}
          />
          {state !== "done" && (
            <>
              {errorKey && (
                <p className="mt-4 text-sm text-error" role="alert">
                  {t(errorKey)}
                </p>
              )}
              <Button
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
                    {t(errorKey ? "cred.verify.report.retry" : "cred.verify.verifyNow")}
                  </>
                )}
              </Button>
            </>
          )}
        </Card>
      </div>
      <p className="sr-only" role="status">
        {state === "verifying"
          ? t("cred.verify.processing")
          : result
            ? t("cred.verify.report.resultTitle")
            : ""}
      </p>
      {result && state === "done" && (
        <section aria-labelledby="verification-result-heading" className="space-y-4">
          <h2
            id="verification-result-heading"
            ref={resultHeading}
            tabIndex={-1}
            className="font-display text-xl font-semibold text-navy"
          >
            {t("cred.verify.report.resultTitle")}
          </h2>
          <VerificationResult
            result={result}
            canViewPrivate={!!canViewPrivate}
            onReset={handleReset}
            onOpenDetails={() => {
              detailsTrigger.current = document.activeElement as HTMLElement;
              setDetailsIdentity(`${identity}:${matchedId}`);
              setDetailsMode(canViewPrivate ? "private" : "public");
              setDetailsOpen(true);
            }}
          />
        </section>
      )}
      {file && (
        <CredentialFileModal
          file={file}
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (previewTrigger.current?.isConnected) previewTrigger.current.focus();
          }}
        />
      )}
      {privateOpen && (
        <CredentialDetailModal
          key={`${identity}:${matchedId}`}
          credentialId={matchedId}
          open
          onOpenChange={setDetailsOpen}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (detailsTrigger.current?.isConnected) detailsTrigger.current.focus();
          }}
        />
      )}
      <VerificationPublicDetailsModal
        details={publicDetails}
        file={file}
        open={publicOpen && !!publicDetails}
        onOpenChange={setDetailsOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (detailsTrigger.current?.isConnected) detailsTrigger.current.focus();
        }}
      />
    </div>
  );
}
