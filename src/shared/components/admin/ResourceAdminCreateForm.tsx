import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUpsertReference } from "@shared/api/useReferenceData";
import { InlineCreateRow } from "@shared/components/InlineCreateRow";
import { notify } from "@shared/lib/notify";
import type { ReferenceResource, ReferenceRow } from "@shared/types/api";

const ADMIN_RESOURCE_KEY: Record<ReferenceResource, string> = {
  "credential-types": "credType",
  "credential-issuer-organizations": "issuerOrg",
  competencies: "competency",
};

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
      // The resource-specific label names the trigger ("Add type"); the submit
      // is the generic "Add", as in the unit tree. Reusing one string for both
      // leaves two same-named buttons in the a11y tree during the open frame.
      triggerLabel={submitLabel ?? t("admin.createAction")}
      placeholder={placeholder ?? t(`admin.${block}.createPlaceholder`)}
      inputAriaLabel={t(`admin.${block}.createLabel`)}
      submitLabel={t("admin.createAction")}
      submitVariant="gold"
      isPending={upsert.isPending}
    />
  );
}
