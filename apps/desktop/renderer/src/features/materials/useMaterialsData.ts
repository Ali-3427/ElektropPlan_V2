import { useQuery } from "@tanstack/react-query";
import { getBridge } from "../../bridge/client";

export const MATERIAL_QUERIES = {
  categories: ["materials", "categories"] as const,
  materials: (filter: { categoryId?: string; search?: string }) =>
    ["materials", "list", filter] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: MATERIAL_QUERIES.categories,
    queryFn: () => getBridge().materials.listCategories(),
  });
}

export function useMaterials(filter: { categoryId?: string; search?: string }) {
  return useQuery({
    queryKey: MATERIAL_QUERIES.materials(filter),
    queryFn: () => getBridge().materials.list(filter),
  });
}
