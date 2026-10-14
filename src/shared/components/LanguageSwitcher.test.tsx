import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useStore } from "@app/store";
import { i18n } from "@shared/i18n/config";
import { makeUser } from "@/test/fixtures";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { LanguageSwitcher } from "./LanguageSwitcher";

const chooseEnglish = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Change language" }));
  await user.click(screen.getByRole("menuitem", { name: /English/ }));
};

beforeEach(async () => {
  useStore.setState({
    user: null,
    isAuthenticated: false,
    locale: "id",
    languageSavePending: false,
  });
  await i18n.changeLanguage("id");
});

describe("LanguageSwitcher", () => {
  it("switches guest language locally without saving", async () => {
    const save = vi.fn();
    server.use(
      http.put("*/api/users/self/language", () => {
        save();
        return HttpResponse.json({ data: { language: "en" } });
      }),
    );
    render(<LanguageSwitcher />, { wrapper: TestProviders });
    await chooseEnglish();
    await waitFor(() => expect(i18n.language).toBe("en"));
    expect(useStore.getState().locale).toBe("en");
    expect(save).not.toHaveBeenCalled();
  });

  it("saves authenticated language and keeps account language after logout", async () => {
    const account = makeUser({ language: "id" });
    useStore.getState().setUser(account);
    let body: unknown;
    server.use(
      http.put("*/api/users/self/language", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ code: 300800, data: { language: "en" } });
      }),
    );
    render(<LanguageSwitcher />, { wrapper: TestProviders });
    await chooseEnglish();
    await waitFor(() => expect(useStore.getState().user?.language).toBe("en"));
    expect(body).toEqual({ language: "en" });
    useStore.getState().clearUser();
    expect(useStore.getState().locale).toBe("en");
    expect(i18n.language).toBe("en");
  });

  it("restores previous language when save fails", async () => {
    useStore.getState().setUser(makeUser());
    server.use(http.put("*/api/users/self/language", () => HttpResponse.json({}, { status: 500 })));
    render(<LanguageSwitcher />, { wrapper: TestProviders });
    await chooseEnglish();
    await waitFor(() => expect(useStore.getState().languageSavePending).toBe(false));
    expect(useStore.getState().locale).toBe("id");
    expect(useStore.getState().user?.language).toBe("id");
    expect(i18n.language).toBe("id");
  });

  it("does not let an in-flight session probe overwrite a save", async () => {
    const account = makeUser({ language: "id" });
    useStore.getState().setUser(account);
    let finishSave!: (value: Response) => void;
    server.use(
      http.put(
        "*/api/users/self/language",
        () =>
          new Promise<Response>((resolve) => {
            finishSave = resolve;
          }),
      ),
    );
    render(<LanguageSwitcher />, { wrapper: TestProviders });
    await chooseEnglish();
    await waitFor(() => expect(useStore.getState().languageSavePending).toBe(true));
    useStore.getState().setUser(account);
    expect(useStore.getState().locale).toBe("en");
    finishSave(HttpResponse.json({ code: 300800, data: { language: "en" } }));
    await waitFor(() => expect(useStore.getState().user?.language).toBe("en"));
  });
});
