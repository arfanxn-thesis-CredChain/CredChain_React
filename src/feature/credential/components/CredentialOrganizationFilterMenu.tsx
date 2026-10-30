import { useState } from "react";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";
import { useIssuerOrganizations, useReferenceByIds } from "../api/useReferenceData";
import { CredentialFilterMenu } from "./CredentialFilterMenu";

interface CredentialOrganizationFilterMenuProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function CredentialOrganizationFilterMenu({
  value,
  onChange,
}: CredentialOrganizationFilterMenuProps) {
  const [query, setQuery] = useState("");
  const list = useIssuerOrganizations({ search: useDebouncedValue(query.trim(), 300) });
  const selected = useReferenceByIds(
    "credential-issuer-organizations",
    value ? [value] : [],
  );
  const hasSelectedInOptions = list.items.some((o) => o.id === value);
  const isUnavailable = Boolean(
    value && selected.isSuccess && !selected.data?.length && !hasSelectedInOptions,
  );

  return (
    <CredentialFilterMenu
      labelKey="cred.filter.organization"
      allLabelKey="cred.filter.organizationAll"
      value={value}
      onChange={onChange}
      options={list.items}
      searchValue={query}
      onSearchChange={setQuery}
      hasMore={list.hasMore}
      onLoadMore={list.loadMore}
      isFetchingNextPage={list.isFetchingNextPage}
      selectedName={selected.data?.[0]?.name}
      isLoadingSelected={Boolean(value && selected.isLoading && !hasSelectedInOptions)}
      isUnavailable={isUnavailable}
    />
  );
}
