import { useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";
import { Drawer } from "vaul";
import { X, User, Hash, Phone, Calendar, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Role, canAccess } from "@shared/auth/role";
import { useStore } from "@app/store";
import { useConfirm } from "@ui/confirm-dialog";
import { Button } from "@ui/button";
import { Input } from "@ui/input";
import { FormField } from "@ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select";
import { UserAvatar } from "@shared/components/UserAvatar";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import { setServerErrors } from "@shared/lib/forms";
import type { UserDTO } from "@shared/types/api";
import { cn } from "@shared/lib/cn";
import { useUpdateUsers } from "../api/useUpdateUsers";
import {
  userInlineEditFormSchema,
  type UserInlineEditFormInput,
  type UserUpdateInput,
} from "../schemas/user";
import { splitMeta, mergeMeta, metaEqual } from "@shared/lib/meta";
import { MetaEditor } from "@shared/components/MetaEditor";

interface UserEditDrawerProps {
  user: UserDTO | null;
  onClose: () => void;
}

export function UserEditDrawer({ user, onClose }: UserEditDrawerProps) {
  const { t } = useTranslation();
  const { confirm, dialog } = useConfirm();
  const update = useUpdateUsers();
  const isSuperAdmin = user?.role === Role.SUPER_ADMIN;
  const currentUser = useStore((s) => s.user);
  const canPromoteToAdmin = canAccess(currentUser?.role, Role.SUPER_ADMIN);

  const form = useForm<UserInlineEditFormInput>({
    resolver: zodResolver(userInlineEditFormSchema),
    mode: "onBlur",
    defaultValues: {
      id: "",
      name: "",
      role: Role.HOLDER,
      birth_date: undefined,
      gender: undefined,
      meta_entries: [],
    },
  });

  // Track dirty state explicitly — RHF's isDirty/dirtyFields are unreliable with useFieldArray after reset
  const [hasDirty, setHasDirty] = useState(false);

  useEffect(() => {
    if (user) {
      setHasDirty(false);
      const { entries } = splitMeta(user.meta);
      form.reset({
        id: user.id,
        name: user.name ?? "",
        number: user.number ?? undefined,
        phone_number:
          (user as UserDTO & { phone_number?: string | null }).phone_number ?? undefined,
        birth_date: user.birth_date ? user.birth_date.slice(0, 10) : undefined,
        gender: user.gender ?? undefined,
        email: user.email,
        role:
          user.role === Role.SUPER_ADMIN
            ? undefined
            : (user.role as "admin" | "issuer" | "holder" | undefined),
        meta_entries: entries,
      });
    }
  }, [user, form]);

  // Mark dirty on any user-initiated change
  useEffect(() => {
    const subscription = form.watch((_, { type }) => {
      if (type === "change") setHasDirty(true);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Layer 2: beforeunload guard while drawer is open and dirty
  useEffect(() => {
    if (!user || !hasDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [user, hasDirty]);

  // Layer 1: useBlocker for in-app navigation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !!user && hasDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    void (async () => {
      const ok = await confirm({
        title: t("user.edit.discard.title"),
        description: t("user.edit.discard.body", { name: user?.name ?? "user" }),
        confirmLabel: t("user.edit.discard.action"),
        cancelLabel: t("common.cancel"),
        tone: "destructive",
      });
      if (ok) {
        blocker.proceed?.();
        onClose();
        form.reset();
      } else {
        blocker.reset?.();
      }
    })();
  }, [blocker, confirm, onClose, t, user?.name, form]);

  const handleSave = form.handleSubmit(async (data) => {
    const ok = await confirm({
      title: t("user.update.confirm.title"),
      description: t("user.update.confirm.body", {
        name: user?.name ?? user?.email ?? "user",
      }),
      confirmLabel: t("user.update.confirm.action"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;

    const dirty = form.formState.dirtyFields;
    const original = user ? splitMeta(user.meta) : { entries: [], preserved: {} };
    const payload: UserUpdateInput = { id: data.id };

    if (dirty.name) payload.name = data.name;
    if (dirty.number) payload.number = data.number ?? null;
    if (dirty.phone_number) payload.phone_number = data.phone_number ?? null;
    if (dirty.birth_date) payload.birth_date = data.birth_date ?? null;
    if (dirty.gender) payload.gender = data.gender ?? null;
    if (dirty.email && !isSuperAdmin) payload.email = data.email;
    if (dirty.role && !isSuperAdmin) payload.role = data.role;
    if (dirty.meta_entries) {
      const merged = mergeMeta(data.meta_entries ?? [], original.preserved);
      if (!metaEqual(merged, user?.meta ?? null)) payload.meta = merged;
    }

    if (Object.keys(payload).length <= 1) {
      onClose();
      return;
    }

    try {
      await update.mutateAsync({ users: [payload] });
      onClose();
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) {
        setServerErrors(form, error.fieldErrors);
      } else if (isApiError(error)) {
        notify.error(error.messageKey);
      }
    }
  });

  const handleClose = async () => {
    // Deep dirty check: dirtyFields can have empty array keys after reset (useFieldArray quirk)
    const hasDirty = Object.values(form.formState.dirtyFields).some((v) => {
      if (Array.isArray(v)) return v.some((item) => item && Object.keys(item).length > 0);
      return v === true;
    });
    if (!hasDirty) {
      onClose();
      return;
    }
    const ok = await confirm({
      title: t("user.edit.discard.title"),
      description: t("user.edit.discard.body", { name: user?.name ?? "user" }),
      confirmLabel: t("user.edit.discard.action"),
      cancelLabel: t("common.cancel"),
      tone: "destructive",
    });
    if (ok) {
      onClose();
      form.reset();
    }
  };

  const errors = form.formState.errors;

  return (
    <Drawer.Root
      open={!!user}
      onOpenChange={(o) => {
        if (!o) void handleClose();
      }}
      direction="right"
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-surface shadow-2xl",
            "sm:max-w-lg md:max-w-xl",
            "focus-visible:outline-none",
          )}
        >
          <Drawer.Title className="sr-only">{t("user.edit.title")}</Drawer.Title>
          <Drawer.Description className="sr-only">{t("user.edit.fullName")}</Drawer.Description>

          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <UserAvatar user={user} size="md" />
              <div>
                <h2 className="font-bold text-navy">{user?.name ?? t("user.edit.title")}</h2>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleClose()}
              aria-label={t("user.edit.close")}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-navy focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <form className="space-y-6" onSubmit={handleSave}>
              <FormField label={t("user.edit.fullName")} error={errors.name?.message}>
                <Input leadingIcon={User} {...form.register("name")} />
              </FormField>
              <FormField label={t("user.edit.numberId")} error={errors.number?.message} optional>
                <Input leadingIcon={Hash} {...form.register("number")} />
              </FormField>
              <FormField label={t("user.edit.phone")} error={errors.phone_number?.message} optional>
                <Input type="tel" leadingIcon={Phone} {...form.register("phone_number")} />
              </FormField>
              <FormField
                label={t("user.edit.birthDate")}
                error={errors.birth_date?.message}
                optional
              >
                <Input type="date" leadingIcon={Calendar} {...form.register("birth_date")} />
              </FormField>
              <FormField label={t("user.field.gender")} error={errors.gender?.message} optional>
                <Select
                  value={form.watch("gender") ?? "__none__"}
                  onValueChange={(v) =>
                    form.setValue("gender", v === "__none__" ? null : (v as "male" | "female"), {
                      shouldDirty: true,
                    })
                  }
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
              <FormField label={t("user.edit.email")} error={errors.email?.message}>
                <Input
                  type="email"
                  leadingIcon={Mail}
                  disabled={isSuperAdmin}
                  {...form.register("email")}
                />
                {!isSuperAdmin && form.formState.dirtyFields.email && (
                  <p className="mt-1 text-xs text-warning" role="alert">
                    {t("user.email.update.warning")}
                  </p>
                )}
                {isSuperAdmin && (
                  <p className="mt-1 text-xs text-gray-400">
                    {t("user.edit.superAdmin.emailLocked")}
                  </p>
                )}
              </FormField>
              <FormField label={t("user.edit.role")} error={errors.role?.message}>
                {isSuperAdmin ? (
                  <>
                    <Input
                      disabled
                      value={t("user.role.filter.superAdmin")}
                      className="font-medium text-navy"
                      aria-readonly
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      {t("user.edit.superAdmin.roleLocked")}
                    </p>
                  </>
                ) : (
                  <>
                    <Select
                      value={form.watch("role")}
                      onValueChange={(v) =>
                        form.setValue("role", v as "admin" | "issuer" | "holder", {
                          shouldDirty: true,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("user.edit.role.placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={Role.HOLDER}>{t("user.edit.role.holder")}</SelectItem>
                        <SelectItem value={Role.ISSUER}>{t("user.edit.role.issuer")}</SelectItem>
                        <SelectItem value={Role.ADMIN} disabled={!canPromoteToAdmin}>
                          {t("user.edit.role.admin")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {!canPromoteToAdmin && (
                      <p className="mt-1 text-xs text-gray-400">
                        {t("user.edit.role.adminDisabled")}
                      </p>
                    )}
                  </>
                )}
              </FormField>
              <MetaEditor control={form.control} />
            </form>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
            <Button variant="outline" type="button" onClick={() => void handleClose()}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSave()}
              disabled={update.isPending || !form.formState.isDirty}
            >
              {update.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
      {dialog}
    </Drawer.Root>
  );
}
