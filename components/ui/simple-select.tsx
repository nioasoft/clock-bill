"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Radix Select forbids `value=""` on items, but our forms use the empty
 * string for "no selection" / "none" options. We map "" to this sentinel on
 * the way in and back to "" on the way out, so callers keep a native-like
 * string `value`/`onChange` API.
 */
const EMPTY_SENTINEL = "__empty__";

export interface SimpleSelectOption {
  value: string;
  label: string;
}

export interface SimpleSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SimpleSelectOption[];
  /** Shown in the trigger when nothing is selected and no option has value "". */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Drop-in replacement for a styled native `<select>`, backed by the shadcn
 * (Radix) Select so the dropdown is portal-positioned and anchored to the
 * field — native selects inside dialogs open misaligned on iOS.
 */
export function SimpleSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  "aria-label": ariaLabel,
}: SimpleSelectProps) {
  const hasEmptyOption = options.some((o) => o.value === "");
  // Pass "" through (Radix shows the placeholder for it) rather than
  // `undefined`, which would flip the Root to uncontrolled and ignore form
  // resets. Only remap when "" is an actual selectable option.
  const radixValue = value === "" && hasEmptyOption ? EMPTY_SENTINEL : value;

  return (
    <Select
      value={radixValue}
      onValueChange={(v) => onChange(v === EMPTY_SENTINEL ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value === "" ? EMPTY_SENTINEL : option.value}
            value={option.value === "" ? EMPTY_SENTINEL : option.value}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
