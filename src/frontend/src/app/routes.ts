export type PageId =
  | "home"
  | "teams"
  | "draft"
  | "roulette"
  | "history"
  | "settings";

export type IconName =
  | "home"
  | "shuffle"
  | "shield"
  | "sparkles"
  | "settings"
  | "database"
  | "cloud"
  | "arrow"
  | "history"
  | "refresh"
  | "back";

export const navigationItems: { id: PageId; icon: IconName; label: string }[] = [
  { id: "home", icon: "home", label: "Inicio" },
  { id: "teams", icon: "shuffle", label: "Equipos" },
  { id: "draft", icon: "shield", label: "Draft" },
  { id: "roulette", icon: "sparkles", label: "Ruleta" },
  { id: "settings", icon: "settings", label: "Ajustes" },
];

export function getPreviewPage(): PageId | null {
  const page = new URLSearchParams(window.location.search).get("preview") as PageId | null;
  return page === "history" || navigationItems.some((item) => item.id === page)
    ? page
    : null;
}
