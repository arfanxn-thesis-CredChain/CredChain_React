import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLoadMore } from "./useLoadMore";
import type { PaginatedResponse } from "@shared/types/api";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

interface TestItem {
  id: string;
  name: string;
}

function makeResponse(
  items: TestItem[],
  page: number,
  lastPage: number,
  total: number,
): PaginatedResponse<TestItem> {
  return {
    items,
    total,
    page,
    limit: 50,
    last_page: lastPage,
    from: (page - 1) * 50 + 1,
    to: Math.min(page * 50, total),
    first_page_url: null,
    last_page_url: null,
    next_page_url: null,
    prev_page_url: null,
  };
}

describe("useLoadMore", () => {
  it("loads first page on mount", async () => {
    const queryFn = vi.fn().mockResolvedValue(makeResponse([{ id: "1", name: "A" }], 1, 1, 1));

    const { result } = renderHook(() => useLoadMore(["test"], queryFn), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([{ id: "1", name: "A" }]);
    expect(result.current.total).toBe(1);
    expect(result.current.hasMore).toBe(false);
    expect(queryFn).toHaveBeenCalledWith(1, 50);
  });

  it("passes a custom batch size through to the query function", async () => {
    const queryFn = vi.fn().mockResolvedValue(makeResponse([{ id: "1", name: "A" }], 1, 1, 1));

    const { result } = renderHook(() => useLoadMore(["test"], queryFn, 100), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(queryFn).toHaveBeenCalledWith(1, 100);
  });

  it("loadMore fetches next page and appends items", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(
          [
            { id: "1", name: "A" },
            { id: "2", name: "B" },
          ],
          1,
          2,
          4,
        ),
      )
      .mockResolvedValueOnce(
        makeResponse(
          [
            { id: "3", name: "C" },
            { id: "4", name: "D" },
          ],
          2,
          2,
          4,
        ),
      );

    const { result } = renderHook(() => useLoadMore(["test"], queryFn), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
    expect(result.current.items).toHaveLength(4);
    expect(result.current.hasMore).toBe(false);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("reset clears items and goes back to page 1", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce(makeResponse([{ id: "1", name: "A" }], 1, 2, 3))
      .mockResolvedValueOnce(
        makeResponse(
          [
            { id: "2", name: "B" },
            { id: "3", name: "C" },
          ],
          2,
          2,
          3,
        ),
      )
      .mockResolvedValueOnce(makeResponse([{ id: "1", name: "A" }], 1, 2, 3));

    const { result } = renderHook(() => useLoadMore(["test"], queryFn), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.items).toHaveLength(3));

    await act(async () => {
      result.current.reset();
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it("resets when queryKey changes", async () => {
    const queryFn = vi.fn().mockResolvedValue(makeResponse([{ id: "1", name: "A" }], 1, 1, 1));

    const { result, rerender } = renderHook(({ key }) => useLoadMore(key, queryFn), {
      wrapper: wrapper(),
      initialProps: { key: ["test", "v1"] },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(queryFn).toHaveBeenCalledTimes(1);

    rerender({ key: ["test", "v2"] });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("does not add duplicate items on re-fetch", async () => {
    const queryFn = vi.fn().mockResolvedValue(makeResponse([{ id: "1", name: "A" }], 1, 1, 1));

    const { result } = renderHook(() => useLoadMore(["test"], queryFn), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(1);
  });
});
