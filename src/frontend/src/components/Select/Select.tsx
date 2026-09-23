type SelectOption<T extends string> = { value: T; label: string };

type SelectProps<T extends string> = {
  value: T;
  options: SelectOption<T>[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
};

/** Controlled select input used by form fields across pages. */
export function Select<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  className,
}: SelectProps<T>) {
  return (
    <select
      className={className}
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onValueChange(event.currentTarget.value as T)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
