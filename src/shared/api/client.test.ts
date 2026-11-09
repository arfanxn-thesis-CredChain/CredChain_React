import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { server } from "@/test/msw/server";
import { http, HttpResponse } from "msw";
import { api, configureAuthHandler } from "./client";

describe("axios interceptor — 401 handling", () => {
  let unauthCalled = false;

  beforeEach(() => {
    unauthCalled = false;
    configureAuthHandler(() => {
      unauthCalled = true;
    });
  });

  it("retries /users/self after silent refresh succeeds", async () => {
    let selfCallCount = 0;
    server.use(
      http.get("/api/users/self", () => {
        selfCallCount++;
        if (selfCallCount === 1) {
          return HttpResponse.json({ code: 200140, message: "Unauthorized" }, { status: 401 });
        }
        return HttpResponse.json({
          code: 100200,
          message: "OK",
          data: { id: "1", email: "a@b.com" },
        });
      }),
      http.post("/api/auth/refresh", () => HttpResponse.json({ code: 100000, message: "OK" })),
    );

    const response = await api.get("/users/self");
    expect(selfCallCount).toBe(2);
    expect(unauthCalled).toBe(false);
    expect(response.data).toMatchObject({ id: "1" });
  });

  it("calls onUnauthenticated when refresh fails on /users/self 401", async () => {
    server.use(
      http.get("/api/users/self", () =>
        HttpResponse.json({ code: 200140, message: "Unauthorized" }, { status: 401 }),
      ),
      http.post("/api/auth/refresh", () =>
        HttpResponse.json({ code: 200140, message: "Unauthorized" }, { status: 401 }),
      ),
    );

    await expect(api.get("/users/self")).rejects.toThrow();
    expect(unauthCalled).toBe(true);
  });

  it("does NOT retry /auth/refresh on 401 (would loop)", async () => {
    let refreshCount = 0;
    server.use(
      http.post("/api/auth/refresh", () => {
        refreshCount++;
        return HttpResponse.json({ code: 200140, message: "Unauthorized" }, { status: 401 });
      }),
    );

    await expect(api.post("/auth/refresh")).rejects.toThrow();
    expect(refreshCount).toBe(1);
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([500, 429, 503])("preserves session when refresh returns %s", async (status) => {
    server.use(
      http.get("/api/users/self", () => HttpResponse.json({ code: 200140 }, { status: 401 })),
      http.post("/api/auth/refresh", () => HttpResponse.json({ code: 100150 }, { status })),
    );
    await expect(api.get("/users/self")).rejects.toMatchObject({ status });
    expect(unauthCalled).toBe(false);
  });

  it("preserves session when refresh has a network failure", async () => {
    server.use(
      http.get("/api/users/self", () => HttpResponse.json({ code: 200140 }, { status: 401 })),
      http.post("/api/auth/refresh", () => HttpResponse.error()),
    );
    await expect(api.get("/users/self")).rejects.toThrow();
    expect(unauthCalled).toBe(false);
  });

  it("does not refresh or clear session for domain reauthentication failures", async () => {
    let refreshes = 0;
    server.use(
      http.put("/api/users/self/email", () => HttpResponse.json({ code: 300442 }, { status: 401 })),
      http.post("/api/auth/refresh", () => {
        refreshes++;
        return HttpResponse.json({ code: 200340 }, { status: 401 });
      }),
    );
    await expect(api.put("/users/self/email")).rejects.toMatchObject({ status: 401 });
    expect(refreshes).toBe(0);
    expect(unauthCalled).toBe(false);
  });

  it("clears session if a replay still receives an authentication 401", async () => {
    server.use(
      http.get("/api/users/self", () => HttpResponse.json({ code: 200140 }, { status: 401 })),
      http.post("/api/auth/refresh", () => HttpResponse.json({ code: 200300 })),
    );
    await expect(api.get("/users/self")).rejects.toMatchObject({ status: 401 });
    expect(unauthCalled).toBe(true);
  });

  it("shares refresh across concurrent requests and skips refresh for delayed old 401s", async () => {
    let refreshes = 0;
    let releaseSlow!: () => void;
    let slowStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      slowStarted = resolve;
    });
    const slow = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    let firstSlow = true;
    server.use(
      http.get("/api/slow", async () => {
        if (firstSlow) {
          firstSlow = false;
          slowStarted();
          await slow;
          return HttpResponse.json({ code: 200140 }, { status: 401 });
        }
        return HttpResponse.json({ code: 100000, data: "ok" });
      }),
      http.get("/api/fast", ({ request }) =>
        request.headers.get("X-Retry") === "1"
          ? HttpResponse.json({ code: 100000, data: "ok" })
          : HttpResponse.json({ code: 200140 }, { status: 401 }),
      ),
      http.post("/api/auth/refresh", () => {
        refreshes++;
        return HttpResponse.json({ code: 200300 });
      }),
    );
    const pending = api.get("/slow");
    await started;
    await Promise.all([api.get("/fast"), api.get("/fast")]);
    releaseSlow();
    await pending;
    expect(refreshes).toBe(1);
    expect(unauthCalled).toBe(false);
  });

  it("checks shared cookies under a browser lock before rotating", async () => {
    const requestLock = vi.fn(async (_name: string, callback: () => Promise<void>) => callback());
    vi.stubGlobal("navigator", { locks: { request: requestLock } });
    let refreshes = 0;
    server.use(
      http.get("/api/expired", ({ request }) =>
        request.headers.get("X-Retry") === "1"
          ? HttpResponse.json({ code: 100000 })
          : HttpResponse.json({ code: 200140 }, { status: 401 }),
      ),
      http.get("/api/users/self", () => HttpResponse.json({ code: 100000, data: { id: "1" } })),
      http.post("/api/auth/refresh", () => {
        refreshes++;
        return HttpResponse.json({ code: 200300 });
      }),
    );
    await api.get("/expired");
    expect(requestLock).toHaveBeenCalled();
    expect(refreshes).toBe(0);
    expect(unauthCalled).toBe(false);
  });

  it("rotates if access expires between a successful shared-cookie probe and replay", async () => {
    vi.stubGlobal("navigator", {
      locks: { request: async (_name: string, callback: () => Promise<unknown>) => callback() },
    });
    let renewed = false;
    server.use(
      http.get("/api/boundary", () =>
        renewed
          ? HttpResponse.json({ code: 100000, data: "ok" })
          : HttpResponse.json({ code: 200140 }, { status: 401 }),
      ),
      http.get("/api/users/self", () => HttpResponse.json({ code: 100000, data: { id: "1" } })),
      http.post("/api/auth/refresh", () => {
        renewed = true;
        return HttpResponse.json({ code: 200300 });
      }),
    );
    await expect(api.get("/boundary")).resolves.toMatchObject({ data: "ok" });
    expect(unauthCalled).toBe(false);
  });

  it("maps 429 to system.rate_limited", async () => {
    server.use(
      http.get("/api/users", () =>
        HttpResponse.json({ code: 429000, message: "Too many requests" }, { status: 429 }),
      ),
    );

    await expect(api.get("/users")).rejects.toMatchObject({
      messageKey: "system.rate_limited",
    });
  });

  it("maps 429 with Retry-After to system.rate_limited_with_retry", async () => {
    server.use(
      http.get(
        "/api/users",
        () =>
          new HttpResponse(JSON.stringify({ code: 429000, message: "Too many requests" }), {
            status: 429,
            headers: { "Retry-After": "30" },
          }),
      ),
    );

    await expect(api.get("/users")).rejects.toMatchObject({
      messageKey: "system.rate_limited_with_retry",
    });
  });
});
