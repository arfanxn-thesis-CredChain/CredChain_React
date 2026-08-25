import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import { useLoadMore } from "@shared/hooks/useLoadMore";
import { notify } from "@shared/lib/notify";
import { isApiError } from "@shared/api/envelope";
import type { PaginatedResponse, ReferenceResource, ReferenceRow } from "@shared/types/api";

/**
 * Reference-data lookups (credential types, issuer organizations, competencies)
 * and the create-by-name (upsert) mutation.
 *
 * Lives in shared so `SearchableCreateSelect` can consume it without breaking
 * the module boundary rule (feature → shared only). The credential feature
 * re-exports these as `src/feature/credential/api/useReferenceData.ts`.
 */

export const referenceKeys = {
  /** Prefix covering every page and search variant of one resource. */
  all: (resource: ReferenceResource) => ["reference", resource] as const,
  page: (resource: ReferenceResource, search?: string) =>
    ["reference", resource, "page", { search: search || undefined }] as const,
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

export interface ReferenceQuery {
  search?: string;
}

/**
 * Paginated, server-searched list of one reference resource. Accumulates pages
 * the same way the user and credential lists do; changing `search` resets to
 * page 1 because the query key changes.
 */
export function useReferencePage(resource: ReferenceResource, query: ReferenceQuery = {}) {
  const search = query.search?.trim() || undefined;
  return useLoadMore<ReferenceRow>(
    referenceKeys.page(resource, search),
    async (page, limit) => {
      const params: Record<string, unknown> = { page, limit };
      if (search) params.search = search;
      const response = await api.get<PaginatedResponse<ReferenceRow>>(RESOURCE_PATH[resource], {
        params,
      });
      return response.data;
    },
    RESOURCE_PAGE_SIZE[resource],
  );
}

/**
 * Resolves specific rows by id through the existing `id$a,b,c` IN filter.
 *
 * Selected ids can live past the loaded page once these endpoints paginate, so
 * a chip would otherwise render a raw id. Disabled on an empty array — an
 * unfiltered request would return the whole first page and pretend it matched.
 */
export function useReferenceByIds(resource: ReferenceResource, ids: string[]) {
  return useQuery({
    queryKey: referenceKeys.byIds(resource, ids),
    enabled: ids.length > 0,
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<ReferenceRow>>(RESOURCE_PATH[resource], {
        params: { filters: [`id$${ids.join(",")}`], limit: 100 },
      });
      return response.data.items;
    },
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
