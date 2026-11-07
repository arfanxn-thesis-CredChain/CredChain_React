import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Menu, Search, User, Mail, LogOut, HelpCircle, Info } from "lucide-react";
import { useStore } from "@app/store";
import { ROLE_LABEL_KEY } from "@shared/auth/role";
import { UserAvatar } from "@shared/components/UserAvatar";
import { useLogout } from "@feature/auth/api/useLogout";
import { useConfirm } from "@ui/confirm-dialog";
import { useNavSearch } from "@shared/hooks/useNavSearch";
import { LanguageSwitcher } from "@shared/components/LanguageSwitcher";
import { useNotificationUnreadCount } from "@shared/api/useNotifications";
import { cn } from "@shared/lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";

interface NavbarOverviewProps {
  onMenuClick: () => void;
}

export function NavbarOverview({ onMenuClick }: NavbarOverviewProps) {
  const user = useStore((s) => s.user);
  const setLocale = useStore((s) => s.setLocale);
  const currentLocale = useStore((s) => s.locale);
  const logout = useLogout();
  const { t, i18n } = useTranslation();
  const { confirm, dialog } = useConfirm();
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const searchResults = useNavSearch(searchQuery);
  const showDropdown = searchQuery.length > 0;
  const { data: unreadCount } = useNotificationUnreadCount();

  const hasUnread = typeof unreadCount === "number" && unreadCount > 0;
  const unreadLabel = hasUnread
    ? t("notifications.unreadAria", { count: unreadCount })
    : t("notifications.bellAria");

  const handleLogout = async () => {
    const ok = await confirm({
      title: t("auth.logout.confirm.title"),
      description: t("auth.logout.confirm.body"),
      confirmLabel: t("auth.logout.confirm.action"),
      cancelLabel: t("common.cancel"),
      tone: "destructive",
    });
    if (ok) logout.mutate();
  };

  const changeLocale = (lng: "en" | "id") => {
    void i18n.changeLanguage(lng);
    setLocale(lng);
  };

  return (
    <>
      <header className="no-print relative z-10 bg-navy sm:bg-transparent">
        <div className="safe-area-top" aria-hidden="true" />
        <div className="mx-auto flex min-h-[64px] max-w-7xl items-center justify-between px-4 shadow-md sm:shadow-none">
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="p-1 text-surface transition-colors hover:text-gold sm:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative hidden md:flex">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  role="searchbox"
                  className="block w-64 rounded-full border border-gray-200 bg-gray-50 py-2 pr-3 pl-10 text-sm text-navy placeholder-gray-400 shadow-sm transition-colors focus:border-transparent focus:bg-white focus:ring-2 focus:ring-gold focus:outline-none"
                  placeholder={t("nav.searchPlaceholder")}
                  aria-label="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setSearchQuery("");
                    if (e.key === "Enter" && searchResults.length > 0) {
                      navigate(searchResults[0].href);
                      setSearchQuery("");
                    }
                  }}
                  onBlur={() => setTimeout(() => setSearchQuery(""), 150)}
                />
                {showDropdown && searchResults.length > 0 && (
                  <div
                    role="menu"
                    className="absolute top-full right-0 left-0 z-50 mt-1 w-64 overflow-hidden rounded-xl border border-gray-100 bg-popover p-1 text-popover-foreground shadow-xl shadow-navy/20"
                  >
                    {searchResults.map((item) => (
                      <button
                        key={item.href}
                        type="button"
                        role="menuitem"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          navigate(item.href);
                          setSearchQuery("");
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-navy/5 focus:bg-accent focus:outline-none"
                      >
                        <item.icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        {t(item.i18nKey)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden md:block">
                <LanguageSwitcher />
              </div>

              {user && (
                <Link
                  to="/notifications"
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-2 text-surface transition-colors hover:text-gold focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none sm:h-10 sm:w-10 sm:text-navy sm:hover:text-gold"
                  aria-label={unreadLabel}
                >
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  {hasUnread && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1 right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-navy shadow-sm ring-2 ring-navy sm:ring-surface"
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="group flex items-center gap-3 rounded-xl p-1 focus-visible:[outline:none]"
                    aria-label="User menu"
                  >
                    <div className="hidden text-right sm:block">
                      <div className="text-sm font-semibold text-surface lg:text-navy">
                        {user?.name?.split(" ")[0] ?? user?.email?.split("@")[0]}
                      </div>
                      <div className="text-xs text-gray-300 capitalize lg:text-gray-500">
                        {user?.role ? t(ROLE_LABEL_KEY[user.role]) : ""}
                      </div>
                    </div>
                    {user && (
                      <UserAvatar
                        user={user}
                        size="md"
                        className="ring-2 ring-surface transition-shadow group-focus-visible:ring-gold sm:ring-gray-200"
                      />
                    )}
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel inset>
                    <div className="truncate font-bold tracking-normal text-navy normal-case">
                      {user?.name ?? "Account"}
                    </div>
                    <div className="truncate text-xs font-normal tracking-normal text-gray-400 normal-case">
                      {user?.email}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/account/profile" className="flex cursor-pointer items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      {t("nav.profile")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account/email" className="flex cursor-pointer items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      {t("user.email.update.title")}
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/help" className="flex cursor-pointer items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      {t("nav.help")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/about" className="flex cursor-pointer items-center gap-2">
                      <Info className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      {t("nav.about")}
                    </Link>
                  </DropdownMenuItem>

                  <div className="md:hidden">
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel
                      inset
                      className="text-xs font-bold tracking-wider text-gray-400 uppercase"
                    >
                      {t("settings.language.heading")}
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        changeLocale("en");
                      }}
                      className="cursor-pointer"
                    >
                      <span className={cn("flex-1", currentLocale === "en" && "font-bold")}>
                        English
                      </span>
                      <span className="font-mono text-xs text-gray-400">EN</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        changeLocale("id");
                      }}
                      className="cursor-pointer"
                    >
                      <span className={cn("flex-1", currentLocale === "id" && "font-bold")}>
                        Bahasa Indonesia
                      </span>
                      <span className="font-mono text-xs text-gray-400">ID</span>
                    </DropdownMenuItem>
                  </div>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    destructive
                    onClick={handleLogout}
                    disabled={logout.isPending}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    {logout.isPending
                      ? t("auth.logout.signingOut")
                      : t("auth.logout.confirm.action")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      {dialog}
    </>
  );
}
