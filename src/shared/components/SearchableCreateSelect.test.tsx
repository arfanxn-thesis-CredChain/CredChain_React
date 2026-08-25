import { describe, expect, it, beforeEach, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { i18n } from "@shared/i18n/config";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { notify } from "@shared/lib/notify";
import { SearchableCreateSelect } from "./SearchableCreateSelect";

beforeEach(() => {
  void i18n.changeLanguage("en");
});

function paginated(items: Array<{ id: string; name: string }>) {
  return HttpResponse.json({
    code: 400600,
    message: "OK",
    data: {
      items,
      total: items.length,
      page: 1,
      limit: 100,
      last_page: 1,
      from: items.length ? 1 : 0,
      to: items.length,
      first_page_url: null,
      last_page_url: null,
      next_page_url: null,
      prev_page_url: null,
    },
  });
}

describe("SearchableCreateSelect", () => {
  it("filters options by typed text", async () => {
    render(
      <SearchableCreateSelect
        resource="credential-types"
        label="Type"
        value=""
        onChange={() => {}}
      />,
      { wrapper: TestProviders },
    );

    fireEvent.click(screen.getByRole("combobox"));
    await screen.findByText("Bachelor's Degree");
    expect(screen.getByText("Professional Certificate")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Type to search..."), {
      target: { value: "Bachelor" },
    });

    // The filter runs on the server now (see the MSW reference handler) and the
    // term is debounced, so the narrowed list arrives asynchronously. Assert both
    // conditions in one waitFor: mid-refetch the list renders a spinner instead
    // of rows, so checking the absence alone would pass on that empty frame.
    await waitFor(() => {
      expect(screen.getByText("Bachelor's Degree")).toBeInTheDocument();
      expect(screen.queryByText("Professional Certificate")).not.toBeInTheDocument();
    });
  });

  it("creates a new entry and selects it when no match", async () => {
    server.use(
      // No rows for a non-matching search, so the create row appears.
      http.get("*/api/credential-types", ({ request }) =>
        paginated(
          new URL(request.url).searchParams.get("search")
            ? []
            : [{ id: "ctype_01", name: "Bachelor's Degree" }],
        ),
      ),
      http.post("*/api/credential-types", async ({ request }) => {
        const body = (await request.json()) as { name?: string };
        return HttpResponse.json({
          code: 400600,
          message: "OK",
          data: { id: "ctype_new", name: body.name ?? "" },
        });
      }),
    );

    const onChange = vi.fn();
    render(
      <SearchableCreateSelect
        resource="credential-types"
        label="Type"
        value=""
        onChange={onChange}
      />,
      { wrapper: TestProviders },
    );

    fireEvent.click(screen.getByRole("combobox"));
    await screen.findByText("Bachelor's Degree");

    fireEvent.change(screen.getByPlaceholderText("Type to search..."), {
      target: { value: "Blockchain Architect" },
    });
    // Search is server-side and debounced, so the create row only appears once
    // the empty result lands.
    const createRow = await screen.findByText('Create "Blockchain Architect"');

    fireEvent.click(createRow);

    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("ctype_new");
    });
  });

  it("notifies and selects the existing row when the upsert returns a known id", async () => {
    const infoSpy = vi.spyOn(notify, "info").mockImplementation(() => {});
    server.use(
      http.get("*/api/credential-types", ({ request }) =>
        paginated(
          new URL(request.url).searchParams.get("search")
            ? []
            : [{ id: "ctype_01", name: "Bachelor's Degree" }],
        ),
      ),
      http.post("*/api/credential-types", () =>
        HttpResponse.json({
          code: 400600,
          message: "OK",
          data: { id: "ctype_01", name: "Bachelor's Degree" },
        }),
      ),
    );

    const onChange = vi.fn();
    render(
      <SearchableCreateSelect
        resource="credential-types"
        label="Type"
        value=""
        onChange={onChange}
      />,
      { wrapper: TestProviders },
    );

    fireEvent.click(screen.getByRole("combobox"));
    await screen.findByText("Bachelor's Degree");

    fireEvent.change(screen.getByPlaceholderText("Type to search..."), {
      target: { value: "zze-zz" },
    });
    fireEvent.click(await screen.findByText('Create "zze-zz"'));

    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("ctype_01");
    });
    expect(infoSpy).toHaveBeenCalledWith("cred.submit.existing");
    infoSpy.mockRestore();
  });

  it("renders the chip name for a selection that is not on the loaded page", async () => {
    // The regression pagination would otherwise introduce: reading the name off
    // the loaded rows renders a bare id once the selection lives past page 1.
    server.use(
      http.get("*/api/credential-types", ({ request }) => {
        const url = new URL(request.url);
        const idFilter = url.searchParams.getAll("filters").find((f) => f.startsWith("id$"));
        if (idFilter) return paginated([{ id: "ctype_99", name: "Doctoral Degree" }]);
        return paginated([{ id: "ctype_01", name: "Bachelor's Degree" }]);
      }),
    );

    render(
      <SearchableCreateSelect
        resource="credential-types"
        label="Type"
        value="ctype_99"
        onChange={() => {}}
      />,
      { wrapper: TestProviders },
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Doctoral Degree");
    });
  });

  it("toggles competencies in multi-select mode", async () => {
    function MultiHarness() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <SearchableCreateSelect
          multiple
          resource="competencies"
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<MultiHarness />, { wrapper: TestProviders });

    expect(screen.getByRole("combobox")).toHaveTextContent("Type to search...");

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("button", { name: "Machine Learning" }));

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    // Chip names come from a by-ids lookup, not the loaded page, so the label
    // fills in once that request resolves.
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Machine Learning");
    });

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("button", { name: "Machine Learning" }));

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Type to search...");
    });
  });
});
