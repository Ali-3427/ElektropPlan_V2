import { useQuery } from "@tanstack/react-query";
import { getBridge, isBridgeAvailable } from "../bridge/client";
import { queryKeys } from "../query/keys";

export function useAppVersion() {
  return useQuery({
    queryKey: queryKeys.appVersion,
    queryFn: () => getBridge().app.version(),
    enabled: isBridgeAvailable(),
    staleTime: Infinity,
  });
}
