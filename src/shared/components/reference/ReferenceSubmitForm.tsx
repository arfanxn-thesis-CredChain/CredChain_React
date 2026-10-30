import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSubmitReference } from "@shared/api/useReferenceData";
import { InlineCreateRow } from "@shared/components/InlineCreateRow";
import type { ReferenceResource } from "@shared/types/api";

const RESOURCE_KEY: Record<ReferenceResource, string> = {
  "credential-types": "type",
  "credential-issuer-organizations": "issuerOrg",
  competencies: "competency",
};

export interface ReferenceSubmitFormProps {
  resource: ReferenceResource;
  placeholder?: string;
  submitLabel?: string;
}

export function ReferenceSubmitForm({
  resource,
  placeholder,
  submitLabel,
}: ReferenceSubmitFormProps) {
  const { t } = useTranslation();
  const submit = useSubmitReference(resource);
  const block = RESOURCE_KEY[resource];
  const [open, setOpen] = useState(false);

  return (
    <InlineCreateRow
      open={open}
      onOpenChange={setOpen}
      onSubmit={(name) =>
        submit.mutate(name, {
          onSuccess: () => {
            setOpen(false);
          },
        })
      }
      triggerLabel={submitLabel ?? t(`cred.references.requestAction.${block}`)}
      placeholder={placeholder ?? t(`cred.references.requestPlaceholder.${block}`)}
      inputAriaLabel={t(`cred.references.requestAction.${block}`)}
      submitLabel={t("cred.references.submitBtn")}
      submitVariant="gold"
      isPending={submit.isPending}
    />
  );
}
