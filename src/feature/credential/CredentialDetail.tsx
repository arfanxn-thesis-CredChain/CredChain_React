import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RotateCw,
  XCircle,
} from "lucide-react";
import { useCredential } from "./api/useCredential";
import { useReExtractCredentials } from "./api/useReExtractCredentials";
import { useApproveCredentials } from "./api/useApproveCredentials";
import { useRejectCredentials } from "./api/useRejectCredentials";
import { useRevokeCredentials } from "./api/useRevokeCredentials";
import { useUpdateCredentials, type CredentialUpdateItem } from "./api/useUpdateCredentials";
import { CredentialRejectReasonModal } from "./components/CredentialRejectReasonModal";
import { CredentialCompetencyEditor } from "./components/CredentialCompetencyEditor";
import { credentialEditRowSchema, type CredentialEditRowInput } from "./schemas/credential";
import { useStore } from "@app/store";
import { Role, canAccessAny } from "@shared/auth/role";
import { PageHeader } from "@shared/components/PageHeader";
import { BackLink } from "@shared/components/BackLink";
import { EmptyState } from "@shared/components/EmptyState";
import { DetailRow } from "@shared/components/DetailRow";
import { DetailEditForm, type DetailField } from "@shared/components/DetailEditForm";
import { MetaDisplay } from "@shared/components/MetaDisplay";
import { MetaEditor } from "@shared/components/MetaEditor";
import { MonoId } from "@shared/components/MonoId";
import { CopyInlineButton } from "@shared/components/CopyInlineButton";
import { UserContactBlock } from "@shared/components/UserContactBlock";
import { SearchableCreateSelect } from "@shared/components/SearchableCreateSelect";
import { CredentialStatusBadge } from "@shared/components/CredentialStatusBadge";
import { CredentialLifecycleStatusBadge } from "./components/CredentialLifecycleStatusBadge";
import { CredentialViewFilePreview } from "./components/CredentialViewFilePreview";
import { Card } from "@ui/card";
import { Button } from "@ui/button";
import { Input } from "@ui/input";
import { Skeleton } from "@ui/skeleton";
import { useConfirm } from "@ui/confirm-dialog";
import { formatDate, formatDateTime, truncateAddress } from "@shared/lib/format";
import { mergeMeta, metaEqual, splitMeta } from "@shared/lib/meta";
import { cn } from "@shared/lib/cn";
import type { CredentialDTO } from "@shared/types/api";

function buildCredentialEditDefaults(cred: CredentialDTO): CredentialEditRowInput {
  return {
    name: cred.name,
    number: cred.number ?? "",
    type_id: cred.type_id,
    issuer_organization_id: cred.issuer_organization_id,
    issued_at: cred.issued_at.slice(0, 10),
    expires_at: cred.expires_at ? cred.expires_at.slice(0, 10) : "",
    meta_entries: splitMeta(cred.meta).entries,
  };
}

