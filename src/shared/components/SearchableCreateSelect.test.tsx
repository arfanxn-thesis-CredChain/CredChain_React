import { describe, expect, it, beforeEach, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { i18n } from "@shared/i18n/config";
import { server } from "@/test/msw/server";
import { TestProviders } from "@/test/TestProviders";
import { notify } from "@shared/lib/notify";
import { SearchableCreateSelect } from "./SearchableCreateSelect";

beforeEach(() => {
  void i18n.changeLanguage("en");
});

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

    expect(screen.getByText("Bachelor's Degree")).toBeInTheDocument();
    expect(screen.queryByText("Professional Certificate")).not.toBeInTheDocument();
  });

  it("creates a new entry and selects it when no match", async () => {
    server.use(
      http.get("*/api/credential-types", () =>
        HttpResponse.json({
          code: 400600,
          message: "OK",
          data: {
            items: [{ id: "ctype_01", name: "Bachelor's Degree" }],
            total: 1,
          },
        }),
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
    const createRow = screen.getByText('Create "Blockchain Architect"');
    expect(createRow).toBeInTheDocument();

    fireEvent.click(createRow);

    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("ctype_new");
    });
  });

  it("notifies and selects the existing row when the upsert returns a known id", async () => {
    const infoSpy = vi.spyOn(notify, "info").mockImplementation(() => {});
    server.use(
      http.get("*/api/credential-types", () =>
        HttpResponse.json({
          code: 400600,
          message: "OK",
          data: {
            items: [{ id: "ctype_01", name: "Bachelor's Degree" }],
            total: 1,
          },
        }),
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
    fireEvent.click(screen.getByText('Create "zze-zz"'));

    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("ctype_01");
    });
    expect(infoSpy).toHaveBeenCalledWith("cred.submit.existing");
    infoSpy.mockRestore();
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
    expect(screen.getByRole("combobox")).toHaveTextContent("Machine Learning");

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("button", { name: "Machine Learning" }));

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("combobox")).toHaveTextContent("Type to search...");
  });
});
