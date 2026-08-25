import { useState } from "react";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";
import { useCredentialTypes, useReferenceByIds } from "../api/useReferenceData";
import { CredentialFilterMenu } from "./CredentialFilterMenu";

interface CredentialTypeFilterMenuProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function CredentialTypeFilterMenu({ value, onChange }: CredentialTypeFilterMenuProps) {
  const [query, setQuery] = useState("");
  const list = useCredentialTypes({ search: useDebouncedValue(query.trim(), 300) });
  // The selection is not in `options` once a search narrows the page, so its
  // name comes from a by-id lookup rather than from the loaded rows.
  const selected = useReferenceByIds("credential-types", value ? [value] : []);

  return (
    <CredentialFilterMenu
      labelKey="cred.filter.type"
      allLabelKey="cred.filter.typeAll"
      value={value}
      onChange={onChange}
      options={list.items}
      searchValue={query}
      onSearchChange={setQuery}
      hasMore={list.hasMore}
      onLoadMore={list.loadMore}
      isFetchingNextPage={list.isFetchingNextPage}
      selectedName={selected.data?.[0]?.name}
    />
  );
}
