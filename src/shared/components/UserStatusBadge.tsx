import { useTranslation } from "react-i18next";
import { XOctagon } from "lucide-react";
import { Badge } from "@ui/badge";

interface UserStatusBadgeProps {
  deletedAt: string | null;
}

export function UserStatusBadge({ deletedAt }: UserStatusBadgeProps) {
  const { t } = useTranslation();

  if (!deletedAt) return null;

  return (
    <Badge tone="error" icon={XOctagon}>
      {t("user.status.trashed")}
    </Badge>
  );
}
