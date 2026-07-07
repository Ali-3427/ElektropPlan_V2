import { useQuery } from "@tanstack/react-query";
import { getBridge } from "../../bridge/client";

export function useRecordAssignments(recordIds: readonly string[]) {
  const sorted = [...recordIds].sort();
  return useQuery({
    queryKey: ["assignments", sorted],
    queryFn: () =>
      recordIds.length
        ? getBridge().assignments.listForRecords([...recordIds])
        : Promise.resolve([]),
    enabled: recordIds.length > 0,
  });
}
