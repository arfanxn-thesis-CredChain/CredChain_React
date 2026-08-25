import { useState } from "react";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";
import { useCompetencies, useReferenceByIds } from "../api/useReferenceData";
import { CredentialFilterMenu } from "./CredentialFilterMenu";

interface CredentialCompetencyFilterMenuProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function CredentialCompetencyFilterMenu({
  value,
  onChange,
}: CredentialCompetencyFilterMenuProps) {
  const [query, setQuery] = useState("");
  const list = useCompetencies({ search: useDebouncedValue(query.trim(), 300) });
  const selected = useReferenceByIds("competencies", value ? [value] : []);

  return (
    <CredentialFilterMenu
      labelKey="cred.filter.competency"
      allLabelKey="cred.filter.competencyAll"
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
