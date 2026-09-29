import type { ComponentChildren } from "preact";

type TextFieldProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "url" | "search" | "password";
  id?: string;
  containerClassName?: string;
  prefix?: ComponentChildren;
  ariaLabel?: string;
};

/** Controlled text input with an optional visual prefix. */
export function TextField({
  value,
  onValueChange,
  placeholder,
  type = "text",
  id,
  containerClassName = "",
  prefix,
  ariaLabel,
}: TextFieldProps) {
  return (
    <label className={containerClassName}>
      {prefix}
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onInput={(event) => onValueChange(event.currentTarget.value)}
      />
    </label>
  );
}
