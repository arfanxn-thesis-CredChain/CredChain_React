import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUpsertReference } from "@shared/api/useReferenceData";
import { InlineCreateRow } from "@shared/components/InlineCreateRow";
import { notify } from "@shared/lib/notify";
import type { ReferenceResource, ReferenceRow } from "@shared/types/api";

const RESOURCE_KEY: Record<ReferenceResource, string> = {
  "credential-types": "credType",
  "credential-issuer-organizations": "issuerOrg",
  competencies: "competency",
};

export interface ReferenceCreateFormProps {
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
export function ReferenceCreateForm({
  resource,
  rows,
  placeholder,
  submitLabel,
}: ReferenceCreateFormProps) {
  const { t } = useTranslation();
  const upsert = useUpsertReference(resource);
  const block = RESOURCE_KEY[resource];
  const [open, setOpen] = useState(false);

  return (
    <InlineCreateRow
      open={open}
      onOpenChange={setOpen}
      onSubmit={(name) =>
        upsert.mutate(name, {
          onSuccess: (row) => {
            if (rows.some((r) => r.id === row.id)) {
              notify.info(`admin.${block}.alreadyExists`);
            } else {
              notify.success(`admin.${block}.created`);
            }
            setOpen(false);
          },
        })
      }
      triggerLabel={submitLabel ?? t("admin.createAction")}
      placeholder={placeholder ?? t(`admin.${block}.createPlaceholder`)}
      inputAriaLabel={t(`admin.${block}.createLabel`)}
      submitLabel={t("admin.createAction")}
      submitVariant="gold"
      isPending={upsert.isPending}
    />
  );
}
