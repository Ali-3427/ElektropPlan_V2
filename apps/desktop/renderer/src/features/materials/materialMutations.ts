import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MaterialAssignment, MaterialCategory, Material } from "../../bridge/types";
import { getBridge } from "../../bridge/client";
import { MATERIAL_QUERIES } from "./useMaterialsData";

export function useMaterialMutations() {
  const qc = useQueryClient();

  function invalidate() {
    return qc.invalidateQueries({ queryKey: ["materials"] });
  }

  const upsertCategory = useMutation({
    mutationFn: (cat: MaterialCategory) => getBridge().materials.upsertCategory(cat),
    onSuccess: invalidate,
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => getBridge().materials.deleteCategory(id),
    onSuccess: invalidate,
  });

  const upsertMaterial = useMutation({
    mutationFn: (material: Material) => getBridge().materials.upsert(material),
    onSuccess: invalidate,
  });

  const deleteMaterial = useMutation({
    mutationFn: (id: string) => getBridge().materials.delete(id),
    onSuccess: invalidate,
  });

  const importExcel = useMutation({
    mutationFn: ({ filePath, mode = "merge" }: { filePath: string; mode?: "merge" }) =>
      getBridge().materials.importExcel(filePath, mode),
    onSuccess: invalidate,
  });

  const upsertAssignment = useMutation({
    mutationFn: (assignment: MaterialAssignment) =>
      getBridge().assignments.upsert(assignment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });

  const deleteAssignment = useMutation({
    mutationFn: (id: string) => getBridge().assignments.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });

  return {
    upsertCategory,
    deleteCategory,
    upsertMaterial,
    deleteMaterial,
    importExcel,
    upsertAssignment,
    deleteAssignment,
  };
}

export { MATERIAL_QUERIES };
