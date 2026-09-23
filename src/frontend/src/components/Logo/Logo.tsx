export function Logo({ large = false }: { large?: boolean }) {
  return (
    <span className={`logo-mark${large ? " logo-large" : ""}`} aria-hidden="true">
      <img src="/brand/Logo.png?v=20260917" alt="" />
    </span>
  );
}
