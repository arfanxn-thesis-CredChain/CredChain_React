import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TestProviders } from "@/test/TestProviders";
import { useDebouncedSearchParam } from "./useSearchParam";

function Search() {
  const { input, setInput, search } = useDebouncedSearchParam("search", 20);
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <>
      <input aria-label="Search" value={input} onChange={(event) => setInput(event.target.value)} />
      <output data-testid="search">{search}</output>
      <output data-testid="url">{location.search}</output>
      <button onClick={() => void navigate(-1)}>Back</button>
      <button onClick={() => void navigate(1)}>Forward</button>
    </>
  );
}

describe("useDebouncedSearchParam", () => {
  it("replaces URL immediately but debounces API search, retaining unrelated keys", async () => {
    render(
      <TestProviders initialEntries={["/?search=old&status=pending&keep=yes"]}>
        <Search />
      </TestProviders>,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "new" } });
    expect(screen.getByTestId("url")).toHaveTextContent("search=new&status=pending&keep=yes");
    expect(screen.getByTestId("search")).toHaveTextContent("old");
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("new"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    expect(screen.getByTestId("url")).toHaveTextContent("?status=pending&keep=yes");
  });

  it("restores input with history and never writes stale debounced input over navigation", async () => {
    render(
      <TestProviders initialEntries={["/?search=first", "/?search=second&status=pending"]}>
        <Search />
      </TestProviders>,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "typed" } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("first"));
    expect(screen.getByRole("textbox")).toHaveValue("first");
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("first"));
    expect(screen.getByTestId("url")).toHaveTextContent("?search=first");
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("typed"));
    expect(screen.getByRole("textbox")).toHaveValue("typed");
    expect(screen.getByTestId("url")).toHaveTextContent("status=pending");
  });
});
