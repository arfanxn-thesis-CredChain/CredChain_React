import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Loader2, Plus } from "lucide-react";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { Skeleton } from "@ui/skeleton";
import type { StagedNameSuggestionDTO } from "@shared/types/api";
import { useMetadataSuggestions } from "../api/useMetadataSuggestions";
import { useResolveMetadata } from "../api/useResolveMetadata";

interface CredentialMetadataResolverProps {
  credentialId: string;
}

/**
 * One choice per staged name: link an existing row (by id) or create the name
 * as typed. `null` means "not decided yet" — the reviewer may resolve one kind
 * now and come back for the rest.
 */
type Choice = { kind: "link"; id: string; name: string } | { kind: "create" } | null;

function StagedCard({
  staged,
  choice,
  onChoose,
  t,
}: {
  staged: StagedNameSuggestionDTO;
  choice: Choice;
  onChoose: (c: Choice) => void;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  return (
    <div>
      <span className="font-semibold text-navy">{staged.submitted_name}</span>

      <div className="mt-2 flex flex-wrap gap-2">
        {staged.matches.map((m) => {
          const picked = choice?.kind === "link" && choice.id === m.id;
          return (
            <Button
              key={m.id}
              type="button"
              variant={picked ? "gold" : "outline"}
              // An inactive row is a deliberately retired one — showing it
              // without blocking it would only produce a 422 from the server.
              disabled={!m.active}
              onClick={() => onChoose(picked ? null : { kind: "link", id: m.id, name: m.name })}
            >
              {picked && <Check className="h-4 w-4" aria-hidden="true" />}
              {m.name}
              {!m.active && (
                <span className="text-xs text-gray-400">{t("cred.submit.inactive")}</span>
              )}
            </Button>
          );
        })}

        <Button
          type="button"
          variant={choice?.kind === "create" ? "gold" : "outline"}
          onClick={() => onChoose(choice?.kind === "create" ? null : { kind: "create" })}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("cred.metadata.createAsTyped", { name: staged.submitted_name })}
        </Button>
      </div>
    </div>
  );
}

export function CredentialMetadataResolver({ credentialId }: CredentialMetadataResolverProps) {
  const { t } = useTranslation();
  const suggestions = useMetadataSuggestions(credentialId, true);
  const resolve = useResolveMetadata();

  const [typeChoice, setTypeChoice] = useState<Choice>(null);
  const [orgChoice, setOrgChoice] = useState<Choice>(null);
  // Keyed by staged competency name — two staged names may resolve differently.
  const [compChoices, setCompChoices] = useState<Record<string, Choice>>({});

  if (suggestions.isLoading) return <Skeleton className="h-40 w-full" />;
  const data = suggestions.data;
  if (!data) return null;

  const nothingStaged = !data.type && !data.organization && data.competencies.length === 0;
  if (nothingStaged) return null;

  const compEntries = Object.entries(compChoices).filter(([, c]) => c !== null);
  const hasChoice =
    typeChoice !== null || orgChoice !== null || compEntries.length > 0;

  const apply = () => {
    resolve.mutate(
      {
        credentialId,
        typeId: typeChoice?.kind === "link" ? typeChoice.id : undefined,
        createTypeName:
          typeChoice?.kind === "create" ? data.type?.submitted_name : undefined,
        organizationId: orgChoice?.kind === "link" ? orgChoice.id : undefined,
        createOrganizationName:
          orgChoice?.kind === "create" ? data.organization?.submitted_name : undefined,
        competencyIds: compEntries
          .map(([, c]) => (c?.kind === "link" ? c.id : null))
          .filter((id): id is string => id !== null),
        createCompetencyNames: compEntries
          .map(([name, c]) => (c?.kind === "create" ? name : null))
          .filter((n): n is string => n !== null),
      },
      {
        onSuccess: () => {
          setTypeChoice(null);
          setOrgChoice(null);
          setCompChoices({});
        },
      },
    );
  };

  return (
    <Card className="space-y-4 p-6 sm:p-8">
      <h3 className="flex items-center gap-2 font-sans text-lg font-bold text-navy">
        <AlertTriangle className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
        {t("cred.metadata.title")}
      </h3>

      {data.type && (
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
            {t("cred.submit.field.type")}
          </p>
          <StagedCard staged={data.type} choice={typeChoice} onChoose={setTypeChoice} t={t} />
        </div>
      )}

      {data.organization && (
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
            {t("cred.submit.field.issuerOrganization")}
          </p>
          <StagedCard staged={data.organization} choice={orgChoice} onChoose={setOrgChoice} t={t} />
        </div>
      )}

      {data.competencies.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
            {t("cred.competency.title")}
          </p>
          {data.competencies.map((staged) => (
            <StagedCard
              key={staged.submitted_name}
              staged={staged}
              choice={compChoices[staged.submitted_name] ?? null}
              onChoose={(c) =>
                setCompChoices((prev) => ({ ...prev, [staged.submitted_name]: c }))
              }
              t={t}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button variant="gold" onClick={apply} disabled={!hasChoice || resolve.isPending}>
          {resolve.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("cred.metadata.apply")}
        </Button>
      </div>
    </Card>
  );
}
