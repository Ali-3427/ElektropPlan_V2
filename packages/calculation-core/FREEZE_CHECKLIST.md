# Calculation Core Freeze Checklist

- [x] `ENGINE_VERSION` is defined centrally in `src/version.ts`.
- [x] Public package entrypoint uses explicit named re-exports only.
- [x] Package manifest exports resolve to compiled `dist` entrypoints.
- [x] Calculation result wrappers stamp `engineVersion` from the shared constant.
- [x] No DTO shape changes were introduced.
- [x] No calculation behavior changes were introduced beyond version wiring.
