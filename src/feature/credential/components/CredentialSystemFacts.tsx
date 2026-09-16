import { useTranslation } from "react-i18next";
import { DetailRow } from "@shared/components/DetailRow";
import { CopyInlineButton } from "@shared/components/CopyInlineButton";
import { formatDateTime, truncateAddress, truncateId } from "@shared/lib/format";
import { lifecycleDateLines } from "@shared/lib/credentialDate";
import { cn } from "@shared/lib/cn";
import type { CredentialDTO } from "@shared/types/api";

interface CredentialSystemFactsProps {
  credential: CredentialDTO;
}

/**
 * Always-visible machine facts: file hash, on-chain token id, lifecycle event
 * dates. Rendered as a compact 4-column muted grid. All IDs are truncated
 * with copy buttons providing the full value.
 */
export function CredentialSystemFacts({ credential: cred }: CredentialSystemFactsProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-6 border-t border-gray-100 pt-6">
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <DetailRow
          label={t("cred.detail.credentialId")}
          value={
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs text-gray-500" title={cred.id}>
                {truncateId(cred.id)}
              </span>
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
              <span className="font-mono text-xs text-gray-500" title={cred.file_hash}>
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
                <span className="font-mono text-xs text-gray-500" title={cred.token_id}>
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
