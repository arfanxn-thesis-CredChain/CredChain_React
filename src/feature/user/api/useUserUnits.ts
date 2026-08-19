import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import type { HolderUnitDTO } from "@shared/types/api";

const USER_UNIT_KEYS = { list: () => ["user-units"] as const };

export function useUserUnits() {
  return useQuery({
    queryKey: USER_UNIT_KEYS.list(),
    queryFn: async () => {
      const response = await api.get<HolderUnitDTO[]>("/user-units", { params: { limit: 100 } });
      return response.data;
    },
  });
}