export function CredentialDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const currentUser = useStore((s) => s.user);
  const canManage = canAccessAny(currentUser?.role, [Role.ISSUER, Role.ADMIN, Role.SUPER_ADMIN]);
  const {
    data: cred,
    isLoading,
    isError,
  } = useCredential(id ?? "", ["holder", "issuer", "revoker"]);
  const reExtract = useReExtractCredentials();
  const approve = useApproveCredentials();
  const reject = useRejectCredentials();
  const revoke = useRevokeCredentials();
  const update = useUpdateCredentials();
  const { confirm, dialog } = useConfirm();
  const [metaOpen, setMetaOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [competencyIds, setCompetencyIds] = useState<string[]>([]);
  const form = useForm<CredentialEditRowInput>({
    resolver: zodResolver(credentialEditRowSchema),
  });

  useEffect(() => {
    if (cred) form.reset(buildCredentialEditDefaults(cred));
  }, [cred, form]);

  const revoked = cred?.revoked_at !== null;
  const extractFailed = cred?.extract_status === "failed";
  const extractSucceeded = cred?.extract_status === "succeeded";
  const isPendingReview = cred?.lifecycle_status === "pending";
  const hasFileUri = cred?.file_uri != null;
  const hasMeta = cred?.meta != null && Object.keys(cred.meta).length > 0;

  const handleSave = async (): Promise<boolean> => {
    if (!cred) return false;
    const valid = await form.trigger();
    if (!valid) return false;
    const values = form.getValues();
    const item: CredentialUpdateItem = { id: cred.id };

    const nextName = values.name ?? "";
    if (nextName !== cred.name) item.name = nextName;

    const nextNumber = values.number ?? "";
    if (nextNumber !== (cred.number ?? "")) item.number = nextNumber;

    const nextType = values.type_id ?? "";
    if (nextType !== cred.type_id) item.type_id = nextType;

    const nextOrg = values.issuer_organization_id ?? "";
    if (nextOrg !== cred.issuer_organization_id) item.issuer_organization_id = nextOrg;

    const currentIssuedAt = cred.issued_at.slice(0, 10);
    const nextIssuedAt = values.issued_at?.trim() || undefined;
    if (nextIssuedAt !== currentIssuedAt && nextIssuedAt) item.issued_at = nextIssuedAt;

    const currentExpiresAt = cred.expires_at ? cred.expires_at.slice(0, 10) : undefined;
    const nextExpiresAt = values.expires_at?.trim() || undefined;
    if (nextExpiresAt !== currentExpiresAt && nextExpiresAt) item.expires_at = nextExpiresAt;

    const mergedMeta = mergeMeta(values.meta_entries ?? [], splitMeta(cred.meta).preserved);
    if (!metaEqual(mergedMeta, cred.meta)) item.meta = mergedMeta ?? {};

    await update.mutateAsync([item]);
    return true;
  };

  const handleRevoke = async () => {
    if (!cred) return;
    const ok = await confirm({
      title: t("cred.revoke.confirmTitle", { count: 1 }),
      description: t("cred.revoke.confirmBody"),
      confirmLabel: t("cred.revoke.confirmAction"),
      cancelLabel: t("common.cancel"),
      tone: "destructive",
    });
    if (ok) revoke.mutate([cred.id]);
  };

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <BackLink />
        <PageHeader title={t("cred.detail.title")} />
        <EmptyState
          icon={AlertCircle}
          title={t("cred.detail.notFound.title")}
          description={t("cred.detail.notFound.body")}
        />
      </div>
    );
  }

  const editFields: DetailField[] = cred
    ? [
        {
          key: "name",
          label: t("cred.submit.field.name"),
          readValue: <span>{cred.name}</span>,
          editControl: (
            <Input
              placeholder={t("cred.submit.field.namePlaceholder")}
              {...form.register("name")}
            />
          ),
          error: form.formState.errors.name?.message,
        },
        {
          key: "number",
          label: t("cred.submit.field.number"),
          readValue: <span>{cred.number ?? t("common.notSet")}</span>,
          editControl: (
            <Input
              placeholder={t("cred.submit.field.numberPlaceholder")}
              {...form.register("number")}
            />
          ),
          error: form.formState.errors.number?.message,
        },
        {
          key: "type_id",
          label: t("cred.submit.field.type"),
          readValue: <MonoId value={cred.type_id} mode="id" />,
          editControl: (
            <SearchableCreateSelect
              resource="credential-types"
              placeholder={t("cred.submit.field.typePlaceholder")}
              value={form.watch("type_id") ?? ""}
              onChange={(next) => form.setValue("type_id", next, { shouldValidate: true })}
              error={form.formState.errors.type_id?.message}
            />
          ),
          error: form.formState.errors.type_id?.message,
        },
        {
          key: "issuer_organization_id",
          label: t("cred.submit.field.issuerOrganization"),
          readValue: <MonoId value={cred.issuer_organization_id} mode="id" />,
          editControl: (
            <SearchableCreateSelect
              resource="credential-issuer-organizations"
              placeholder={t("cred.submit.field.orgPlaceholder")}
              value={form.watch("issuer_organization_id") ?? ""}
              onChange={(next) =>
                form.setValue("issuer_organization_id", next, { shouldValidate: true })
              }
              error={form.formState.errors.issuer_organization_id?.message}
            />
          ),
          error: form.formState.errors.issuer_organization_id?.message,
        },
        {
          key: "issued_at",
          label: t("cred.submit.field.issuedAt"),
          readValue: <span>{formatDate(cred.issued_at)}</span>,
          editControl: <Input type="date" {...form.register("issued_at")} />,
          error: form.formState.errors.issued_at?.message,
        },
        {
          key: "expires_at",
          label: t("cred.submit.field.expiresAt"),
          readValue: (
            <span>{cred.expires_at ? formatDate(cred.expires_at) : t("common.notSet")}</span>
          ),
          editControl: <Input type="date" {...form.register("expires_at")} />,
          error: form.formState.errors.expires_at?.message,
        },
        {
          key: "meta",
          label: t("cred.field.meta"),
          readValue: <MetaDisplay meta={cred.meta} />,
          editControl: <MetaEditor control={form.control} name="meta_entries" />,
          fullWidth: true,
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackLink />
      <PageHeader title={cred?.name ?? t("cred.detail.title")} />

      {isLoading || !cred ? (
        <>
          <Card className="space-y-4 p-6 sm:p-8">
            <Skeleton className="h-[92px] w-full" />
          </Card>
          <Card className="space-y-4 p-6 sm:p-8">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </Card>
          <Card className="space-y-4 p-6 sm:p-8">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </Card>
        </>
      ) : (
        <>
          {/* Card 1: File Preview */}
          {hasFileUri && (
            <Card className="p-6 sm:p-8">
              <CredentialViewFilePreview
                credentialId={cred.id}
                credentialName={cred.name}
                hasFileUri={true}
              />
            </Card>
          )}

          {/* Card 2: Info */}
          <Card className="p-6 sm:p-8">
            {/* Status badges */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <CredentialLifecycleStatusBadge status={cred.lifecycle_status} />
              {!extractSucceeded && (
                <CredentialStatusBadge
                  revoked={false}
                  extractStatus={cred.extract_status}
                  showExtractStatus
                />
              )}
              {cred.extract_error && (
                <span className="text-xs text-error">{cred.extract_error}</span>
              )}
            </div>

            {/* Name + ID */}
            <h3 className="font-sans font-bold text-base text-navy">{cred.name}</h3>
            <div className="mt-0.5 mb-6 flex items-center gap-1">
              <MonoId value={cred.id} mode="id" />
              <CopyInlineButton
                value={cred.id}
                ariaLabel={t("cred.copy.credentialId")}
                className="shrink-0"
              />
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <DetailRow
                label={t("cred.detail.fileHash")}
                value={
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs text-gray-500">
                      {truncateAddress(cred.file_hash)}
                    </span>
                    <CopyInlineButton
                      value={cred.file_hash}
                      ariaLabel={t("cred.copy.credentialId")}
                      className="shrink-0"
                    />
                  </div>
                }
              />
              {cred.token_id && (
                <DetailRow
                  label={t("cred.detail.tokenId")}
                  value={
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs text-gray-500">
                        {truncateAddress(cred.token_id)}
                      </span>
                      <CopyInlineButton
                        value={cred.token_id}
                        ariaLabel={t("cred.copy.credentialId")}
                        className="shrink-0"
                      />
                    </div>
                  }
                />
              )}
              <DetailRow
                label={t("cred.detail.issuedDate")}
                value={<span className="text-sm text-navy">{formatDateTime(cred.issued_at)}</span>}
              />
              {cred.revoked_at && (
                <DetailRow
                  label={t("cred.detail.revokedDate")}
                  value={
                    <span className="text-sm text-error">{formatDateTime(cred.revoked_at)}</span>
                  }
                  tone="error"
                />
              )}
            </div>

            {/* Collapsible Meta */}
            {hasMeta && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <button
                  type="button"
                  onClick={() => setMetaOpen(!metaOpen)}
                  className="flex items-center gap-1.5 py-2 text-sm font-medium text-gray-500 hover:text-navy"
                >
                  {t("cred.field.meta")}
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", metaOpen && "rotate-180")}
                  />
                </button>
                {metaOpen && (
                  <div className="mt-4 rounded-xl bg-gray-50 p-4">
                    <MetaDisplay meta={cred.meta} />
                  </div>
                )}
              </div>
            )}

            {/* Actions: Re-Extract + Review + Revoke */}
            {canManage && (
              <div className="mt-6 flex justify-end border-t border-gray-100 pt-6">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {extractFailed && (
                    <Button
                      variant="outline"
                      onClick={() => cred.id && reExtract.mutate([cred.id])}
                      disabled={reExtract.isPending}
                    >
                      <RotateCw className="h-4 w-4" />
                      {reExtract.isPending
                        ? t("cred.issue.submitting")
                        : t("cred.detail.reExtract")}
                    </Button>
                  )}
                  {isPendingReview && (
                    <>
                      <Button
                        variant="gold"
                        onClick={() => cred.id && approve.mutate([cred.id])}
                        disabled={approve.isPending}
                      >
                        {approve.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        {t("cred.detail.approve")}
                      </Button>
                      <Button variant="outline" onClick={() => setRejectModalOpen(true)}>
                        <XCircle className="h-4 w-4" />
                        {t("cred.detail.reject")}
                      </Button>
                    </>
                  )}
                  {!isPendingReview && (
                    <Button
                      variant="destructive"
                      onClick={() => void handleRevoke()}
                      disabled={revoke.isPending}
                    >
                      {revoke.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Ban className="h-4 w-4" />
                      )}
                      {t("cred.revoke.confirmAction")}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Card: Edit details (pending-only) */}
          {canManage && (
            <Card className="p-6 sm:p-8">
              <DetailEditForm
                title={t("cred.detail.editDetails")}
                fields={editFields}
                canEdit={isPendingReview}
                editDisabledReason={t("cred.detail.editOnlyPending")}
                onSave={handleSave}
                onCancel={() => form.reset(buildCredentialEditDefaults(cred))}
                isSaving={update.isPending}
              />
            </Card>
          )}

          {/* Card: Competency replace-set editor */}
          {canManage && (
            <Card className="p-6 sm:p-8">
              <CredentialCompetencyEditor
                key={cred.id}
                credentialId={cred.id}
                appliedIds={competencyIds}
                onSaved={setCompetencyIds}
              />
            </Card>
          )}

          {/* Card 3: Parties */}
          <Card className="divide-y divide-gray-100 p-6 sm:p-8">
            <div className="pb-5">
              <UserContactBlock
                user={cred.holder}
                fallbackId={cred.holder_user_id}
                copyPrefix="holder"
                labelType="full"
                layout="grid"
                blockLinks={!canManage}
              />
            </div>
            <div className="py-5">
              <UserContactBlock
                user={cred.issuer}
                fallbackId={cred.issuer_user_id}
                copyPrefix="issuer"
                labelType="full"
                layout="grid"
                blockLinks={!canManage}
              />
            </div>
            {revoked && cred.revoker && (
              <div className="pt-5">
                <UserContactBlock
                  user={cred.revoker}
                  fallbackId={cred.revoker_user_id ?? ""}
                  copyPrefix="revoker"
                  labelType="full"
                  layout="grid"
                  tone="error"
                  blockLinks={!canManage}
                />
              </div>
            )}
          </Card>
        </>
      )}

      {cred && (
        <>
          <CredentialRejectReasonModal
            open={rejectModalOpen}
            onOpenChange={setRejectModalOpen}
            items={[{ id: cred.id, name: cred.name }]}
            onSubmit={(rejections) =>
              reject.mutate(rejections, { onSuccess: () => setRejectModalOpen(false) })
            }
            isSubmitting={reject.isPending}
          />
          {dialog}
        </>
      )}
    </div>
  );
}
