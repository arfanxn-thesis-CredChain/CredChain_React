import { beforeEach, describe, expect, it } from "vitest";
import { makeUser } from "@/test/fixtures";
import { useStore } from "./index";

beforeEach(() => {
  useStore.setState({
    user: null,
    isAuthenticated: false,
    locale: "id",
    languageSavePending: false,
  });
});

describe("account language", () => {
  it("uses saved account preference instead of local preference when session loads", () => {
    useStore.getState().setUser(makeUser({ language: "en" }));
    expect(useStore.getState().locale).toBe("en");
  });

  it("keeps local language during an in-flight save for the same account", () => {
    const account = makeUser({ language: "id" });
    useStore.getState().setUser(account);
    useStore.setState({ locale: "en", languageSavePending: true });
    useStore.getState().setUser(account);
    expect(useStore.getState().locale).toBe("en");
  });

  it("uses a different account's saved preference despite an old pending save", () => {
    useStore.getState().setUser(makeUser({ id: "first", language: "id" }));
    useStore.setState({ locale: "en", languageSavePending: true });
    useStore.getState().setUser(makeUser({ id: "second", language: "id" }));
    expect(useStore.getState().locale).toBe("id");
  });

  it("keeps selected language on logout", () => {
    useStore.getState().setUser(makeUser({ language: "en" }));
    useStore.getState().clearUser();
    expect(useStore.getState().locale).toBe("en");
  });
});
