import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CalendarClock, Clock, Mail } from "lucide-react";
import { useStore } from "@app/store";
import { canEditUser } from "@shared/auth/role";
import { BackLink } from "@shared/components/BackLink";
import { PageHeader } from "@shared/components/PageHeader";
import { Card } from "@ui/card";
import { Button } from "@ui/button";
import { Input } from "@ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select";
import { UserAvatar } from "@shared/components/UserAvatar";
import { MonoId } from "@shared/components/MonoId";
import { DecorBlob } from "@shared/components/DecorBlob";
import { CopyInlineButton } from "@shared/components/CopyInlineButton";
import { UserRoleBadge } from "@shared/components/UserRoleBadge";
import { DetailEditForm, type DetailField } from "@shared/components/DetailEditForm";
import { DetailRow } from "@shared/components/DetailRow";
import { UnitPicker } from "@shared/components/UnitPicker";
import { useUserUnits } from "@shared/api/useUserUnits";
import { formatDateTime } from "@shared/lib/format";
import { pathSegments, UNIT_PATH_SEPARATOR } from "@shared/lib/units";
import { MetaDisplay } from "@shared/components/MetaDisplay";
import { MetaEditor } from "@shared/components/MetaEditor";
import { metaEqual, mergeMeta, splitMeta } from "@shared/lib/meta";
import type { UserDTO } from "@shared/types/api";
import { useUpdateUsers } from "./api/useUpdateUsers";
import {
  userSelfProfileSchema,
  type UserSelfProfileInput,
  type UserUpdateInput,
} from "./schemas/user";

function profileDefaults(user: UserDTO): UserSelfProfileInput {
  return {
    name: user.name ?? "",
    number: user.number ?? "",
    unit_id: user.unit_id ?? undefined,
    joined_year: user.joined_year ?? undefined,
    birth_date: user.birth_date?.slice(0, 10) ?? undefined,
    gender: user.gender ?? null,
    meta_entries: splitMeta(user.meta).entries,
  };
}

