import { useTranslation } from "react-i18next";
import { BackLink } from "@shared/components/BackLink";
import { PageHeader } from "@shared/components/PageHeader";
import { useDebouncedSearchParam } from "@shared/hooks/useSearchParam";
import { Card } from "@ui/card";
import { useUserUnits } from "@shared/api/useUserUnits";
import { UserUnitTree } from "./components/UserUnitTree";

export function UserUnitsPage() {
  const { t } = useTranslation();
  const { input, setInput, search } = useDebouncedSearchParam();
  const list = useUserUnits(search);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <BackLink />
      <PageHeader title={t("userUnit.title")} description={t("userUnit.description")} />

      <Card className="p-0">
        <UserUnitTree
          units={list.data ?? []}
          isLoading={list.isLoading}
          searchValue={input}
          onSearchChange={setInput}
          searchActive={search.length > 0}
        />
      </Card>
    </div>
  );
}
