import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Hash, Mail, Phone, VenusAndMars, Wallet } from "lucide-react";
import { cn } from "@shared/lib/cn";
import { truncateAddress } from "@shared/lib/format";
import { CopyInlineButton } from "@shared/components/CopyInlineButton";
import { UserAvatar } from "@shared/components/UserAvatar";
import { UserRoleBadge } from "@shared/components/UserRoleBadge";
import { UserStatusBadge } from "@shared/components/UserStatusBadge";
import type { UserDTO } from "@shared/types/api";

interface UserContactBlockProps {
  user?: UserDTO;
  fallbackId: string;
  copyPrefix: "holder" | "issuer" | "revoker" | "user";
  labelType: "full" | "compact";
  tone?: "default" | "error";
  blockLinks?: boolean;
  layout?: "flex" | "grid";
  children?: ReactNode;
}

export function UserContactBlock({
  user,
  fallbackId,
  copyPrefix,
  labelType,
  tone = "default",
  blockLinks,
  layout = "flex",
  children,
}: UserContactBlockProps) {
  const { t } = useTranslation();

  const name = user?.name ?? user?.email ?? fallbackId;
  const userId = user?.id ?? fallbackId;
  const isDeleted = user?.deleted_at !== null;
  const phoneNumber = (user as (UserDTO & { phone_number?: string | null }) | undefined)
    ?.phone_number;

  const textColor = tone === "error" ? "text-error" : "text-navy";
  const nameWeight = labelType === "full" ? "font-bold" : "font-semibold";

  return (
    <div className="flex items-start gap-3">
      <UserAvatar user={user ?? null} size="sm" className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-col space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {blockLinks ? (
            <span
              className={cn(
                "line-clamp-2 text-left text-sm",
                nameWeight,
                textColor,
                isDeleted && "text-gray-400 line-through",
              )}
            >
              {name}
            </span>
          ) : (
            <Link
              to={`/users/${userId}`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "line-clamp-2 text-left text-sm hover:underline focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
                nameWeight,
                textColor,
                isDeleted && "text-gray-400 line-through",
              )}
            >
              {name}
            </Link>
          )}
          {user?.role && <UserRoleBadge role={user.role} />}
          <UserStatusBadge deletedAt={user?.deleted_at ?? null} />
        </div>

        {labelType === "full" && (
          <div
            className={cn(
              "gap-y-0.5",
              layout === "grid"
                ? "grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3"
                : "flex flex-col",
            )}
          >
            {user?.number && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Hash className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                <span className="truncate">{user.number}</span>
                <CopyInlineButton
                  value={user.number}
                  ariaLabel={t(`cred.copy.${copyPrefix}Number`)}
                  className="shrink-0"
                />
              </div>
            )}

            {user?.email && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Mail className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                <span className="truncate">{user.email}</span>
                <CopyInlineButton
                  value={user.email}
                  ariaLabel={t(`cred.copy.${copyPrefix}Email`)}
                  className="shrink-0"
                />
              </div>
            )}

            {phoneNumber && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Phone className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                <span className="truncate">{phoneNumber}</span>
                <CopyInlineButton
                  value={phoneNumber}
                  ariaLabel={t(`cred.copy.${copyPrefix}Phone`)}
                  className="shrink-0"
                />
              </div>
            )}

            {user?.gender && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <VenusAndMars className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                <span>{t(`user.field.gender.${user.gender}`)}</span>
              </div>
            )}

            {user?.wallet_address && (
              <div className="flex items-center gap-1 font-mono text-xs text-gray-500">
                <Wallet className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                <span className="truncate" title={user.wallet_address}>
                  {truncateAddress(user.wallet_address)}
                </span>
                <CopyInlineButton
                  value={user.wallet_address}
                  ariaLabel={t(`cred.copy.${copyPrefix}Wallet`)}
                  className="shrink-0"
                />
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
