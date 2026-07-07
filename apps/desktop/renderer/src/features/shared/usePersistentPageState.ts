import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

interface PersistedEnvelope<T> {
  readonly version: number;
  readonly value: T;
}

interface PersistentPageStateOptions<T> {
  readonly key: string;
  readonly version: number;
  readonly defaultValue: T | (() => T);
  readonly migrate?: (value: unknown, version: number) => T | null;
  readonly validate?: (value: unknown) => value is T;
}

function resolveDefault<T>(defaultValue: T | (() => T)): T {
  return typeof defaultValue === "function" ? (defaultValue as () => T)() : defaultValue;
}

function readStoredValue<T>(options: PersistentPageStateOptions<T>): T {
  if (typeof window === "undefined") {
    return resolveDefault(options.defaultValue);
  }

  try {
    const raw = window.localStorage.getItem(options.key);
    if (!raw) {
      return resolveDefault(options.defaultValue);
    }

    const parsed = JSON.parse(raw) as PersistedEnvelope<unknown>;
    if (parsed && typeof parsed === "object" && "version" in parsed && "value" in parsed) {
      if (parsed.version === options.version) {
        if (!options.validate || options.validate(parsed.value)) {
          return parsed.value as T;
        }
        return resolveDefault(options.defaultValue);
      }

      const migrated = options.migrate?.(parsed.value, Number(parsed.version));
      if (migrated !== null && migrated !== undefined) {
        return migrated;
      }
    }
  } catch {
    return resolveDefault(options.defaultValue);
  }

  return resolveDefault(options.defaultValue);
}

export function usePersistentPageState<T>(
  options: PersistentPageStateOptions<T>,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const stableOptions = useMemo(() => options, [options.key, options.version]);
  const [value, setValue] = useState<T>(() => readStoredValue(stableOptions));

  useEffect(() => {
    try {
      const envelope: PersistedEnvelope<T> = {
        version: stableOptions.version,
        value,
      };
      window.localStorage.setItem(stableOptions.key, JSON.stringify(envelope));
    } catch {
      // Storage persistence is best-effort; UI state must remain usable without it.
    }
  }, [stableOptions.key, stableOptions.version, value]);

  const reset = () => {
    const next = resolveDefault(stableOptions.defaultValue);
    setValue(next);
    try {
      window.localStorage.removeItem(stableOptions.key);
    } catch {
      // ignore storage failures
    }
  };

  return [value, setValue, reset];
}
