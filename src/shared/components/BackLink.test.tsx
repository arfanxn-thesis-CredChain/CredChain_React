import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as RouterDom from "react-router-dom";
import { TestProviders } from "@/test/TestProviders";
import { useStore } from "@app/store";
import { i18n } from "@shared/i18n/config";
import { BackLink } from "./BackLink";

const navigateMock = vi.fn();
let locationKey = "default";
let locationPathname = "/login";
let locationState: unknown = null;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof RouterDom>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ key: locationKey, pathname: locationPathname, state: locationState }),
  };
});

describe("BackLink", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    navigateMock.mockClear();
    locationKey = "default";
    locationPathname = "/login";
    locationState = null;
    useStore.setState({ user: null, isAuthenticated: false });
  });

  it("renders the Back label", () => {
    render(<BackLink />, { wrapper: TestProviders });
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("navigates back in history when prior history exists", async () => {
    locationKey = "abc123";
    locationPathname = "/about";
    render(<BackLink />, { wrapper: TestProviders });
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(navigateMock).toHaveBeenCalledWith(-1);
  });

  it("falls back to /overview when authenticated and no prior history", async () => {
    locationPathname = "/about";
    useStore.setState({ isAuthenticated: true });
    render(<BackLink />, { wrapper: TestProviders });
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(navigateMock).toHaveBeenCalledWith("/overview");
  });

  it("falls back to / when unauthenticated and no prior history", async () => {
    locationPathname = "/about";
    useStore.setState({ isAuthenticated: false });
    render(<BackLink />, { wrapper: TestProviders });
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("redirects to / when on login with protected-redirect state (unauthenticated)", async () => {
    locationPathname = "/login";
    locationState = { from: { pathname: "/overview" } };
    useStore.setState({ isAuthenticated: false });
    render(<BackLink />, { wrapper: TestProviders });
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(navigateMock).toHaveBeenCalledWith("/");
    expect(navigateMock).not.toHaveBeenCalledWith(-1);
  });

  it("redirects to /overview when on login with protected-redirect state (authenticated)", async () => {
    locationPathname = "/login";
    locationState = { from: { pathname: "/overview" } };
    useStore.setState({ isAuthenticated: true });
    render(<BackLink />, { wrapper: TestProviders });
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(navigateMock).toHaveBeenCalledWith("/overview");
    expect(navigateMock).not.toHaveBeenCalledWith(-1);
  });

  it("calls custom onClick when provided instead of navigating history", async () => {
    const customClick = vi.fn();
    render(<BackLink onClick={customClick} />, { wrapper: TestProviders });
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(customClick).toHaveBeenCalledOnce();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
