import { Languages } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { userKeys } from "@feature/user/api/keys";
import type { UserDTO } from "@shared/types/api";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { useTranslation } from "react-i18next";
import { useStore } from "@app/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";
import { cn } from "@shared/lib/cn";

const LOCALES = [
  { code: "en" as const, label: "English", short: "EN" },
  { code: "id" as const, label: "Bahasa Indonesia", short: "ID" },
];

interface LanguageSwitcherProps {
  variant?: "dark" | "light";
}

export function LanguageSwitcher({ variant = "light" }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const setLocale = useStore((s) => s.setLocale);
  const currentLocale = useStore((s) => s.locale);
  const languageSavePending = useStore((s) => s.languageSavePending);
  const setLanguageSavePending = useStore((s) => s.setLanguageSavePending);

  const change = async (lng: "en" | "id") => {
    const state = useStore.getState();
    if (lng === state.locale || state.languageSavePending) return;
    const previous = state.locale;
    setLocale(lng);
    void i18n.changeLanguage(lng);
    if (!state.isAuthenticated || !state.user) return;

    const accountId = state.user.id;
    setLanguageSavePending(true);
    try {
      await queryClient.cancelQueries({ queryKey: userKeys.self() });
      const response = await api.put<{ language: "en" | "id" }>("/users/self/language", {
        language: lng,
      });
      const latest = useStore.getState();
      if (latest.isAuthenticated && latest.user?.id === accountId) {
        const updated = { ...latest.user, language: response.data.language };
        queryClient.setQueryData<UserDTO>(userKeys.self(), updated);
        useStore.setState({ user: updated, locale: updated.language });
      }
    } catch {
      const latest = useStore.getState();
      if (latest.isAuthenticated && latest.user?.id === accountId) {
        queryClient.setQueryData<UserDTO>(userKeys.self(), latest.user);
        setLocale(previous);
        void i18n.changeLanguage(previous);
        notify.error("language.saveFailed");
      }
    } finally {
      setLanguageSavePending(false);
    }
  };

  const triggerColor =
    variant === "dark" ? "text-surface hover:text-gold" : "text-navy hover:text-gold";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-semibold transition-colors",
          "rounded-md p-1 focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
          triggerColor,
        )}
        aria-label="Change language"
      >
        <Languages className="h-4 w-4" aria-hidden="true" />
        {LOCALES.find((l) => l.code === currentLocale)?.short ?? "EN"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            onClick={() => void change(locale.code)}
            disabled={languageSavePending}
            className={cn(
              "flex cursor-pointer items-center justify-between",
              currentLocale === locale.code && "font-bold",
            )}
          >
            {locale.label}
            <span className="font-mono text-xs text-gray-400">{locale.short}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
