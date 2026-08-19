import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Phone, Save, Mail } from "lucide-react";
import { useStore } from "@app/store";
import { BackLink } from "@shared/components/BackLink";
import { PageHeader } from "@shared/components/PageHeader";
import { Card } from "@ui/card";
import { Button } from "@ui/button";
import { Input } from "@ui/input";
import { Label } from "@ui/label";
import { UserAvatar } from "@shared/components/UserAvatar";
import { EyebrowLabel } from "@shared/components/EyebrowLabel";
import { MonoId } from "@shared/components/MonoId";
import { DecorBlob } from "@shared/components/DecorBlob";
import { cn } from "@shared/lib/cn";
import { CopyInlineButton } from "@shared/components/CopyInlineButton";
import { UserRoleBadge } from "@shared/components/UserRoleBadge";
import { useUpdateSelfProfile } from "./api/useUpdateSelfProfile";
import { userSelfProfileSchema, type UserSelfProfileInput } from "./schemas/user";

export function UserSelfProfile() {
  const { t, i18n } = useTranslation();
  const user = useStore((s) => s.user);

  const form = useForm<UserSelfProfileInput>({
    resolver: zodResolver(userSelfProfileSchema),
    mode: "onBlur",
    defaultValues: { phone_number: undefined },
  });

  const update = useUpdateSelfProfile(form);

  useEffect(() => {
    if (user) {
      const phoneNumber = (user as { phone_number?: string | null }).phone_number;
      form.reset({ phone_number: phoneNumber ?? undefined });
    }
  }, [user, form]);

  const onSubmit = form.handleSubmit((data) => update.mutate(data));
  const phoneError = form.formState.errors.phone_number?.message;

  const formatBirthDate = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    try {
      return new Intl.DateTimeFormat(i18n.language, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(d);
    } catch {
      return iso.slice(0, 10);
    }
  };

  const empty = t("profile.empty");
  const birthDateText = formatBirthDate(user?.birth_date) ?? empty;
  const numberText = user?.number ?? empty;
  const emailText = user?.email ?? empty;

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
        <EyebrowLabel className="mb-4">{t("profile.identity.heading")}</EyebrowLabel>
        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <dt className="mb-1 text-xs font-bold tracking-wider text-gray-400 uppercase">
              {t("profile.field.number")}
            </dt>
            <dd className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm font-bold",
                  user?.number ? "text-navy" : "font-normal text-gray-400 italic",
                )}
              >
                {numberText}
              </span>
              {user?.number && (
                <CopyInlineButton value={user.number} ariaLabel={t("profile.number.copy")} />
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-bold tracking-wider text-gray-400 uppercase">
              {t("profile.field.birthDate")}
            </dt>
            <dd
              className={cn(
                "text-sm font-bold",
                user?.birth_date ? "text-navy" : "font-normal text-gray-400 italic",
              )}
            >
              {birthDateText}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-bold tracking-wider text-gray-400 uppercase">
              {t("profile.field.gender")}
            </dt>
            <dd
              className={cn(
                "text-sm font-bold",
                user?.gender ? "text-navy" : "font-normal text-gray-400 italic",
              )}
            >
              {user?.gender ? t(`user.field.gender.${user.gender}`) : empty}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-bold tracking-wider text-gray-400 uppercase">
              {t("profile.field.wallet")}
            </dt>
            <dd className="flex items-center gap-2">
              {user?.wallet_address ? (
                <MonoId value={user.wallet_address} mode="address" className="text-sm text-navy" />
              ) : (
                <span className="text-sm text-gray-400 italic">{empty}</span>
              )}
              {user?.wallet_address && (
                <CopyInlineButton
                  value={user.wallet_address}
                  ariaLabel={t("profile.wallet.copy")}
                />
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-6 text-xs text-gray-400">{t("profile.identity.note")}</p>
      </Card>

      <Card className="p-6 sm:p-8">
        <EyebrowLabel className="mb-4">{t("profile.contact.heading")}</EyebrowLabel>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="phone_number">{t("profile.field.phone")}</Label>
            <Input
              id="phone_number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              leadingIcon={Phone}
              placeholder={t("profile.phone.placeholder")}
              {...form.register("phone_number")}
            />
            {phoneError ? (
              <p className="mt-1 text-xs text-error" role="alert">
                {t(phoneError)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">{t("profile.phone.hint")}</p>
            )}
          </div>
          <div className="flex justify-end border-t border-gray-100 pt-4">
            <Button
              type="submit"
              variant="primary"
              disabled={update.isPending || !form.formState.isDirty}
            >
              <Save className="h-4 w-4" />
              {update.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6 sm:p-8">
        <EyebrowLabel className="mb-4">{t("profile.account.heading")}</EyebrowLabel>
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
