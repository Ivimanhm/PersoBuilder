import type { IconName } from "../../app/routes";

const icons: Record<IconName, string> = {
  home: "house-fill",
  shuffle: "shuffle",
  shield: "shield-check",
  sparkles: "stars",
  settings: "gear",
  database: "database-check",
  cloud: "cloud-check-fill",
  arrow: "chevron-right",
  history: "clock-history",
  refresh: "arrow-clockwise",
  back: "chevron-left",
};

export function UiIcon({ name }: { name: IconName }) {
  return <i className={`ui-icon bi bi-${icons[name]}`} aria-hidden="true" />;
}
