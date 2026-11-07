import { describe, it, expect, beforeEach } from "vitest";

describe.each([
  ["id", "Menunggu tinjauan"],
  ["en", "Pending review"],
])("pending review terminology in %s", (language, expected) => {
  it("uses the same status label for reference and credential filters", async () => {
    const { i18n } = await import("./config");
    const t = i18n.getFixedT(language);
    expect(t("cred.references.filter.pending")).toBe(expected);
    expect(t("cred.review.pendingReview")).toBe(expected);
  });
});

describe("readPersistedLocale", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns 'id' when localStorage is empty", async () => {
    const { readPersistedLocale } = await import("./config");
    expect(readPersistedLocale()).toBe("id");
  });

  it("returns 'en' when stored locale is 'en'", async () => {
    localStorage.setItem("credchain-store", JSON.stringify({ state: { locale: "en" } }));
    const { readPersistedLocale } = await import("./config");
    expect(readPersistedLocale()).toBe("en");
  });

  it("returns 'id' when stored locale is 'id'", async () => {
    localStorage.setItem("credchain-store", JSON.stringify({ state: { locale: "id" } }));
    const { readPersistedLocale } = await import("./config");
    expect(readPersistedLocale()).toBe("id");
  });

  it("returns 'id' when stored locale is invalid", async () => {
    localStorage.setItem("credchain-store", JSON.stringify({ state: { locale: "fr" } }));
    const { readPersistedLocale } = await import("./config");
    expect(readPersistedLocale()).toBe("id");
  });

  it("returns 'id' on JSON parse error", async () => {
    localStorage.setItem("credchain-store", "not-valid-json");
    const { readPersistedLocale } = await import("./config");
    expect(readPersistedLocale()).toBe("id");
  });
});
