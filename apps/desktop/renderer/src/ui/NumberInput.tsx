import { useEffect, useState } from "react";

import { formatNumberTr, parseNumberTr } from "../i18n/format";
import styles from "./Input.module.css";

interface NumberInputProps {
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  min?: number;
  step?: number;
  id?: string;
  ariaLabel?: string;
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  invalid,
  disabled,
  id,
  ariaLabel,
}: NumberInputProps) {
  const [text, setText] = useState<string>(value === null ? "" : formatNumberTr(value));

  useEffect(() => {
    // Sync only when committed numeric value changes from outside and doesn't match current text.
    const parsed = parseNumberTr(text);
    if (parsed !== value) {
      setText(value === null ? "" : formatNumberTr(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      id={id}
      aria-label={ariaLabel}
      type="text"
      inputMode="decimal"
      className={`${styles.input} ${invalid ? styles.invalid : ""}`}
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        // Allow only digits, dot, comma, minus
        if (!/^-?[\d.,]*$/.test(raw)) return;
        setText(raw);
        onChange(parseNumberTr(raw));
      }}
      onBlur={() => {
        const parsed = parseNumberTr(text);
        setText(parsed === null ? "" : formatNumberTr(parsed));
      }}
    />
  );
}
