import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ui/dialog";
import { Input } from "@ui/input";
import { Badge } from "@ui/badge";
import { Skeleton } from "@ui/skeleton";
import { EmptyState } from "@shared/components/EmptyState";
import { EyebrowLabel } from "@shared/components/EyebrowLabel";
import { DetailEditForm, type DetailField } from "@shared/components/DetailEditForm";
import { StagedValue } from "@shared/components/StagedValue";
import { MetaDisplay } from "@shared/components/MetaDisplay";
import { MetaEditor } from "@shared/components/MetaEditor";
import { MonoId } from "@shared/components/MonoId";
import { UserContactBlock } from "@shared/components/UserContactBlock";
import { SearchableCreateSelect } from "@shared/components/SearchableCreateSelect";
import { CredentialStatusBadge } from "@shared/components/CredentialStatusBadge";
import { CredentialExtractNote } from "@shared/components/CredentialExtractNote";
import { useStore } from "@app/store";
import { Role, canAccessAny } from "@shared/auth/role";
import { formatDate } from "@shared/lib/format";
import { mergeMeta, metaEqual, splitMeta } from "@shared/lib/meta";
import type { CredentialDTO } from "@shared/types/api";

import { useCredential } from "./api/useCredential";
import { useUpdateCredentials, type CredentialUpdateItem } from "./api/useUpdateCredentials";
import { useLinkCompetencies } from "./api/useLinkCompetencies";
import { credentialEditRowSchema, type CredentialEditRowInput } from "./schemas/credential";
import { CredentialMetadataResolver } from "./components/CredentialMetadataResolver";
import { CredentialSystemFacts } from "./components/CredentialSystemFacts";
import { CredentialViewFilePreview } from "./components/CredentialViewFilePreview";

interface CredentialDetailModalProps {
  credentialId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildCredentialEditDefaults(cred: CredentialDTO): CredentialEditRowInput {
  return {
    name: cred.name,
    number: cred.number ?? "",
    type_id: cred.type_id ?? undefined,
    issuer_organization_id: cred.issuer_organization_id ?? undefined,
    issued_at: cred.issued_at.slice(0, 10),
    expires_at: cred.expires_at ? cred.expires_at.slice(0, 10) : "",
    meta_entries: splitMeta(cred.meta).entries,
  };
}

export function CredentialDetailModal({
  credentialId,
  open,
  onOpenChange,
}: CredentialDetailModalProps) {
  const { t } = useTranslation();
  const currentUser = useStore((s) => s.user);
  const canManage = canAccessAny(currentUser?.role, [Role.ISSUER, Role.ADMIN, Role.SUPER_ADMIN]);

  const activeId = open && credentialId ? credentialId : "";
  const {
    data: cred,
    isLoading,
    isError,
  } = useCredential(activeId, [
    "holder",
    "issuer",
    "revoker",
    "rejecter",
    "competencies",
    "type",
    "issuer_organization",
  ]);

  const update = useUpdateCredentials();
  const link = useLinkCompetencies();
  const [competencyIds, setCompetencyIds] = useState<string[]>([]);
  const form = useForm<CredentialEditRowInput>({
    resolver: zodResolver(credentialEditRowSchema),
  });

  useEffect(() => {
    if (cred) {
      form.reset(buildCredentialEditDefaults(cred));
      setCompetencyIds((cred.competencies ?? []).map((c) => c.id));
    }
  }, [cred, form]);

  const isPendingReview = cred?.status === "pending";
  const hasUnresolvedMetadata = (cred?.unresolved_metadata?.length ?? 0) > 0;

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

    const competenciesChanged =
      competencyIds.length !== (cred.competencies?.length ?? 0) ||
      competencyIds.some((cid) => !cred.competencies?.some((c) => c.id === cid));

    await update.mutateAsync([item]);
    if (competenciesChanged) await link.mutateAsync({ credentialId: cred.id, competencyIds });
    return true;
  };

