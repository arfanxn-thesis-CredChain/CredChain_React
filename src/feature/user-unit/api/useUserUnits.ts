import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/api/client";
import type { HolderUnitDTO } from "@shared/types/api";
import { userUnitKeys } from "./keys";

export function useUserUnits() {
  return useQuery({
    queryKey: userUnitKeys.list(),
    queryFn: async () => {
      const response = await api.get<HolderUnitDTO[]>("/user-units");
      return response.data;
    },
  });
}
