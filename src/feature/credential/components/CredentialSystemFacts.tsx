import { useTranslation } from "react-i18next";
import { DetailRow } from "@shared/components/DetailRow";
import { CopyInlineButton } from "@shared/components/CopyInlineButton";
import { formatDateTime, truncateAddress } from "@shared/lib/format";
import { lifecycleDateLines } from "@shared/lib/credentialDate";
import { cn } from "@shared/lib/cn";
import type { CredentialDTO } from "@shared/types/api";

interface CredentialSystemFactsProps {
  credential: CredentialDTO;
}

/**
 * Always-visible machine facts: file hash, on-chain token id, lifecycle event
 * dates. The eyebrow labels already say what each value is, so this renders
 * as a plain muted grid — no heading, no collapse. Issued date and meta live
 * in the Detail card's edit fields, not here — rendering them twice was the
 * bug this replaced.
 */
export function CredentialSystemFacts({ credential: cred }: CredentialSystemFactsProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-6 border-t border-gray-100 pt-6">
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <DetailRow
          label={t("cred.detail.credentialId")}
          value={
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs text-gray-500">{cred.id}</span>
              <CopyInlineButton
                value={cred.id}
                ariaLabel={t("cred.copy.credentialId")}
                className="shrink-0"
              />
            </div>
          }
        />
        <DetailRow
          label={t("cred.detail.fileHash")}
          value={
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs text-gray-500">
                {truncateAddress(cred.file_hash)}
              </span>
              <CopyInlineButton
                value={cred.file_hash}
                ariaLabel={t("cred.copy.fileHash")}
                className="shrink-0"
              />
            </div>
          }
        />
        {cred.token_id && (
          <DetailRow
            label={t("cred.detail.tokenId")}
            value={
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-gray-500">
                  {truncateAddress(cred.token_id)}
                </span>
                <CopyInlineButton
                  value={cred.token_id}
                  ariaLabel={t("cred.copy.tokenId")}
                  className="shrink-0"
                />
              </div>
            }
          />
        )}
        {lifecycleDateLines(cred).map((line) => (
          <DetailRow
            key={line.labelKey}
            label={t(line.labelKey)}
            value={
              <span className={cn("text-sm", line.tone === "error" ? "text-error" : "text-navy")}>
                {formatDateTime(line.timestamp)}
              </span>
            }
            tone={line.tone}
          />
        ))}
      </div>
    </div>
  );
}
