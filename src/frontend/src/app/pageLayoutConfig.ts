import type { IconName, PageId } from "./routes";

export type PageLayoutConfig = {
  title: string;
  description?: string;
  icon?: IconName;
  showBackButton: boolean;
};

export const pageLayoutConfig: Record<PageId, PageLayoutConfig> = {
  home: { title: "¡Hola, invocador!", description: "¿Qué quieres hacer hoy?", showBackButton: false },
  teams: { title: "Crear equipos", icon: "shuffle", showBackButton: true },
  draft: { title: "Draft Fearless", icon: "shield", showBackButton: true },
  roulette: { title: "Ruleta de campeones", icon: "sparkles", showBackButton: true },
  history: { title: "Historial", icon: "history", showBackButton: true },
  settings: { title: "Ajustes", icon: "settings", showBackButton: true },
};
