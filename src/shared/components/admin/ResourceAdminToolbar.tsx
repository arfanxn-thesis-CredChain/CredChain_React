import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RoleGate } from "@shared/auth/guards";
import { Role } from "@shared/auth/role";
import { ResourceAdminCreateForm } from "@shared/components/admin/ResourceAdminCreateForm";
import type { ReferenceResource, ReferenceRow } from "@shared/types/api";
import { Input } from "@ui/input";

interface ResourceAdminToolbarProps {
  resource: ReferenceResource;
  rows: ReferenceRow[];
  createLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
}

/**
 * Search box plus the admin-only create row, shared by the three reference
 * admin pages.
 *
 * Only the create form is role-gated: search is a read affordance, and gating
 * the whole strip (as the pages used to) hid it from everyone but admins.
 */
export function ResourceAdminToolbar({
  resource,
  rows,
  createLabel,
  searchValue,
  onSearchChange,
  searchPlaceholder,
}: ResourceAdminToolbarProps) {
  const { t } = useTranslation();
  const placeholder = searchPlaceholder ?? t("admin.searchPlaceholder");

  return (
    <div className="space-y-4 border-b border-gray-50 p-4 sm:p-6">
      <div className="w-full md:max-w-2xl">
        <Input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          leadingIcon={Search}
          placeholder={placeholder}
          aria-label={placeholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <RoleGate allowed={[Role.ADMIN, Role.SUPER_ADMIN]}>
        <ResourceAdminCreateForm resource={resource} rows={rows} submitLabel={createLabel} />
      </RoleGate>
    </div>
  );
}
