import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionHydrator } from "./SessionHydrator";
import { useStore } from "./store";
import { ApiError } from "@shared/api/envelope";

const mocks = vi.hoisted(() => ({
  authHandler: null as (() => void) | null,
  probe: {} as { data?: unknown; isError?: boolean; error?: unknown },
}));
vi.mock("@shared/api/client", () => ({
  configureAuthHandler: (handler: () => void) => {
    mocks.authHandler = handler;
  },
  configureLocaleResolver: vi.fn(),
}));
vi.mock("@feature/user/api/useUserSelf", () => ({ useUserSelf: () => mocks.probe }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "id" } }) }));
vi.mock("@app/router", () => ({ router: { navigate: vi.fn() } }));

describe("SessionHydrator", () => {
  beforeEach(() => {
    mocks.probe = {};
    useStore.setState({ isAuthenticated: true });
  });

  it("leaves authentication decisions to the interceptor rather than clearing on arbitrary 401s", async () => {
    mocks.probe = {
      isError: true,
      error: new ApiError(401, 300442, "error", new Error("Unauthorized") as ApiError["cause"]),
    };
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <SessionHydrator>content</SessionHydrator>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(mocks.authHandler).not.toBeNull());
    expect(useStore.getState().isAuthenticated).toBe(true);
  });

  it("clears private cached data on definitive session invalidation", async () => {
    const client = new QueryClient();
    client.setQueryData(["private"], { secret: true });
    render(
      <QueryClientProvider client={client}>
        <SessionHydrator>content</SessionHydrator>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(mocks.authHandler).not.toBeNull());
    act(() => mocks.authHandler?.());
    expect(useStore.getState().isAuthenticated).toBe(false);
    expect(client.getQueryData(["private"])).toBeUndefined();
  });
});
