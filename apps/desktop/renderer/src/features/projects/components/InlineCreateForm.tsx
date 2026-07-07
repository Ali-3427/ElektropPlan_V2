import type { ReactNode } from "react";

export interface InlineCreateFormClassNames {
  readonly form?: string | undefined;
  readonly input?: string | undefined;
  readonly actions?: string | undefined;
}

interface InlineCreateFormProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onCancel?: () => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly classNames?: InlineCreateFormClassNames;
  readonly renderSubmit: (props: { onClick: () => void; disabled: boolean }) => ReactNode;
  readonly renderCancel?: (props: { onClick: () => void }) => ReactNode;
}

/**
 * Repeated "single input + submit button" inline form pattern used for
 * create-project, create-group, and duplicate-group. Shared between
 * `ProjectsPage` and `ProjectQuickPanel`, which each supply their own
 * classNames/button renderers to preserve their existing markup and styling.
 */
export function InlineCreateForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  disabled,
  classNames,
  renderSubmit,
  renderCancel,
}: InlineCreateFormProps) {
  return (
    <div className={classNames?.form}>
      <input
        className={classNames?.input}
        type="text"
        autoFocus
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
          if (event.key === "Escape") onCancel?.();
        }}
        disabled={disabled}
      />
      <div className={classNames?.actions}>
        {renderCancel && onCancel ? renderCancel({ onClick: onCancel }) : null}
        {renderSubmit({ onClick: onSubmit, disabled: Boolean(disabled) || value.trim().length === 0 })}
      </div>
    </div>
  );
}
