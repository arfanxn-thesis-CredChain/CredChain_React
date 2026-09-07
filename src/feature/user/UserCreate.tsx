import { useState, useCallback } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileUp, GraduationCap, Briefcase, Plus, Save } from "lucide-react";

import { BackLink } from "@shared/components/BackLink";
import { PageHeader } from "@shared/components/PageHeader";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { useConfirm } from "@ui/confirm-dialog";
import { Role } from "@shared/auth/role";
import { cn } from "@shared/lib/cn";

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

export type UserKind = "student" | "employee";

export function UserCreate() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { confirm, dialog } = useConfirm();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [kind, setKind] = useState<UserKind | null>(null);

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

  // Employee keeps whatever role was already picked; Student has no picker so
  // any prior Issuer/Admin pick from a previous Employee choice must be reset.
  const selectKind = useCallback(
    (next: UserKind) => {
      setKind(next);
      if (next === "student") {
        form.getValues("users").forEach((_, index) => {
          form.setValue(`users.${index}.role`, Role.HOLDER);
        });
      }
    },
    [form],
  );

  const kindCards: Array<{ value: UserKind; icon: typeof GraduationCap; label: string; desc: string }> = [
    {
      value: "student",
      icon: GraduationCap,
      label: t("userCreate.kind.student"),
      desc: t("userCreate.kind.studentDesc"),
    },
    {
      value: "employee",
      icon: Briefcase,
      label: t("userCreate.kind.employee"),
      desc: t("userCreate.kind.employeeDesc"),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink onClick={step === 2 ? () => setStep(1) : undefined} />

      <PageHeader
        title={t("userCreate.title")}
        description={t("userCreate.description")}
        action={
          step === 2 ? (
            <Button variant="outline" onClick={handleImportClick}>
              <FileUp className="h-4 w-4" />
              {t("userCreate.importCta")}
            </Button>
          ) : undefined
        }
      />

      {step === 1 && (
        <Card className="space-y-6 p-6 sm:p-8">
          <p className="text-sm font-medium text-navy">{t("userCreate.kind.heading")}</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {kindCards.map((card) => {
              const Icon = card.icon;
              const selected = kind === card.value;
              return (
                <button
                  key={card.value}
                  type="button"
                  onClick={() => {
                    selectKind(card.value);
                    setStep(2);
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-3 rounded-xl border p-6 text-center transition-colors",
                    selected
                      ? "border-gold bg-gold/5 ring-2 ring-gold"
                      : "border-gray-100 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50",
                  )}
                >
                  <span
                    className={cn(
                      "rounded-full p-3",
                      selected ? "bg-gold/10 text-gold" : "bg-gray-100 text-gray-400",
                    )}
                  >
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="font-sans font-bold text-navy">{card.label}</span>
                  <span className="text-sm text-gray-500">{card.desc}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {step === 2 && kind && (
        <Card className="p-0">
          <form onSubmit={onSubmit} className="space-y-8 p-6 sm:p-8">
            <div className="space-y-6">
              {fields.map((field, index) => (
                <UserCreateRow
                  key={field.id}
                  index={index}
                  form={form}
                  kind={kind}
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
      )}

      <UserImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImport}
        kind={kind ?? undefined}
      />
      {dialog}
    </div>
  );
}
