import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@app/store";
import { canAccess, Role } from "@shared/auth/role";
import { api } from "@shared/api/client";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import type {
  PaginatedResponse,
  ReferenceResource,
  ReferenceRow,
  ReferenceStatus,
} from "@shared/types/api";

/**
 * Reference-data lookups (credential types, issuer organizations, competencies)
 * and the create-by-name (upsert) mutation.
 *
 * Lives in shared so `SearchableCreateSelect` can consume it without breaking
 * the module boundary rule (feature → shared only). The credential feature
 * re-exports these as `src/feature/credential/api/useReferenceData.ts`.
 */

export interface ReferenceQuery {
  search?: string;
  status?: ReferenceStatus;
  activeOnly?: boolean;
  active?: boolean;
}

export const referenceKeys = {
  /** Prefix covering every page and search variant of one resource. */
  all: (resource: ReferenceResource) => ["reference", resource] as const,
  page: (resource: ReferenceResource, query?: ReferenceQuery | string) => {
    const q: ReferenceQuery = typeof query === "string" ? { search: query } : (query ?? {});
    return [
      "reference",
      resource,
      "page",
      {
        search: q.search?.trim() || undefined,
        status: q.status || undefined,
        active: q.active ?? (q.activeOnly ? true : undefined),
      },
    ] as const;
  },
  byIds: (resource: ReferenceResource, ids: string[]) =>
    ["reference", resource, "byIds", [...ids].sort()] as const,
};

const RESOURCE_PATH: Record<ReferenceResource, string> = {
  "credential-types": "/credential-types",
  // Backend group is `/issuer-organizations` (see CredChain_Golang router.go).
  "credential-issuer-organizations": "/issuer-organizations",
  competencies: "/competencies",
};

/**
 * Page sizes must match each handler's own default (credential_type_handler.go,
 * competency_handler.go). A client limit the server does not echo makes the
 * envelope's last_page disagree with the client's page counter.
 */
const RESOURCE_PAGE_SIZE: Record<ReferenceResource, number> = {
  "credential-types": 100,
  "credential-issuer-organizations": 100,
  competencies: 50,
};

/**
 * Paginated, server-searched reference list. Keep loaded pages in the query
 * cache so invalidation replaces every page when a row leaves the filter.
 */
export function useReferencePage(resource: ReferenceResource, query: ReferenceQuery = {}) {
  const search = query.search?.trim() || undefined;
  const status = query.status;
  const active = query.active ?? (query.activeOnly ? true : undefined);

  const user = useStore((s) => s.user);
  const queryClient = useQueryClient();
  const queryKey = [...referenceKeys.page(resource, query), user?.id, user?.role];
  const list = useInfiniteQuery<PaginatedResponse<ReferenceRow>>({
    queryKey,
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.last_page ? lastPage.page + 1 : undefined,
    queryFn: async ({ pageParam, signal }) => {
      const params: Record<string, unknown> = {
        page: pageParam,
        limit: RESOURCE_PAGE_SIZE[resource],
      };
      if (search) params.search = search;
      const filters: string[] = [];
      if (status) filters.push(`status=${status}`);
      if (active !== undefined) filters.push(`active=${active}`);
      if (filters.length > 0) params.filters = filters;

      const response = await api.get<PaginatedResponse<ReferenceRow>>(RESOURCE_PATH[resource], {
        params,
        signal,
      });
      return response.data;
    },
  });

  const items = [
    ...new Map(list.data?.pages.flatMap((page) => page.items).map((row) => [row.id, row])).values(),
  ];
  return {
    items,
    total: list.data?.pages[0]?.total ?? 0,
    isLoading: list.isLoading,
    isError: list.isError,
    isFetchingNextPage: list.isFetchingNextPage,
    hasMore: list.hasNextPage,
    loadMore: () => {
      if (!list.isFetching && list.hasNextPage) void list.fetchNextPage();
    },
    reset: () => void queryClient.resetQueries({ queryKey, exact: true }),
  };
}

/**
 * Resolves specific rows by id through the existing `id$a,b,c` IN filter.
 *
 * Selected ids can live past the loaded page once these endpoints paginate, so
 * a chip would otherwise render a raw id. Disabled on an empty array — an
 * unfiltered request would return the whole first page and pretend it matched.
 */
export function useReferenceByIds(resource: ReferenceResource, ids: string[]) {
  const user = useStore((s) => s.user);
  return useQuery({
    queryKey: [...referenceKeys.byIds(resource, ids), user?.id, user?.role],
    enabled: ids.length > 0,
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<ReferenceRow>>(RESOURCE_PATH[resource], {
        params: { filters: [`id$${ids.join(",")}`], limit: 100 },
      });
      return response.data.items;
    },
  });
}

export function useReferencePendingCount(resource: ReferenceResource) {
  const user = useStore((s) => s.user);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: [...referenceKeys.all(resource), "pending-count", user?.id, user?.role],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PaginatedResponse<ReferenceRow>>(RESOURCE_PATH[resource], {
        params: { limit: 1, filters: ["status=pending"] },
        signal,
      });
      return data.total;
    },
    enabled: isAuthenticated && !!user?.id && canAccess(user.role, Role.ISSUER),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useUpsertReference(resource: ReferenceResource) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post<ReferenceRow>(RESOURCE_PATH[resource], { name });
      return response.data;
    },
    onSuccess: () => {
      // Prefix invalidation: every cached page, search term and by-ids lookup
      // for this resource is stale once a row is created or renamed.
      void queryClient.invalidateQueries({ queryKey: referenceKeys.all(resource) });
    },
    onError: (error) => {
      if (isApiError(error)) {
        notify.error(error.messageKey);
      } else {
        notify.error("cred.submit.createError");
      }
    },
  });
}

export function useSubmitReference(resource: ReferenceResource) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post<ReferenceRow>(`${RESOURCE_PATH[resource]}/submit`, { name });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: referenceKeys.all(resource) });
      notify.success("cred.references.submitSuccess");
    },
    onError: (error) => {
      if (isApiError(error)) {
        notify.error(error.messageKey);
      } else {
        notify.error("cred.references.submitError");
      }
    },
  });
}

export function useApproveReference(resource: ReferenceResource) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<ReferenceRow>(`${RESOURCE_PATH[resource]}/${id}/approve`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: referenceKeys.all(resource) });
      notify.success("cred.references.approveSuccess");
    },
    onError: (error) => {
      if (isApiError(error)) {
        notify.error(error.messageKey);
      } else {
        notify.error("cred.references.approveError");
      }
    },
  });
}

export function useRejectReference(resource: ReferenceResource) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, rejection_reason }: { id: string; rejection_reason: string }) => {
      const response = await api.post<ReferenceRow>(`${RESOURCE_PATH[resource]}/${id}/reject`, {
        rejection_reason,
      });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: referenceKeys.all(resource) });
      notify.success("cred.references.rejectSuccess");
    },
    onError: (error) => {
      if (isApiError(error)) {
        notify.error(error.messageKey);
      } else {
        notify.error("cred.references.rejectError");
      }
    },
  });
}
