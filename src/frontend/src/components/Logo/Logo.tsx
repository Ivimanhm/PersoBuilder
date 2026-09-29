export function Logo({ large = false }: { large?: boolean }) {
  return (
    <span className={`logo-mark${large ? " logo-large" : ""}`} aria-hidden="true">
      <img src="/Logo.png?v=20260927" alt="" />
    </span>
  );
}
