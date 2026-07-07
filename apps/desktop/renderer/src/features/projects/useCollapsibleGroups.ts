import { useCallback, useState } from "react";

function readExpandedIds(storageKey: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === "string");
    }
  } catch {
    // Best-effort: corrupt storage falls back to all-collapsed.
  }
  return [];
}

/**
 * Collapsible group state persisted to localStorage. Groups default to
 * collapsed; an id is present in storage only while expanded.
 */
export function useCollapsibleGroups(storageKey: string) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(readExpandedIds(storageKey)),
  );

  const persist = useCallback(
    (next: Set<string>) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Persistence is best-effort; UI must remain usable without it.
      }
    },
    [storageKey],
  );

  const isExpanded = useCallback(
    (groupId: string) => expandedIds.has(groupId),
    [expandedIds],
  );

  const toggle = useCallback(
    (groupId: string) => {
      setExpandedIds((current) => {
        const next = new Set(current);
        if (next.has(groupId)) {
          next.delete(groupId);
        } else {
          next.add(groupId);
        }
        persist(next);
        return next;
      });
    },
    [persist],
  );

  return { isExpanded, toggle };
}
