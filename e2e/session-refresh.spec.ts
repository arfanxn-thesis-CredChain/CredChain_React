import { expect, test } from "@playwright/test";

test("two tabs coordinate expired access cookies without duplicate rotation", async ({
  context,
}) => {
  let renewed = false;
  let refreshes = 0;
  let initialRequests = 0;
  let releaseInitial!: () => void;
  const bothStarted = new Promise<void>((resolve) => {
    releaseInitial = resolve;
  });
  await context.route("**/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/session-test") {
      await route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Session test</title>",
      });
    } else if (path === "/api/auth/refresh") {
      refreshes++;
      if (renewed) {
        await route.fulfill({ status: 401, json: { code: 200342 } });
      } else {
        renewed = true;
        await route.fulfill({ json: { code: 200300 } });
      }
    } else if (path.startsWith("/api/")) {
      if (initialRequests < 2) {
        initialRequests++;
        if (initialRequests === 2) releaseInitial();
        await bothStarted;
        await route.fulfill({ status: 401, json: { code: 200140 } });
        return;
      }
      await route.fulfill({
        status: renewed ? 200 : 401,
        json: renewed ? { code: 100000, data: { id: "holder" } } : { code: 200140 },
      });
    } else {
      await route.continue();
    }
  });
  const tabs = [await context.newPage(), await context.newPage()];
  await Promise.all(tabs.map((page) => page.goto("/session-test")));
  await Promise.all(
    tabs.map((page) =>
      page.evaluate(async () => {
        // Import the production client through Vite; no application or OAuth state is needed.
        const modulePath = "/src/shared/api/client.ts";
        const { api, configureAuthHandler } = await import(modulePath);
        configureAuthHandler(() => {
          throw new Error("Unexpected logout");
        });
        const response = await api.get("/users/self");
        return response.data;
      }),
    ),
  );
  expect(refreshes).toBe(1);
  // Navigation and a full reload keep using the renewed session.
  await tabs[0].reload();
  const user = await tabs[0].evaluate(async () => {
    const modulePath = "/src/shared/api/client.ts";
    const { api } = await import(modulePath);
    return (await api.get("/users/self")).data;
  });
  expect(user).toEqual({ id: "holder" });
  expect(refreshes).toBe(1);
});

test("logout waits for another tab's pending refresh response", async ({ context }) => {
  let refreshStarted!: () => void;
  let releaseRefresh!: () => void;
  const started = new Promise<void>((resolve) => {
    refreshStarted = resolve;
  });
  const release = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  const order: string[] = [];
  let renewed = false;
  await context.route("**/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/session-test") {
      await route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Session test</title>",
      });
    } else if (path === "/api/auth/refresh") {
      refreshStarted();
      await release;
      renewed = true;
      order.push("refresh");
      await route.fulfill({ json: { code: 200300 } });
    } else if (path === "/api/auth/logout") {
      order.push("logout");
      renewed = false;
      await route.fulfill({ json: { code: 200400 } });
    } else if (path.startsWith("/api/")) {
      await route.fulfill({
        status: renewed ? 200 : 401,
        json: { code: renewed ? 100000 : 200140 },
      });
    } else {
      await route.continue();
    }
  });
  const refreshTab = await context.newPage();
  const logoutTab = await context.newPage();
  await Promise.all([refreshTab.goto("/session-test"), logoutTab.goto("/session-test")]);
  const refreshing = refreshTab.evaluate(async () => {
    const path = "/src/shared/api/client.ts";
    const { api } = await import(path);
    await api.get("/users/self").catch(() => {});
  });
  await started;
  const loggingOut = logoutTab.evaluate(async () => {
    const path = "/src/shared/api/client.ts";
    const client = await import(path);
    Reflect.set(window, "logoutStarted", true);
    await client.logoutSession();
  });
  // A barrier proves the logout tab has started its operation before refresh completes.
  await logoutTab.waitForFunction(() => Reflect.get(window, "logoutStarted") === true);
  releaseRefresh();
  await Promise.all([refreshing, loggingOut]);
  expect(order).toEqual(["refresh", "logout"]);
});
