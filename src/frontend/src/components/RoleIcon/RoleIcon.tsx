import type { Role } from "../../types";
import "./RoleIcon.css";

export function RoleIcon({ role }: { role: Role }) {
  return (
    <span
      className="role-icon"
      style={{ "--role-icon": `url('/icons/roles/${role}.svg')` }}
      aria-hidden="true"
    />
  );
}
