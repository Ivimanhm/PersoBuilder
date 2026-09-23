import type { ComponentChildren } from "preact";

export type SegmentedOption<T extends string | number> = { value: T; label: ComponentChildren };

export function SegmentedControl<T extends string | number>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button key={String(option.value)} type="button" className={option.value === value ? "selected" : ""} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
import "./SegmentedControl.css";
