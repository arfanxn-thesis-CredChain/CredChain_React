import { describe, expect, it, beforeEach, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { i18n } from "@shared/i18n/config";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { notify } from "@shared/lib/notify";
import { SearchableCreateSelect } from "./SearchableCreateSelect";

beforeEach(() => {
  void i18n.changeLanguage("en");
});

function paginated(items: Array<{ id: string; name: string; active?: boolean }>) {
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

    await userEvent.click(screen.getByRole("combobox"));
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

    await userEvent.click(screen.getByRole("combobox"));
    await screen.findByText("Bachelor's Degree");

    fireEvent.change(screen.getByPlaceholderText("Type to search..."), {
      target: { value: "Blockchain Architect" },
    });
    // Search is server-side and debounced, so the create row only appears once
    // the empty result lands.
    const createRow = await screen.findByText('Create "Blockchain Architect"');

    await userEvent.click(createRow);

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

    await userEvent.click(screen.getByRole("combobox"));
    await screen.findByText("Bachelor's Degree");

    fireEvent.change(screen.getByPlaceholderText("Type to search..."), {
      target: { value: "zze-zz" },
    });
    await userEvent.click(await screen.findByText('Create "zze-zz"'));

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

  it("renders an inactive row disabled, but keeps an already-selected one clickable", async () => {
    server.use(
      http.get("*/api/competencies", ({ request }) => {
        const rows = [
          { id: "comp_01", name: "Machine Learning", active: false },
          { id: "comp_02", name: "Data Analysis", active: false },
        ];
        // The chip lookup asks by id; answer it from the same set.
        const idFilter = new URL(request.url).searchParams
          .getAll("filters")
          .find((f) => f.startsWith("id$"));
        return paginated(idFilter ? rows.filter((r) => r.id === "comp_02") : rows);
      }),
    );

    render(
      <SearchableCreateSelect multiple resource="competencies" value={["comp_02"]} onChange={vi.fn()} />,
      { wrapper: TestProviders },
    );

    await userEvent.click(screen.getByRole("combobox"));

    // Unselected + inactive: unpickable. Radix disables a menu item via
    // aria-disabled/data-disabled, not the native `disabled` attribute — it's
    // a div, not a real form control — so assert on that instead of toBeDisabled().
    expect(await screen.findByRole("menuitem", { name: /Machine Learning/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // Selected + inactive: still removable, otherwise a since-retired row
    // could never be deselected while editing an old credential.
    expect(screen.getByRole("menuitem", { name: /Data Analysis/ })).not.toHaveAttribute(
      "aria-disabled",
    );
    expect(screen.getAllByText("Inactive")).toHaveLength(2);
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

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Machine Learning" }));

    // Selecting in multi-select mode must not close the panel (onSelect is
    // prevented), so closing here is Escape, not a Dialog Close button.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    // Chip names come from a by-ids lookup, not the loaded page, so the label
    // fills in once that request resolves.
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Machine Learning");
    });

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Machine Learning" }));

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Type to search...");
    });
  });

  it("removes a single competency chip via its x button without opening the panel", async () => {
    function MultiHarness() {
      const [value, setValue] = useState<string[]>(["comp_01", "comp_02"]);
      return (
        <SearchableCreateSelect
          multiple
          resource="competencies"
          value={value}
          onChange={setValue}
        />
      );
    }
    server.use(
      http.get("*/api/competencies", ({ request }) => {
        const rows = [
          { id: "comp_01", name: "Machine Learning" },
          { id: "comp_02", name: "Data Analysis" },
        ];
        const idFilter = new URL(request.url).searchParams
          .getAll("filters")
          .find((f) => f.startsWith("id$"));
        if (!idFilter) return paginated(rows);
        const ids = idFilter.slice("id$".length).split(",");
        return paginated(rows.filter((r) => ids.includes(r.id)));
      }),
    );

    render(<MultiHarness />, { wrapper: TestProviders });

    await screen.findByText("Machine Learning");
    expect(screen.getByText("Data Analysis")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Machine Learning" }));

    // The by-ids refetch clears selectedRows mid-flight, so assert the settled
    // state in one waitFor rather than checking presence/absence separately.
    await waitFor(
      () => {
        expect(screen.queryByText("Machine Learning")).not.toBeInTheDocument();
        expect(screen.getByText("Data Analysis")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    // Removing a chip must not open the search panel.
    expect(screen.queryByPlaceholderText("Type to search...")).not.toBeInTheDocument();
  });

  it("emits a proposed name instead of creating a row", async () => {
    const onChange = vi.fn();
    const onProposeChange = vi.fn();

    render(
      <SearchableCreateSelect
        mode="propose"
        resource="competencies"
        value=""
        onChange={onChange}
        proposed=""
        onProposeChange={onProposeChange}
      />,
      { wrapper: TestProviders },
    );

    await userEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText("Type to search..."), {
      target: { value: "Discrete Math" },
    });
    await userEvent.click(await screen.findByText('Propose "Discrete Math" for review'));

    expect(onProposeChange).toHaveBeenCalledWith("Discrete Math");
    // The whole point: no row is created and no id is selected.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("proposing clears a previously picked id (mutual exclusivity)", async () => {
    const onChange = vi.fn();
    const onProposeChange = vi.fn();

    render(
      <SearchableCreateSelect
        mode="propose"
        resource="competencies"
        value="comp_01"
        onChange={onChange}
        proposed=""
        onProposeChange={onProposeChange}
      />,
      { wrapper: TestProviders },
    );

    await userEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText("Type to search..."), {
      target: { value: "Discrete Math" },
    });
    await userEvent.click(await screen.findByText('Propose "Discrete Math" for review'));

    expect(onProposeChange).toHaveBeenCalledWith("Discrete Math");
    // Picked id and proposed name are mutually exclusive — the service
    // rejects a submission carrying both.
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("default create mode still POSTs and selects a row", async () => {
    const onChange = vi.fn();
    const onProposeChange = vi.fn();
    server.use(
      http.get("*/api/competencies", ({ request }) =>
        paginated(
          new URL(request.url).searchParams.get("search")
            ? []
            : [{ id: "comp_01", name: "Machine Learning" }],
        ),
      ),
      http.post("*/api/competencies", async ({ request }) => {
        const body = (await request.json()) as { name?: string };
        return HttpResponse.json({
          code: 400600,
          message: "OK",
          data: { id: "comp_new", name: body.name ?? "" },
        });
      }),
    );

    render(
      <SearchableCreateSelect
        resource="competencies"
        value=""
        onChange={onChange}
        proposed=""
        onProposeChange={onProposeChange}
      />,
      { wrapper: TestProviders },
    );

    await userEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText("Type to search..."), {
      target: { value: "Discrete Math" },
    });
    await userEvent.click(await screen.findByText('Create "Discrete Math"'));

    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("comp_new");
    });
    expect(onProposeChange).not.toHaveBeenCalled();
  });
});
