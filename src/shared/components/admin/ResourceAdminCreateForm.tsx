import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useUpsertReference } from "@shared/api/useReferenceData";
import { notify } from "@shared/lib/notify";
import type { ReferenceResource, ReferenceRow } from "@shared/types/api";
import { Button } from "@ui/button";
import { FormField } from "@ui/form-field";
import { Input } from "@ui/input";

const ADMIN_RESOURCE_KEY: Record<ReferenceResource, string> = {
  "credential-types": "credType",
  "credential-issuer-organizations": "issuerOrg",
  competencies: "competency",
};

const schema = z.object({
  name: z.string().trim().min(1, "zod.name.required").max(256, "zod.name.tooLong"),
});

interface ResourceAdminCreateFormProps {
  resource: ReferenceResource;
  rows: ReferenceRow[];
  placeholder?: string;
  submitLabel?: string;
}

/**
 * Quick-create row for reference resources. Mirrors SearchableCreateSelect's
 * upsert heuristic: the backend Store returns 200 + the existing row for a
 * duplicate name (same success code), so we compare the returned row id
 * against the current list snapshot to tell "created" from "already exists".
 */
export function ResourceAdminCreateForm({
  resource,
  rows,
  placeholder,
  submitLabel,
}: ResourceAdminCreateFormProps) {
  const { t } = useTranslation();
  const upsert = useUpsertReference(resource);
  const block = ADMIN_RESOURCE_KEY[resource];
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ name: string }>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(({ name }) => {
    upsert.mutate(name, {
      onSuccess: (row) => {
        if (rows.some((r) => r.id === row.id)) {
          notify.info(`admin.${block}.alreadyExists`);
        } else {
          notify.success(`admin.${block}.created`);
        }
        reset();
      },
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <FormField
        label={t(`admin.${block}.createLabel`)}
        error={errors.name?.message}
        optional={false}
      >
        <Input
          placeholder={placeholder ?? t(`admin.${block}.createPlaceholder`)}
          autoComplete="off"
          {...register("name")}
        />
      </FormField>
      <Button
        type="submit"
        variant="gold"
        disabled={upsert.isPending}
        className="shrink-0 sm:mt-6"
      >
        {upsert.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="h-4 w-4" aria-hidden="true" />
        )}
        {submitLabel ?? t("admin.createAction")}
      </Button>
    </form>
  );
}
