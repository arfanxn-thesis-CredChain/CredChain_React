import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Save } from "lucide-react";

import { BackLink } from "@shared/components/BackLink";
import { PageHeader } from "@shared/components/PageHeader";
import { Button } from "@ui/button";
import { Card } from "@ui/card";

import { useSubmitCredentials } from "./api/useSubmitCredentials";
import {
  type CredentialBatchSubmitInput,
  credentialBatchSubmitSchema,
  defaultCredentialSubmitRow,
} from "./schemas/credential";
import { CredentialSubmitRow } from "./components/CredentialSubmitRow";

export function CredentialSubmit() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const form = useForm<CredentialBatchSubmitInput>({
    resolver: zodResolver(credentialBatchSubmitSchema),
    defaultValues: { credentials: [defaultCredentialSubmitRow()] },
    mode: "onBlur",
  });

  const submit = useSubmitCredentials(form);
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "credentials",
  });

  const onSubmit = form.handleSubmit((data) => {
    submit.mutate(data.credentials, {
      onSuccess: () => navigate("/credentials"),
    });
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink />

      <PageHeader title={t("cred.submit.title")} description={t("cred.submit.description")} />

      <Card className="overflow-visible p-0">
        <form onSubmit={onSubmit} className="space-y-8 p-6 sm:p-8">
          <div className="space-y-6">
            {fields.map((field, index) => (
              <CredentialSubmitRow
                key={field.id}
                index={index}
                form={form}
                onRemove={fields.length > 1 ? () => remove(index) : undefined}
                onDuplicate={
                  fields.length < 100
                    ? () => {
                        const values = form.getValues(`credentials.${index}`);
                        append({
                          name: values.name,
                          type_id: values.type_id,
                          issuer_organization_id: values.issuer_organization_id,
                          issued_at: values.issued_at,
                          number: values.number,
                          expires_at: values.expires_at,
                          competency_ids: values.competency_ids ? [...values.competency_ids] : [],
                          meta_entries: values.meta_entries
                            ? values.meta_entries.map((e) => ({ ...e }))
                            : [],
                          file: null,
                        });
                      }
                    : undefined
                }
              />
            ))}
          </div>

          <div className="flex flex-col items-stretch justify-between gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="dashed"
              onClick={() => append(defaultCredentialSubmitRow())}
              disabled={fields.length >= 100}
            >
              <Plus className="h-4 w-4" />
              {t("cred.submit.addAnother")}
            </Button>

            <Button type="submit" variant="primary" size="lg" disabled={submit.isPending}>
              <Save className="h-5 w-5" />
              {submit.isPending ? t("cred.submit.submitting") : t("cred.submit.submit")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
