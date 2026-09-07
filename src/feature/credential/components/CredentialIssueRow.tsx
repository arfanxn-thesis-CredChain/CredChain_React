import { useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Trash2, Copy, ChevronDown } from "lucide-react";
import type { UserDTO } from "@shared/types/api";
import { Button } from "@ui/button";
import { Input } from "@ui/input";
import { FormField } from "@ui/form-field";
import { HolderSearchDropdown } from "@shared/components/HolderSearchDropdown";
import { SearchableCreateSelect } from "@shared/components/SearchableCreateSelect";
import { MetaEditor } from "@shared/components/MetaEditor";
import { api } from "@shared/api/client";
import { cn } from "@shared/lib/cn";
import { CredentialFileInput } from "./CredentialFileInput";
import { CredentialFileModal } from "./CredentialFileModal";
import { errorMessage } from "./errorMessage";
import type { CredentialBatchIssueInput } from "../schemas/credential";

interface CredentialIssueRowProps {
  index: number;
  form: UseFormReturn<CredentialBatchIssueInput>;
  onRemove?: () => void;
  onDuplicate?: () => void;
}

export function CredentialIssueRow({
  index,
  form,
  onRemove,
  onDuplicate,
}: CredentialIssueRowProps) {
  const { t } = useTranslation();
  const errors = form.formState.errors.credentials?.[index];
  const holderId = form.watch(`credentials.${index}.holder_user_id`);
  const file = form.watch(`credentials.${index}.file`);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const nameManuallyEdited = useRef(false);
  const { onChange: rhfNameOnChange, ...nameRest } = form.register(`credentials.${index}.name`);

  return (
    <div className="relative flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-all focus-within:border-gold/50 focus-within:bg-white sm:gap-6 sm:p-6">
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 sm:top-4 sm:right-4">
        {onDuplicate && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDuplicate}
            className="h-8 w-8 text-gray-400 hover:bg-gold/10 hover:text-gold sm:h-9 sm:w-9"
            aria-label={t("cred.issue.duplicateAriaLabel")}
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-gray-400 hover:bg-error/10 hover:text-error sm:h-9 sm:w-9"
            aria-label={t("cred.issue.removeAriaLabel", { n: index + 1 })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid w-full grid-cols-1 gap-4 pr-12 sm:gap-6 md:grid-cols-2">
        <FormField label={t("cred.field.holder")} error={errorMessage(errors?.holder_user_id)}>
          <HolderSearchDropdown
            value={holderId}
            onChange={(id) =>
              form.setValue(`credentials.${index}.holder_user_id`, id, {
                shouldValidate: true,
              })
            }
            onResolveUser={async (userId) => {
              const response = await api.get(`/users/${userId}`);
              return (response.data as UserDTO) ?? null;
            }}
            error={errorMessage(errors?.holder_user_id)}
            searchPlaceholder={t("cred.field.holderSearch")}
            noResultsText={t("cred.field.noSearchResults")}
            onSearch={async (query) => {
              const response = await api.get("/users", {
                params: {
                  search: query,
                  filters: ["role=holder"],
                  limit: 20,
                },
              });
              return (response.data as { items: UserDTO[] }).items ?? [];
            }}
          />
        </FormField>

        <FormField label={t("cred.field.name")} error={errorMessage(errors?.name)}>
          <Input
            placeholder={t("cred.field.namePlaceholder")}
            onChange={(e) => {
              nameManuallyEdited.current = true;
              rhfNameOnChange(e);
            }}
            {...nameRest}
          />
        </FormField>

        <FormField label={t("cred.submit.field.type")} error={errorMessage(errors?.type_id)}>
          <SearchableCreateSelect
            resource="credential-types"
            label={t("cred.submit.field.type")}
            placeholder={t("cred.submit.field.typePlaceholder")}
            value={form.watch(`credentials.${index}.type_id`) ?? ""}
            onChange={(id) =>
              form.setValue(`credentials.${index}.type_id`, id, { shouldValidate: true })
            }
            error={errorMessage(errors?.type_id)}
          />
        </FormField>

        <FormField
          label={t("cred.submit.field.issuerOrganization")}
          error={errorMessage(errors?.issuer_organization_id)}
        >
          <SearchableCreateSelect
            resource="credential-issuer-organizations"
            label={t("cred.submit.field.issuerOrganization")}
            placeholder={t("cred.submit.field.orgPlaceholder")}
            value={form.watch(`credentials.${index}.issuer_organization_id`) ?? ""}
            onChange={(id) =>
              form.setValue(`credentials.${index}.issuer_organization_id`, id, {
                shouldValidate: true,
              })
            }
            error={errorMessage(errors?.issuer_organization_id)}
          />
        </FormField>

        <FormField
          label={t("cred.submit.field.issuedAt")}
          error={errorMessage(errors?.issued_at)}
          optional
        >
          <Input type="date" {...form.register(`credentials.${index}.issued_at`)} />
        </FormField>

        <FormField
          label={t("cred.submit.field.expiresAt")}
          error={errorMessage(errors?.expires_at)}
          optional
        >
          <Input type="date" {...form.register(`credentials.${index}.expires_at`)} />
        </FormField>

        <div className="md:col-span-2">
          <FormField
            label={t("cred.submit.field.number")}
            error={errorMessage(errors?.number)}
            optional
          >
            <Input
              placeholder={t("cred.submit.field.numberPlaceholder")}
              {...form.register(`credentials.${index}.number`)}
            />
          </FormField>
        </div>

        <div className="md:col-span-2">
          <FormField
            label={t("cred.submit.field.competencies")}
            error={errorMessage(errors?.competency_ids)}
          >
            <SearchableCreateSelect
              multiple
              resource="competencies"
              label={t("cred.submit.field.competencies")}
              placeholder={t("cred.submit.field.competencyPlaceholder")}
              value={form.watch(`credentials.${index}.competency_ids`) ?? []}
              onChange={(ids) =>
                form.setValue(`credentials.${index}.competency_ids`, ids, { shouldValidate: true })
              }
              error={errorMessage(errors?.competency_ids)}
            />
          </FormField>
        </div>

        <div className="md:col-span-2">
          <FormField label={t("cred.field.file")}>
            <CredentialFileInput
              file={file ?? null}
              error={errorMessage(errors?.file)}
              onChange={(f) => {
                form.setValue(`credentials.${index}.file`, f, { shouldValidate: true });
                if (!f && !nameManuallyEdited.current) {
                  form.setValue(`credentials.${index}.name`, "", { shouldValidate: true });
                } else if (f && !nameManuallyEdited.current) {
                  const stem = f.name.replace(/\.[^.]+$/, "");
                  form.setValue(`credentials.${index}.name`, stem, { shouldValidate: true });
                }
              }}
              onExpand={() => setPreviewOpen(true)}
            />
          </FormField>
        </div>
      </div>

      <div className="mt-2 sm:mt-4">
        <button
          type="button"
          onClick={() => setCustomFieldsOpen(!customFieldsOpen)}
          className="flex items-center gap-1.5 py-2 text-sm font-medium text-gray-500 hover:text-navy"
        >
          {t("cred.field.meta")}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", customFieldsOpen && "rotate-180")}
          />
        </button>
        {customFieldsOpen && (
          <div className="mt-4 ml-2">
            <MetaEditor control={form.control} name={`credentials.${index}.meta_entries`} />
          </div>
        )}
      </div>
      {file && (
        <CredentialFileModal file={file} open={previewOpen} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}
