import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUserSelf } from "@feature/user/api/useUserSelf";
import { useStore } from "@app/store";
import { configureAuthHandler, configureLocaleResolver } from "@shared/api/client";
import { FullPageSpinner } from "@shared/components/LoadingSpinner";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "@app/router";

// Routes accessible without auth — visiting them should NOT trigger a redirect
// when the session probe (GET /users/self) returns 401.
const PUBLIC_PATHS = ["/", "/login", "/help", "/about"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/credentials/verify")) return true;
  return false;
}

export function SessionHydrator({ children }: { children: React.ReactNode }) {
  const setUser = useStore((s) => s.setUser);
  const clearUser = useStore((s) => s.clearUser);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const locale = useStore((s) => s.locale);
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();

  // Wire axios interceptor handlers
  useEffect(() => {
    configureAuthHandler(() => {
      clearUser();
      queryClient.clear();
      // Don't navigate if already on a public route — the page should just
      // render without auth. Prevents the refresh loop on landing/login.
      const currentPath = window.location.pathname;
      if (isPublicPath(currentPath)) return;
      // Use the router instead of window.location to avoid a full page reload.
      void router.navigate("/login", { replace: true });
    });
    configureLocaleResolver(() => locale);
  }, [clearUser, locale, queryClient]);

  // Sync i18n language with stored locale on mount and locale change
  useEffect(() => {
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  const { data, isLoading } = useUserSelf({ enabled: isAuthenticated });

  useEffect(() => {
    if (data && isAuthenticated) setUser(data);
  }, [data, isAuthenticated, setUser]);

  // Only gate rendering on the probe if we have a persisted session.
  // First-time visitors (isAuthenticated=false) go straight through — no spinner.
  if (isAuthenticated && isLoading) {
    return <FullPageSpinner />;
  }

  return <>{children}</>;
}
