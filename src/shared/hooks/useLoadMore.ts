import { useCallback, useEffect, useReducer } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import type { PaginatedResponse } from "@shared/types/api";

const DEFAULT_BATCH_SIZE = 50;

interface LoadMoreState {
  page: number;
  items: { id: string }[];
  total: number;
}

type LoadMoreAction =
  | { type: "reset" }
  | { type: "loaded"; page: number; items: { id: string }[]; total: number }
  | { type: "nextPage" };

function loadMoreReducer(state: LoadMoreState, action: LoadMoreAction): LoadMoreState {
  switch (action.type) {
    case "reset":
      return { page: 1, items: [], total: 0 };
    case "loaded": {
      if (action.page !== state.page) return state;
      if (action.page === 1) return { page: state.page, items: action.items, total: action.total };
      const existingIds = new Set(state.items.map((i) => i.id));
      const fresh = action.items.filter((i) => !existingIds.has(i.id));
      return { page: state.page, items: [...state.items, ...fresh], total: action.total };
    }
    case "nextPage":
      return { page: state.page + 1, items: state.items, total: state.total };
  }
}

export interface UseLoadMoreResult<T> {
  items: T[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
}

export function useLoadMore<T extends { id: string }>(
  queryKey: QueryKey,
  queryFn: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
  // Match the endpoint's own default page size. A mismatch makes the server
  // report a last_page the client's page counter cannot reach.
  batchSize = DEFAULT_BATCH_SIZE,
): UseLoadMoreResult<T> {
  const [state, dispatch] = useReducer(loadMoreReducer, { page: 1, items: [], total: 0 });

  const query = useQuery({
    queryKey: [...queryKey, state.page],
    queryFn: () => queryFn(state.page, batchSize),
  });

  const serializedKey = JSON.stringify(queryKey);
  useEffect(() => {
    dispatch({ type: "reset" });
  }, [serializedKey]);

  useEffect(() => {
    if (!query.data || query.data.page !== state.page) return;
    dispatch({
      type: "loaded",
      page: query.data.page,
      items: query.data.items,
      total: query.data.total,
    });
  }, [query.data, state.page]);

  const loadMore = useCallback(() => {
    if (query.data && state.page < query.data.last_page) {
      dispatch({ type: "nextPage" });
    }
  }, [query.data, state.page]);

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  return {
    items: state.items as T[],
    total: state.total,
    isLoading: query.isLoading && state.page === 1 && state.items.length === 0,
    isError: query.isError,
    isFetchingNextPage: query.isFetching && state.page > 1,
    hasMore: query.data ? state.page < query.data.last_page : false,
    loadMore,
    reset,
  };
}
