import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  Briefcase,
  Calendar,
  CalendarClock,
  ChevronDown,
  Hash,
  Mail,
  Trash2,
  User,
} from "lucide-react";

import { Button } from "@ui/button";
import { Input } from "@ui/input";
import { FormField } from "@ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select";
import { Role, canAccess } from "@shared/auth/role";
import { useStore } from "@app/store";
import { cn } from "@shared/lib/cn";

import type { UserBatchStoreFormInput } from "../schemas/user";
import { UnitPicker } from "@shared/components/UnitPicker";
import { MetaEditor } from "@shared/components/MetaEditor";

interface UserCreateRowProps {
  index: number;
  form: UseFormReturn<UserBatchStoreFormInput>;
  onRemove?: () => void;
}

export function UserCreateRow({ index, form, onRemove }: UserCreateRowProps) {
  const { t } = useTranslation();
  const errors = form.formState.errors.users?.[index];
  const role = form.watch(`users.${index}.role`);
  const gender = form.watch(`users.${index}.gender`);
  const unitId = form.watch(`users.${index}.unit_id`);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const currentUser = useStore((s) => s.user);
  const canPromoteToAdmin = canAccess(currentUser?.role, Role.SUPER_ADMIN);

  const roleOptions = [
    { value: Role.HOLDER, label: t("user.edit.role.holder") },
    { value: Role.ISSUER, label: t("user.edit.role.issuer") },
    { value: Role.ADMIN, label: t("user.edit.role.admin") },
  ];

  return (
    <div className="relative flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-all focus-within:border-gold/50 focus-within:bg-white sm:gap-6 sm:p-6">
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="absolute top-3 right-3 h-8 w-8 text-gray-400 hover:bg-error/10 hover:text-error sm:top-4 sm:right-4 sm:h-9 sm:w-9"
          aria-label={t("userCreate.removeAriaLabel", { n: index + 1 })}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      <div className="grid w-full grid-cols-1 gap-4 pr-12 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        <FormField label={t("user.edit.fullName")} error={errors?.name?.message}>
          <Input
            leadingIcon={User}
            placeholder={t("userCreate.field.name.placeholder")}
            autoComplete="name"
            {...form.register(`users.${index}.name`)}
          />
        </FormField>

        <FormField label={t("user.edit.email")} error={errors?.email?.message}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            leadingIcon={Mail}
            placeholder={t("userCreate.field.email.placeholder")}
            {...form.register(`users.${index}.email`)}
          />
        </FormField>

        <FormField label={t("user.field.unit")} error={errors?.unit_id?.message} optional>
          <UnitPicker
            value={unitId}
            onChange={(value) =>
              form.setValue(`users.${index}.unit_id`, value, { shouldValidate: true })
            }
            label={t("user.field.unit")}
            placeholder={t("userCreate.field.unit.placeholder")}
            error={errors?.unit_id?.message}
          />
        </FormField>

        <FormField label={t("user.field.joinedYear")} error={errors?.joined_year?.message} optional>
          <Input
            type="number"
            inputMode="numeric"
            leadingIcon={CalendarClock}
            placeholder={t("userCreate.field.joinedYear.placeholder")}
            {...form.register(`users.${index}.joined_year`, {
              valueAsNumber: true,
            })}
          />
        </FormField>

        <FormField
          label={t("user.edit.numberId")}
          hint={t("userCreate.field.number.hint")}
          error={errors?.number?.message}
          optional
        >
          <Input
            leadingIcon={Hash}
            placeholder={t("userCreate.field.number.placeholder")}
            {...form.register(`users.${index}.number`)}
          />
        </FormField>

        <FormField label={t("user.edit.birthDate")} error={errors?.birth_date?.message} optional>
          <Input
            type="date"
            leadingIcon={Calendar}
            {...form.register(`users.${index}.birth_date`)}
          />
        </FormField>

        <FormField label={t("user.field.gender")} error={errors?.gender?.message} optional>
          <Select
            value={gender ?? "__none__"}
            onValueChange={(value) => {
              form.setValue(
                `users.${index}.gender`,
                value === "__none__" ? undefined : (value as "male" | "female"),
                { shouldValidate: true },
              );
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("user.field.gender.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t("common.notSet")}</SelectItem>
              <SelectItem value="male">{t("user.field.gender.male")}</SelectItem>
              <SelectItem value="female">{t("user.field.gender.female")}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label={t("user.edit.role")} error={errors?.role?.message}>
          <Select
            value={role}
            onValueChange={(value) => {
              if (value === Role.HOLDER || value === Role.ISSUER || value === Role.ADMIN) {
                form.setValue(`users.${index}.role`, value, {
                  shouldValidate: true,
                });
              }
            }}
          >
            <SelectTrigger>
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-gray-400" aria-hidden="true" />
                <SelectValue placeholder={t("user.edit.role.placeholder")} />
              </div>
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.value === Role.ADMIN && !canPromoteToAdmin}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!canPromoteToAdmin && (
            <p className="mt-1 text-xs text-gray-400">{t("user.edit.role.adminDisabled")}</p>
          )}
        </FormField>
      </div>

      <div className="mt-2 sm:mt-4">
        <button
          type="button"
          onClick={() => setCustomFieldsOpen(!customFieldsOpen)}
          className="flex items-center gap-1.5 py-2 text-sm font-medium text-gray-500 hover:text-navy"
        >
          {t("meta.label")}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", customFieldsOpen && "rotate-180")}
          />
        </button>
        {customFieldsOpen && (
          <div className="mt-4 ml-2">
            <MetaEditor control={form.control} name={`users.${index}.meta_entries`} />
          </div>
        )}
      </div>
    </div>
  );
}