export function UserSelfProfile() {
  const { t, i18n } = useTranslation();
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const canEdit = !!user && !user.deleted_at && canEditUser(user, user);
  const update = useUpdateUsers();
  const { data: units } = useUserUnits();
  const unitsById = useMemo(() => new Map((units ?? []).map((unit) => [unit.id, unit])), [units]);
  const form = useForm<UserSelfProfileInput>({
    resolver: zodResolver(userSelfProfileSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      number: "",
      unit_id: undefined,
      joined_year: undefined,
      birth_date: undefined,
      gender: null,
      meta_entries: [],
    },
  });
  const { reset } = form;
  const unitId = useWatch({ control: form.control, name: "unit_id" });
  const gender = useWatch({ control: form.control, name: "gender" });

  useEffect(() => {
    if (user) reset(profileDefaults(user));
  }, [user, reset]);

  const handleSave = async (): Promise<boolean> => {
    if (!user || !canEdit) return false;
    if (!(await form.trigger())) return false;
    const data = form.getValues();
    const payload: UserUpdateInput = { id: user.id };

    if (data.name !== user.name) payload.name = data.name;
    if (data.number !== (user.number ?? "")) payload.number = data.number;
    if ((data.unit_id ?? undefined) !== (user.unit_id ?? undefined)) {
      if (!data.unit_id) {
        form.setError("unit_id", { type: "manual", message: "profile.field.cannotClear" });
        return false;
      }
      payload.unit_id = data.unit_id;
    }
    const joinedYear = Number.isNaN(data.joined_year) ? undefined : data.joined_year;
    if ((joinedYear ?? undefined) !== (user.joined_year ?? undefined)) {
      if (joinedYear == null) {
        form.setError("joined_year", { type: "manual", message: "profile.field.cannotClear" });
        return false;
      }
      payload.joined_year = joinedYear;
    }
    if (data.birth_date !== (user.birth_date?.slice(0, 10) ?? undefined)) {
      if (!data.birth_date) {
        form.setError("birth_date", { type: "manual", message: "profile.field.cannotClear" });
        return false;
      }
      payload.birth_date = data.birth_date;
    }
    if (data.gender !== user.gender) {
      if (!data.gender) {
        form.setError("gender", { type: "manual", message: "profile.field.cannotClear" });
        return false;
      }
      payload.gender = data.gender;
    }
    const mergedMeta = mergeMeta(data.meta_entries ?? [], splitMeta(user.meta).preserved);
    if (!metaEqual(mergedMeta, user.meta)) payload.meta = mergedMeta ?? {};
    if (Object.keys(payload).length === 1) return true;

    try {
      const updated = await update.mutateAsync({ users: [payload] });
      const self = updated.find((entry) => entry.id === user.id);
      if (self) setUser(self);
      return true;
    } catch {
      return false;
    }
  };

  const empty = t("profile.empty");
  const emailText = user?.email ?? empty;
  const unit = user?.unit_id ? unitsById.get(user.unit_id) : undefined;
  const unitText = unit
    ? pathSegments(unit, unitsById).join(` ${UNIT_PATH_SEPARATOR} `)
    : (user?.unit_id ?? empty);
  const birthDateText = (() => {
    if (!user?.birth_date) return empty;
    const date = new Date(user.birth_date);
    if (isNaN(date.getTime())) return empty;
    try {
      return new Intl.DateTimeFormat(i18n.language, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
    } catch {
      return user.birth_date.slice(0, 10);
    }
  })();

  const fields: DetailField[] = user
    ? [
        {
          key: "name",
          label: t("user.edit.fullName"),
          readValue: user.name ?? empty,
          editControl: <Input aria-label={t("user.edit.fullName")} {...form.register("name")} />,
          error: form.formState.errors.name?.message,
        },
        {
          key: "number",
          label: t("profile.field.number"),
          readValue: user.number ? (
            <span className="inline-flex items-center gap-2">
              {user.number}
              <CopyInlineButton value={user.number} ariaLabel={t("profile.number.copy")} />
            </span>
          ) : (
            empty
          ),
          editControl: (
            <Input aria-label={t("profile.field.number")} {...form.register("number")} />
          ),
          error: form.formState.errors.number?.message,
        },
        {
          key: "unit_id",
          label: t("user.field.unit"),
          readValue: unitText,
          editControl: (
            <UnitPicker
              value={unitId}
              onChange={(value) =>
                form.setValue("unit_id", value, { shouldValidate: true, shouldDirty: true })
              }
              label={t("user.field.unit")}
              error={form.formState.errors.unit_id?.message}
            />
          ),
          error: form.formState.errors.unit_id?.message,
        },
        {
          key: "joined_year",
          label: t("user.field.joinedYear"),
          readValue: user.joined_year ?? empty,
          editControl: (
            <Input
              type="number"
              aria-label={t("user.field.joinedYear")}
              {...form.register("joined_year", { valueAsNumber: true })}
            />
          ),
          error: form.formState.errors.joined_year?.message,
        },
        {
          key: "birth_date",
          label: t("profile.field.birthDate"),
          readValue: birthDateText,
          editControl: (
            <Input
              type="date"
              aria-label={t("profile.field.birthDate")}
              {...form.register("birth_date")}
            />
          ),
          error: form.formState.errors.birth_date?.message,
        },
        {
          key: "gender",
          label: t("profile.field.gender"),
          readValue: user.gender ? t(`user.field.gender.${user.gender}`) : empty,
          editControl: (
            <Select
              value={gender ?? "__none__"}
              onValueChange={(value) =>
                form.setValue(
                  "gender",
                  value === "__none__" ? null : (value as "male" | "female"),
                  {
                    shouldValidate: true,
                    shouldDirty: true,
                  },
                )
              }
            >
              <SelectTrigger aria-label={t("profile.field.gender")}>
                <SelectValue placeholder={t("user.field.gender.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {!user.gender && <SelectItem value="__none__">{t("common.notSet")}</SelectItem>}
                <SelectItem value="male">{t("user.field.gender.male")}</SelectItem>
                <SelectItem value="female">{t("user.field.gender.female")}</SelectItem>
              </SelectContent>
            </Select>
          ),
          error: form.formState.errors.gender?.message,
        },
        {
          key: "meta_entries",
          label: t("meta.label"),
          readValue:
            user.meta && Object.keys(user.meta).length > 0 ? (
              <MetaDisplay meta={user.meta} />
            ) : (
              empty
            ),
          editControl: <MetaEditor control={form.control} />,
          error: form.formState.errors.meta_entries?.message,
          fullWidth: true,
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackLink />
      <PageHeader title={t("profile.title")} description={t("profile.description")} />

      <Card className="relative overflow-hidden p-6 shadow-lg ring-1 shadow-gold/20 ring-gold/10 sm:p-8">
        <DecorBlob tone="gold" position="top-right" size="lg" />
        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          <UserAvatar user={user} size="xl" />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h2 className="font-display text-2xl font-bold tracking-tight text-navy">
                {user?.name ?? empty}
              </h2>
              {user?.role && <UserRoleBadge role={user.role} />}
            </div>
            <div className="flex items-center justify-center gap-1">
              <p className="text-sm break-all text-gray-500">{emailText}</p>
              {user?.email && (
                <CopyInlineButton value={user.email} ariaLabel={t("user.copy.email")} />
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <DetailEditForm
          title={t("profile.identity.heading")}
          fields={fields}
          canEdit={canEdit}
          onSave={handleSave}
          onCancel={() => {
            if (user) reset(profileDefaults(user));
          }}
          isSaving={update.isPending}
        />
        <div className="mt-6 border-t border-gray-100 pt-6">
          <p className="mb-1 text-xs font-bold tracking-wider text-gray-400 uppercase">
            {t("profile.field.wallet")}
          </p>
          <div className="flex items-center gap-2">
            {user?.wallet_address ? (
              <>
                <MonoId value={user.wallet_address} mode="address" className="text-sm text-navy" />
                <CopyInlineButton
                  value={user.wallet_address}
                  ariaLabel={t("profile.wallet.copy")}
                />
              </>
            ) : (
              <span className="text-sm text-gray-400 italic">{empty}</span>
            )}
          </div>
        </div>
        {user && (
          <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-gray-100 pt-6 sm:grid-cols-2">
            <DetailRow
              icon={Clock}
              label={t("user.detail.created")}
              value={formatDateTime(user.created_at, i18n.language)}
            />
            <DetailRow
              icon={CalendarClock}
              label={t("user.detail.updated")}
              value={formatDateTime(user.updated_at, i18n.language)}
            />
          </dl>
        )}
        {!canEdit && <p className="mt-6 text-xs text-gray-400">{t("profile.identity.note")}</p>}
      </Card>

      <Card className="p-6 sm:p-8">
        <h3 className="mb-4 text-xs font-bold tracking-wider text-gray-400 uppercase">
          {t("profile.account.heading")}
        </h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-navy">{t("profile.field.email")}</p>
            <p className="text-sm break-all text-gray-500">{emailText}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/account/email" className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4" aria-hidden="true" />
              {t("profile.updateEmail")}
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
