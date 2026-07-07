import type { ReactNode } from "react";
import type { ManualCurrentDraft } from "../useGroupDrafts";

export interface ManualCurrentFormClassNames {
  readonly form?: string | undefined;
  readonly input?: string | undefined;
  readonly actions?: string | undefined;
}

export interface ManualCurrentNumericFieldProps {
  readonly type: "text" | "number";
  readonly inputMode?: "decimal" | "numeric" | undefined;
  readonly min?: number | undefined;
  readonly step?: number | "any" | undefined;
}

interface ManualCurrentFormProps {
  readonly value: ManualCurrentDraft;
  readonly onChange: (patch: Partial<ManualCurrentDraft>) => void;
  readonly onSubmit: () => void;
  readonly onCancel?: () => void;
  readonly disabled?: boolean;
  readonly classNames?: ManualCurrentFormClassNames;
  /** Native input attrs for the current-A field; defaults preserve `type="text" inputMode="decimal"`. */
  readonly currentAField?: ManualCurrentNumericFieldProps;
  /** Native input attrs for the quantity field; defaults preserve `type="text" inputMode="decimal"`. */
  readonly quantityField?: ManualCurrentNumericFieldProps;
  readonly renderSubmit: (props: { onClick: () => void; disabled: boolean }) => ReactNode;
  readonly renderCancel?: (props: { onClick: () => void }) => ReactNode;
}

const DEFAULT_NUMERIC_FIELD: ManualCurrentNumericFieldProps = { type: "text", inputMode: "decimal" };

function isManualDraftValid(value: ManualCurrentDraft): boolean {
  const currentA = Number(value.currentA);
  return Number.isFinite(currentA) && currentA > 0;
}

/**
 * Three-input inline form for adding a manual current entry to a group:
 * label, current (A), and quantity. Shared between `ProjectsPage` and
 * `ProjectQuickPanel`, which each pass their own classNames/button renderers
 * (and, where they differ, native field attrs) to preserve their existing
 * markup and styling.
 */
export function ManualCurrentForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  disabled,
  classNames,
  currentAField = DEFAULT_NUMERIC_FIELD,
  quantityField = DEFAULT_NUMERIC_FIELD,
  renderSubmit,
  renderCancel,
}: ManualCurrentFormProps) {
  const isValid = isManualDraftValid(value);

  return (
    <div className={classNames?.form}>
      <input
        className={classNames?.input}
        type="text"
        autoFocus
        placeholder="Etiket (örn. Aydınlatma)"
        value={value.label}
        onChange={(event) => onChange({ label: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
          if (event.key === "Escape") onCancel?.();
        }}
        disabled={disabled}
      />
      <input
        className={classNames?.input}
        type={currentAField.type}
        inputMode={currentAField.inputMode}
        min={currentAField.min}
        step={currentAField.step}
        placeholder="Akım (A)"
        value={value.currentA}
        onChange={(event) => onChange({ currentA: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
          if (event.key === "Escape") onCancel?.();
        }}
        disabled={disabled}
      />
      <input
        className={classNames?.input}
        type={quantityField.type}
        inputMode={quantityField.inputMode}
        min={quantityField.min}
        step={quantityField.step}
        placeholder="Adet"
        value={value.quantity}
        onChange={(event) => onChange({ quantity: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
          if (event.key === "Escape") onCancel?.();
        }}
        disabled={disabled}
      />
      <div className={classNames?.actions}>
        {renderCancel && onCancel ? renderCancel({ onClick: onCancel }) : null}
        {renderSubmit({ onClick: onSubmit, disabled: Boolean(disabled) || !isValid })}
      </div>
    </div>
  );
}