  const handleCancel = () => {
    if (!cred) return;
    form.reset(buildCredentialEditDefaults(cred));
    setCompetencyIds((cred.competencies ?? []).map((c) => c.id));
  };

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
          readValue: (
            <StagedValue
              resolved={cred.type?.name}
              staged={cred.submitted_type_name}
              fallback={cred.type_id ? <MonoId value={cred.type_id} mode="id" /> : undefined}
            />
          ),
          editControl: (
            <SearchableCreateSelect
              label={t("cred.submit.field.type")}
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
          readValue: (
            <StagedValue
              resolved={cred.issuer_organization?.name}
              staged={cred.submitted_issuer_organization_name}
              fallback={
                cred.issuer_organization_id ? (
                  <MonoId value={cred.issuer_organization_id} mode="id" />
                ) : undefined
              }
            />
          ),
          editControl: (
            <SearchableCreateSelect
              label={t("cred.submit.field.issuerOrganization")}
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
          key: "competencies",
          label: t("cred.competency.title"),
          readValue: (cred.competencies?.length ?? 0) > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {(cred.competencies ?? []).map((c) => (
                <Badge key={c.id} tone="gold">
                  {c.name}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-gray-500">{t("common.notSet")}</span>
          ),
          editControl: (
            <SearchableCreateSelect
              multiple
              label={t("cred.competency.title")}
              resource="competencies"
              placeholder={t("cred.submit.field.competencyPlaceholder")}
              value={competencyIds}
              onChange={setCompetencyIds}
            />
          ),
          fullWidth: true,
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

  const statusBadges = cred ? (
    <div className="flex flex-wrap items-center gap-3">
      <CredentialStatusBadge status={cred.status} />
      {canManage && (
        <CredentialExtractNote
          state={cred.extract_state}
          error={cred.extract_error}
        />
      )}
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl sm:max-w-5xl p-6 sm:p-8">
        <DialogHeader className="mb-4 pr-10">
          <DialogTitle className="font-display text-xl font-bold tracking-tight text-navy">
            {cred?.name ?? t("cred.detail.title")}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("cred.detail.cardTitle")}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
              <Skeleton className="h-[92px] w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ) : isError || !cred ? (
          <EmptyState
            icon={AlertCircle}
            title={t("cred.detail.notFound.title")}
            description={t("cred.detail.notFound.body")}
          />
        ) : (
          <div className="space-y-6">
            {/* 1. File Artifact & Status Section */}
            <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
              {cred.file_uri != null ? (
                <CredentialViewFilePreview
                  credentialId={cred.id}
                  credentialName={cred.name}
                  hasFileUri={true}
                  statusSlot={statusBadges}
                />
              ) : (
                <div className="space-y-3">
                  <h3 className="font-sans text-lg font-bold text-navy">{cred.name}</h3>
                  {statusBadges}
                </div>
              )}
            </div>

            {/* Rejection notice banner */}
            {cred.status === "rejected" && cred.rejection_reason && (
              <div className="flex gap-3 rounded-xl border border-error/20 bg-error/5 p-4 text-sm text-error">
                <XCircle className="h-5 w-5 shrink-0 text-error" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t("cred.reject.modal.reasonLabel")}</p>
                  <p className="mt-1 whitespace-pre-wrap">{cred.rejection_reason}</p>
                </div>
              </div>
            )}

            {/* Unresolved staged metadata resolver */}
            {canManage && isPendingReview && hasUnresolvedMetadata && (
              <CredentialMetadataResolver credentialId={cred.id} />
            )}

            {/* 2. Detail Section with Read / Edit toggle */}
            <DetailEditForm
              title={t("cred.detail.cardTitle")}
              fields={editFields}
              canEdit={canManage && isPendingReview}
              editDisabledReason={canManage && !isPendingReview ? t("cred.detail.editOnlyPending") : undefined}
              onSave={handleSave}
              onCancel={handleCancel}
              isSaving={update.isPending || link.isPending}
            />

            {/* 3. Users Section (Holder, Issuer/Approver, Rejecter, Revoker) */}
            <div className="space-y-6 border-t border-gray-100 pt-6">
              {/* Holder */}
              <div className="space-y-2">
                <EyebrowLabel as="span" className="block text-navy">
                  {t("cred.detail.holder")}
                </EyebrowLabel>
                <UserContactBlock
                  user={cred.holder}
                  fallbackId={cred.holder_user_id}
                  copyPrefix="holder"
                  labelType="full"
                  layout="grid"
                  blockLinks={!canManage}
                >
                  {cred.holder_user_id === cred.submitter_user_id && (
                    <p className="text-xs text-gray-500">{t("cred.parties.selfSubmitted")}</p>
                  )}
                </UserContactBlock>
              </div>

              {/* Issuer / Approver */}
              {cred.issuer_user_id && (
                <div className="space-y-2">
                  <EyebrowLabel as="span" className="block text-navy">
                    {cred.submitter_user_id === cred.holder_user_id
                      ? t("cred.audit.approvedBy")
                      : t("cred.audit.registeredBy")}
                  </EyebrowLabel>
                  <UserContactBlock
                    user={cred.issuer}
                    fallbackId={cred.issuer_user_id}
                    copyPrefix="issuer"
                    labelType="full"
                    layout="grid"
                    blockLinks={!canManage}
                  />
                </div>
              )}

              {/* Rejecter */}
              {cred.status === "rejected" && (cred.rejecter || cred.rejecter_user_id) && (
                <div className="space-y-2">
                  <EyebrowLabel as="span" className="block text-error">
                    {t("cred.audit.rejectedBy")}
                  </EyebrowLabel>
                  <UserContactBlock
                    user={cred.rejecter}
                    fallbackId={cred.rejecter_user_id ?? ""}
                    copyPrefix="rejecter"
                    labelType="full"
                    layout="grid"
                    tone="error"
                    blockLinks={!canManage}
                  />
                </div>
              )}

              {/* Revoker */}
              {cred.status === "revoked" && (cred.revoker || cred.revoker_user_id) && (
                <div className="space-y-2">
                  <EyebrowLabel as="span" className="block text-error">
                    {t("cred.audit.revokedBy")}
                  </EyebrowLabel>
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
            </div>

            {/* 4. Bottom System Facts (ID, Hash, Dates) */}
            <CredentialSystemFacts credential={cred} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
