import type { TFunction } from "i18next";
import type { DetailField } from "@shared/components/DetailEditForm";
import { StagedValue } from "@shared/components/StagedValue";
import { MonoId } from "@shared/components/MonoId";
import { MetaDisplay } from "@shared/components/MetaDisplay";
import { Badge } from "@ui/badge";
import { formatDate } from "@shared/lib/format";

interface ReadCredential {
  name: string;
  number: string | null;
  type_id?: string;
  issuer_organization_id?: string;
  type?: { name: string } | null;
  issuer_organization?: { name: string } | null;
  submitted_type_name?: string | null;
  submitted_issuer_organization_name?: string | null;
  issued_at: string;
  expires_at: string | null;
  competencies?: { name: string }[];
  meta: Record<string, unknown> | null;
}

export function buildCredentialReadFields(
  cred: ReadCredential,
  t: TFunction,
  language: string,
): DetailField[] {
  const list = (cred.competencies ?? []).map((c) => c.name);
  if (!list.length && cred.meta) {
    const raw = cred.meta.competencies || cred.meta.competency;
    for (const value of Array.isArray(raw) ? raw : [raw]) {
      if (typeof value === "string" && value.trim()) list.push(value.trim());
    }
  }
  return [
    {
      key: "name",
      label: t("cred.submit.field.name"),
      readValue: <span>{cred.name}</span>,
      editControl: null,
    },
    {
      key: "number",
      label: t("cred.submit.field.number"),
      readValue: <span>{cred.number ?? t("common.notSet")}</span>,
      editControl: null,
    },
    {
      key: "type_id",
      label: t("cred.submit.field.type"),
      readValue: (
        <StagedValue
          resolved={cred.type?.name}
          staged={cred.submitted_type_name}
          fallback={cred.type_id ? <MonoId value={cred.type_id} mode="id" /> : undefined}
        />
      ),
      editControl: null,
    },
    {
      key: "issuer_organization_id",
      label: t("cred.submit.field.issuerOrganization"),
      readValue: (
        <StagedValue
          resolved={cred.issuer_organization?.name}
          staged={cred.submitted_issuer_organization_name}
          fallback={
            cred.issuer_organization_id ? (
              <MonoId value={cred.issuer_organization_id} mode="id" />
            ) : undefined
          }
        />
      ),
      editControl: null,
    },
    {
      key: "issued_at",
      label: t("cred.submit.field.issuedAt"),
      readValue: <span>{formatDate(cred.issued_at, language)}</span>,
      editControl: null,
    },
    {
      key: "expires_at",
      label: t("cred.submit.field.expiresAt"),
      readValue: (
        <span>{cred.expires_at ? formatDate(cred.expires_at, language) : t("common.notSet")}</span>
      ),
      editControl: null,
    },
    {
      key: "competencies",
      label: t("cred.competency.title"),
      readValue: list.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {list.map((name, index) => (
            <Badge key={`${name}-${index}`} tone="gold" className="max-w-full truncate">
              {name}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-gray-500">{t("common.notSet")}</span>
      ),
      editControl: null,
      fullWidth: true,
    },
    {
      key: "meta",
      label: t("cred.field.meta"),
      readValue: <MetaDisplay meta={cred.meta} />,
      editControl: null,
      fullWidth: true,
    },
  ];
}
