import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useCredential } from "./api/useCredential";
import { useReExtractCredentials } from "./api/useReExtractCredentials";
import { useApproveCredentials } from "./api/useApproveCredentials";
import { useRejectCredentials } from "./api/useRejectCredentials";
import { useRevokeCredentials } from "./api/useRevokeCredentials";
import { useUpdateCredentials, type CredentialUpdateItem } from "./api/useUpdateCredentials";
import { useLinkCompetencies } from "./api/useLinkCompetencies";
import { CredentialMetadataResolver } from "./components/CredentialMetadataResolver";
import { CredentialHeroCard } from "./components/CredentialHeroCard";
import { CredentialSystemFacts } from "./components/CredentialSystemFacts";
import { credentialEditRowSchema, type CredentialEditRowInput } from "./schemas/credential";
import { useStore } from "@app/store";
import { Role, canAccessAny } from "@shared/auth/role";
import { PageHeader } from "@shared/components/PageHeader";
import { BackLink } from "@shared/components/BackLink";
import { EmptyState } from "@shared/components/EmptyState";
import { DetailEditForm, type DetailField } from "@shared/components/DetailEditForm";
import { MetaDisplay } from "@shared/components/MetaDisplay";
import { MetaEditor } from "@shared/components/MetaEditor";
import { MonoId } from "@shared/components/MonoId";
import { UserContactBlock } from "@shared/components/UserContactBlock";
import { SearchableCreateSelect } from "@shared/components/SearchableCreateSelect";
import { Card } from "@ui/card";
import { DecorBlob } from "@shared/components/DecorBlob";
import { Input } from "@ui/input";
import { Badge } from "@ui/badge";
import { Skeleton } from "@ui/skeleton";
import { useConfirm } from "@ui/confirm-dialog";
import { formatDate } from "@shared/lib/format";
import { mergeMeta, metaEqual, splitMeta } from "@shared/lib/meta";
import type { CredentialDTO } from "@shared/types/api";

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

export function CredentialDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const currentUser = useStore((s) => s.user);
  const canManage = canAccessAny(currentUser?.role, [Role.ISSUER, Role.ADMIN, Role.SUPER_ADMIN]);
  const {
    data: cred,
    isLoading,
    isError,
  } = useCredential(id ?? "", [
    "holder",
    "issuer",
    "revoker",
    "competencies",
    "type",
    "issuer_organization",
  ]);
  const reExtract = useReExtractCredentials();
  const approve = useApproveCredentials();
  const reject = useRejectCredentials();
  const revoke = useRevokeCredentials();
  const update = useUpdateCredentials();
  const link = useLinkCompetencies();
  const { confirm, dialog } = useConfirm();
  // Seeded from the loaded credential, not []. The competency editor folded
  // into the Detail card's edit mode is a replace-set: an empty seed makes
  // Save delete every existing link.
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

  const revoked = cred?.status === "revoked";
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
          readValue: cred.type?.name ? (
            <span>{cred.type.name}</span>
          ) : cred.type_id ? (
            <MonoId value={cred.type_id} mode="id" />
          ) : (
            <span className="text-gray-500">
              {cred.submitted_type_name} · {t("cred.metadata.pending")}
            </span>
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
          readValue: cred.issuer_organization?.name ? (
            <span>{cred.issuer_organization.name}</span>
          ) : cred.issuer_organization_id ? (
            <MonoId value={cred.issuer_organization_id} mode="id" />
          ) : (
            <span className="text-gray-500">
              {cred.submitted_issuer_organization_name} · {t("cred.metadata.pending")}
            </span>
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
            <Skeleton className="h-20 w-full" />
          </Card>
        </>
      ) : (
        <>
          {/* Card 1: Artifact — file, validity, review actions */}
          <Card className="relative overflow-hidden p-6 shadow-lg ring-1 shadow-gold/20 ring-gold/10 sm:p-8">
            <DecorBlob tone="gold" position="top-right" size="lg" />
            <CredentialHeroCard
              credential={cred}
              canManage={canManage}
              isReExtracting={reExtract.isPending}
              isApproving={approve.isPending}
              isRevoking={revoke.isPending}
              isRejecting={reject.isPending}
              onReExtract={() => reExtract.mutate([cred.id])}
              onApprove={() => approve.mutate([cred.id])}
              onReject={(rejections) => reject.mutate(rejections)}
              onRevoke={() => void handleRevoke()}
            />
          </Card>

          {/* Blocking alert: staged names must resolve before approval */}
          {canManage && isPendingReview && hasUnresolvedMetadata && (
            <CredentialMetadataResolver credentialId={cred.id} />
          )}

          {/* Card 2: Data — facts, competencies, people, and (Issuer+) the single edit surface */}
          <Card className="p-6 sm:p-8">
            <DetailEditForm
              title={t("cred.detail.cardTitle")}
              fields={editFields}
              canEdit={canManage && isPendingReview}
              editDisabledReason={canManage ? t("cred.detail.editOnlyPending") : undefined}
              onSave={handleSave}
              onCancel={handleCancel}
              isSaving={update.isPending || link.isPending}
            />

            <div className="mt-6 divide-y divide-gray-100 border-t border-gray-100 pt-6">
              <div className="pb-5">
                <UserContactBlock
                  user={cred.holder}
                  fallbackId={cred.holder_user_id}
                  copyPrefix="holder"
                  labelType="full"
                  layout="grid"
                  blockLinks={!canManage}
                >
                  {cred.holder_user_id === cred.issuer_user_id && (
                    <p className="text-xs text-gray-500">{t("cred.parties.selfSubmitted")}</p>
                  )}
                </UserContactBlock>
              </div>
              {cred.holder_user_id !== cred.issuer_user_id && (
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
              )}
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
            </div>

            <CredentialSystemFacts credential={cred} />
          </Card>
        </>
      )}

      {cred && dialog}
    </div>
  );
}
