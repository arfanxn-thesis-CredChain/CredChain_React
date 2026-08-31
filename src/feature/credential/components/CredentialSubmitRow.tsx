import { useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ChevronDown, Copy, Trash2 } from "lucide-react";
import { Button } from "@ui/button";
import { Input } from "@ui/input";
import { FormField } from "@ui/form-field";
import { SearchableCreateSelect } from "@shared/components/SearchableCreateSelect";
import { MetaEditor } from "@shared/components/MetaEditor";
import { cn } from "@shared/lib/cn";
import { CredentialFileInput } from "./CredentialFileInput";
import { CredentialFileModal } from "./CredentialFileModal";
import type { CredentialBatchSubmitInput } from "../schemas/credential";

interface CredentialSubmitRowProps {
  index: number;
  form: UseFormReturn<CredentialBatchSubmitInput>;
  onRemove?: () => void;
  onDuplicate?: () => void;
}

type FieldError = { message?: string };

function errorMessage(fieldError: FieldError | unknown | undefined): string | undefined {
  if (fieldError && typeof fieldError === "object" && "message" in fieldError) {
    return (fieldError as { message?: string }).message;
  }
  return undefined;
}

export function CredentialSubmitRow({
  index,
  form,
  onRemove,
  onDuplicate,
}: CredentialSubmitRowProps) {
  const { t } = useTranslation();
  const errors = form.formState.errors.credentials?.[index];
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
            aria-label={t("cred.submit.duplicateAriaLabel")}
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
            aria-label={t("cred.submit.removeAriaLabel", { n: index + 1 })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid w-full grid-cols-1 gap-4 pr-12 sm:gap-6 md:grid-cols-2">
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

        <SearchableCreateSelect
          mode="propose"
          resource="credential-types"
          label={t("cred.submit.field.type")}
          placeholder={t("cred.submit.field.typePlaceholder")}
          value={form.watch(`credentials.${index}.type_id`) ?? ""}
          onChange={(id) =>
            form.setValue(`credentials.${index}.type_id`, id, { shouldValidate: true })
          }
          proposed={form.watch(`credentials.${index}.submitted_type_name`) ?? ""}
          onProposeChange={(name) =>
            form.setValue(`credentials.${index}.submitted_type_name`, name, { shouldValidate: true })
          }
          error={errorMessage(errors?.type_id)}
        />

        <SearchableCreateSelect
          mode="propose"
          resource="credential-issuer-organizations"
          label={t("cred.submit.field.issuerOrganization")}
          placeholder={t("cred.submit.field.orgPlaceholder")}
          value={form.watch(`credentials.${index}.issuer_organization_id`) ?? ""}
          onChange={(id) =>
            form.setValue(`credentials.${index}.issuer_organization_id`, id, {
              shouldValidate: true,
            })
          }
          proposed={form.watch(`credentials.${index}.submitted_issuer_organization_name`) ?? ""}
          onProposeChange={(name) =>
            form.setValue(`credentials.${index}.submitted_issuer_organization_name`, name, {
              shouldValidate: true,
            })
          }
          error={errorMessage(errors?.issuer_organization_id)}
        />

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

        <FormField label={t("cred.submit.field.issuedAt")} error={errorMessage(errors?.issued_at)}>
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
          <SearchableCreateSelect
            multiple
            mode="propose"
            resource="competencies"
            label={t("cred.submit.field.competencies")}
            placeholder={t("cred.submit.field.competencyPlaceholder")}
            value={form.watch(`credentials.${index}.competency_ids`) ?? []}
            onChange={(ids) =>
              form.setValue(`credentials.${index}.competency_ids`, ids, { shouldValidate: true })
            }
            proposedNames={form.watch(`credentials.${index}.submitted_competency_names`) ?? []}
            onProposedNamesChange={(names) =>
              form.setValue(`credentials.${index}.submitted_competency_names`, names, {
                shouldValidate: true,
              })
            }
            error={errorMessage(errors?.competency_ids)}
          />
        </div>

        <div className="md:col-span-2">
          <FormField label={t("cred.field.file")} error={errorMessage(errors?.file)}>
            <CredentialFileInput
              file={file ?? null}
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
