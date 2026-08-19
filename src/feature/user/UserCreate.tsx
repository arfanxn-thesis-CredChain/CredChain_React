import { useState, useCallback } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileUp, Plus, Save } from "lucide-react";

import { BackLink } from "@shared/components/BackLink";
import { PageHeader } from "@shared/components/PageHeader";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { useConfirm } from "@ui/confirm-dialog";

import { useCreateUsers } from "./api/useCreateUsers";
import {
  type UserBatchStoreFormInput,
  type UserStoreFormInput,
  defaultUserStoreFormRow,
  userBatchStoreFormSchema,
} from "./schemas/user";
import { mergeMeta } from "@shared/lib/meta";
import { UserCreateRow } from "./components/UserCreateRow";
import { UserImportModal } from "./components/UserImportModal";

export function UserCreate() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { confirm, dialog } = useConfirm();
  const [importModalOpen, setImportModalOpen] = useState(false);

  const form = useForm<UserBatchStoreFormInput>({
    resolver: zodResolver(userBatchStoreFormSchema),
    defaultValues: { users: [defaultUserStoreFormRow()] },
    mode: "onBlur",
  });

  const createUsers = useCreateUsers(form);
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "users",
  });

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      users: data.users.map(({ meta_entries, ...row }) => ({
        ...row,
        meta: mergeMeta(meta_entries ?? [], {}),
      })),
    };
    createUsers.mutate(payload, {
      onSuccess: () => navigate("/users"),
    });
  });

  const hasExistingData = useCallback(() => {
    const users = form.getValues("users");
    return users.some(
      (u) =>
        u.name.trim() !== "" ||
        u.email.trim() !== "" ||
        (u.number?.trim() ?? "") !== "" ||
        (u.birth_date?.trim() ?? "") !== "" ||
        (u.gender?.trim() ?? "") !== "" ||
        (u.meta_entries?.some((m) => m.key.trim() !== "" || m.value.trim() !== "") ?? false),
    );
  }, [form]);

  const handleImportClick = useCallback(async () => {
    if (hasExistingData()) {
      const confirmed = await confirm({
        title: t("userImport.confirm.replace.title"),
        description: t("userImport.confirm.replace.description"),
      });
      if (!confirmed) return;
    }
    setImportModalOpen(true);
  }, [hasExistingData, confirm, t]);

  const handleImport = useCallback(
    (rows: UserStoreFormInput[]) => {
      form.setValue("users", rows, { shouldValidate: true });
      setImportModalOpen(false);
    },
    [form],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink />

      <PageHeader
        title={t("userCreate.title")}
        description={t("userCreate.description")}
        action={
          <Button variant="outline" onClick={handleImportClick}>
            <FileUp className="h-4 w-4" />
            {t("userCreate.importCta")}
          </Button>
        }
      />

      <Card className="p-0">
        <form onSubmit={onSubmit} className="space-y-8 p-6 sm:p-8">
          <div className="space-y-6">
            {fields.map((field, index) => (
              <UserCreateRow
                key={field.id}
                index={index}
                form={form}
                onRemove={fields.length > 1 ? () => remove(index) : undefined}
              />
            ))}
          </div>

          <div className="flex flex-col items-stretch justify-between gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="dashed"
              onClick={() => append(defaultUserStoreFormRow())}
              disabled={fields.length >= 100}
            >
              <Plus className="h-4 w-4" />
              {t("userCreate.addAnother")}
            </Button>

            <Button type="submit" variant="primary" size="lg" disabled={createUsers.isPending}>
              <Save className="h-5 w-5" />
              {createUsers.isPending ? t("userCreate.submitting") : t("userCreate.submit")}
            </Button>
          </div>
        </form>
      </Card>

      <UserImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImport}
      />
      {dialog}
    </div>
  );
}
