import { useTranslation } from "react-i18next";
import { PageHeader } from "@shared/components/PageHeader";
import { Card } from "@ui/card";
import { useUserUnits } from "./api/useUserUnits";
import { UserUnitTree } from "./components/UserUnitTree";

export function UserUnitsPage() {
  const { t } = useTranslation();
  const list = useUserUnits();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title={t("userUnit.title")} description={t("userUnit.description")} />

      <Card className="p-0">
        <UserUnitTree units={list.data ?? []} isLoading={list.isLoading} />
      </Card>
    </div>
  );
}
