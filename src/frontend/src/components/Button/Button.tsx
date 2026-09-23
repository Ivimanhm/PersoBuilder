import type { ComponentChildren } from "preact";
import "./Button.css";

type ButtonProps = {
  children: ComponentChildren;
  className?: string;
  variant?: "gold" | "plain";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
};

/** Shared button primitive. Page-specific classes can extend its appearance. */
export function Button({
  children,
  className = "",
  variant = "plain",
  type = "button",
  disabled = false,
  onClick,
  ariaLabel,
}: ButtonProps) {
  return (
    <button
      className={`${variant === "gold" ? "gold-button" : ""}${className ? ` ${className}` : ""}`}
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
