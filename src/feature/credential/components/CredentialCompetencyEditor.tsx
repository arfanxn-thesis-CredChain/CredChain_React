import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Award, Loader2 } from "lucide-react";
import { SearchableCreateSelect } from "@shared/components/SearchableCreateSelect";
import { MonoId } from "@shared/components/MonoId";
import { Badge } from "@ui/badge";
import { Button } from "@ui/button";
import { useReferenceByIds } from "@shared/api/useReferenceData";
import { useLinkCompetencies } from "../api/useLinkCompetencies";

interface CredentialCompetencyEditorProps {
  credentialId: string;
  appliedIds: string[];
  onSaved?: (ids: string[]) => void;
}

export function CredentialCompetencyEditor({
  credentialId,
  appliedIds,
  onSaved,
}: CredentialCompetencyEditorProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>(appliedIds);
  const link = useLinkCompetencies();

  // Resolve only the applied ids. Fetching a page and hoping the applied rows
  // are on it breaks as soon as the list is longer than one page.
  const applied = useReferenceByIds("competencies", appliedIds);
  const namesById = new Map((applied.data ?? []).map((row) => [row.id, row.name]));

  const handleSave = () => {
    link.mutate(
      { credentialId, competencyIds: selected },
      { onSuccess: () => onSaved?.(selected) },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5 text-gold" aria-hidden="true" />
        <h3 className="font-sans text-lg font-bold text-navy">{t("cred.competency.title")}</h3>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {appliedIds.length === 0 && (
          <span className="text-xs text-gray-400">{t("cred.competency.empty")}</span>
        )}
        {appliedIds.map((id) => (
          <Badge key={id} tone="gold">
            {namesById.get(id) ?? <MonoId value={id} />}
          </Badge>
        ))}
      </div>

      <SearchableCreateSelect
        multiple
        resource="competencies"
        placeholder={t("cred.submit.field.competencyPlaceholder")}
        value={selected}
        onChange={setSelected}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">{t("cred.competency.saveToApply")}</p>
        <Button variant="gold" onClick={handleSave} disabled={link.isPending}>
          {link.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {link.isPending ? t("common.saving") : t("cred.competency.save")}
        </Button>
      </div>
    </div>
  );
}
