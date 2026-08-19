import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@app/store";
import { Role } from "@shared/auth/role";
import { i18n } from "@shared/i18n/config";
import { makeUser } from "@/test/fixtures";
import { TestProviders } from "@/test/TestProviders";
import { UserUnitsPage } from "./UserUnitsPage";

function renderPage() {
  return render(<UserUnitsPage />, { wrapper: TestProviders });
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  useStore.setState({
    user: makeUser({ id: "usr_admin", role: Role.ADMIN }),
    isAuthenticated: true,
  });
});

describe("UserUnitsPage", () => {
  it("renders the page header and the unit tree from the list endpoint", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "User Units" })).toBeInTheDocument();
    expect((await screen.findAllByText("Faculty of Engineering")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Add root unit" })).toBeInTheDocument();
  });
});
