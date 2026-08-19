import { Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { PublicLayout } from "@shared/components/layout/PublicLayout";
import { OverviewLayout } from "@shared/components/layout/OverviewLayout";
import { AdaptiveLayout } from "@shared/components/layout/AdaptiveLayout";
import { ProtectedRoute, PublicRoute } from "@shared/auth/guards";
import { Role } from "@shared/auth/role";
import { Login } from "@feature/auth/Login";
import { NotFound } from "@shared/components/NotFound";
import { RouteErrorBoundary } from "@shared/components/RouteErrorBoundary";
import { LoadingSpinner } from "@shared/components/LoadingSpinner";

/**
 * Lazy-load a named export from a module.
 * React Router's `lazy:` expects { Component, ErrorBoundary?, loader?, action? }.
 * This helper bridges named-export modules into that shape so the rest of the
 * codebase can keep its no-default-exports rule.
 */
function lazyRoute<T extends Record<string, React.ComponentType>>(
  importer: () => Promise<T>,
  exportName: keyof T & string,
) {
  return {
    lazy: async () => {
      const mod = await importer();
      const Component = mod[exportName] as React.ComponentType;
      const Wrapped = () => (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner size="lg" />
            </div>
          }
        >
          <Component />
        </Suspense>
      );
      return { Component: Wrapped, ErrorBoundary: RouteErrorBoundary };
    },
  };
}

export const router = createBrowserRouter([
  // Landing — self-wraps in SplitLayout
  {
    path: "/",
    ...lazyRoute(() => import("@feature/landing/Landing"), "Landing"),
  },

  // Public routes (no auth required) — uses PublicLayout chrome
  {
    element: <PublicLayout />,
    children: [
      {
        path: "/credentials/verify",
        ...lazyRoute(() => import("@feature/credential/VerifyCredential"), "VerifyCredential"),
      },
    ],
  },

  // Adaptive routes — DashboardLayout when authenticated, PublicLayout otherwise
  {
    element: <AdaptiveLayout />,
    children: [
      { path: "/help", ...lazyRoute(() => import("@feature/help/Help"), "Help") },
      { path: "/about", ...lazyRoute(() => import("@feature/about/About"), "About") },
    ],
  },

  // Auth routes (redirect if already logged in) — Login self-wraps in SplitLayout
  {
    element: <PublicRoute />,
    children: [{ path: "/login", element: <Login /> }],
  },

  // Protected routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <OverviewLayout />,
        children: [
          // Any authenticated user
          {
            path: "/overview",
            ...lazyRoute(() => import("@feature/overview/Overview"), "Overview"),
          },
          {
            path: "/credentials",
            ...lazyRoute(() => import("@feature/credential/CredentialList"), "CredentialList"),
          },
          {
            path: "/credentials/:id",
            ...lazyRoute(() => import("@feature/credential/CredentialDetail"), "CredentialDetail"),
          },
          {
            path: "/credentials/submit",
            ...lazyRoute(() => import("@feature/credential/CredentialSubmit"), "CredentialSubmit"),
          },
          {
            path: "/account/profile",
            ...lazyRoute(() => import("@feature/user/UserSelfProfile"), "UserSelfProfile"),
          },
          {
            path: "/account/email",
            ...lazyRoute(() => import("@feature/user/UserSelfEmail"), "UserSelfEmail"),
          },

          // Lookup tables (any authenticated; mutations gated in-page)
          {
            path: "/credential-types",
            ...lazyRoute(
              () => import("@feature/credential-type/CredentialTypesPage"),
              "CredentialTypesPage",
            ),
          },
          {
            path: "/credential-issuer-organizations",
            ...lazyRoute(
              () => import("@feature/issuer-organization/IssuerOrganizationsPage"),
              "IssuerOrganizationsPage",
            ),
          },
          {
            path: "/competencies",
            ...lazyRoute(() => import("@feature/competency/CompetenciesPage"), "CompetenciesPage"),
          },
          {
            path: "/user-units",
            ...lazyRoute(() => import("@feature/user-unit/UserUnitsPage"), "UserUnitsPage"),
          },

          // Issuer+
          {
            element: <ProtectedRoute allowedRoles={[Role.ISSUER, Role.ADMIN, Role.SUPER_ADMIN]} />,
            children: [
              { path: "/users", ...lazyRoute(() => import("@feature/user/UserList"), "UserList") },
              {
                path: "/users/:id",
                ...lazyRoute(() => import("@feature/user/UserDetail"), "UserDetail"),
              },
              {
                path: "/credentials/issue",
                ...lazyRoute(
                  () => import("@feature/credential/CredentialIssue"),
                  "CredentialIssue",
                ),
              },
            ],
          },

          // Admin+
          {
            element: <ProtectedRoute allowedRoles={[Role.ADMIN, Role.SUPER_ADMIN]} />,
            children: [
              {
                path: "/users/create",
                ...lazyRoute(() => import("@feature/user/UserCreate"), "UserCreate"),
              },
            ],
          },
        ],
      },
    ],
  },

  // Fallback
  { path: "*", element: <NotFound /> },
]);
