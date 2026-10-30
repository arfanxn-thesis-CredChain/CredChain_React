import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { i18n } from "@shared/i18n/config";

interface TestProvidersProps {
  children: ReactNode;
  initialEntries?: string[];
  routePath?: string;
}

export function TestProviders({ children, initialEntries = ["/"], routePath }: TestProvidersProps) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  // Data router (createMemoryRouter) is required so hooks like useBlocker work.
  const routes = routePath
    ? [
        { path: routePath, element: <>{children}</> },
        { path: "*", element: <div data-testid="navigated-out" /> },
      ]
    : [{ path: "*", element: <>{children}</> }];
  const router = createMemoryRouter(routes, {
    initialEntries,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nextProvider>
    </QueryClientProvider>
  );
}
