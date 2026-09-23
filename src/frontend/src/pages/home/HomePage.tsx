import type { IconName, PageId } from "../../app/routes";
import { UiIcon } from "../../components/UiIcon/UiIcon";

const actions: {
  title: string;
  copy: string;
  icon: IconName;
  tone: string;
  target: PageId;
}[] = [
  {
    title: "Crear equipos",
    copy: "Sortea campeones y prepara una partida equilibrada.",
    icon: "shuffle",
    tone: "gold",
    target: "teams",
  },
  {
    title: "Modo Draft",
    copy: "Simula un draft completo paso a paso.",
    icon: "shield",
    tone: "blue",
    target: "draft",
  },
  {
    title: "Ruleta de campeones",
    copy: "Elige una posición y deja que la suerte decida.",
    icon: "sparkles",
    tone: "pink",
    target: "roulette",
  },
  {
    title: "Historial",
    copy: "Revisa tus equipos anteriores y guarda tus mejores drafts.",
    icon: "history",
    tone: "green",
    target: "history",
  },
  {
    title: "Ajustes",
    copy: "Personaliza la experiencia a tu medida.",
    icon: "settings",
    tone: "slate",
    target: "settings",
  },
];

export function HomePage({
  onNavigate,
}: {
  onNavigate: (page: PageId) => void;
}) {
  return (
    <section className="app-page home-page">
      <div className="action-list">
        {actions.map((action) => (
          <button
            key={action.target}
            className={`action-card ${action.tone}`}
            type="button"
            onClick={() => onNavigate(action.target)}
          >
            <span className="action-icon">
              <UiIcon name={action.icon} />
            </span>
            <span className="action-copy">
              <strong>{action.title}</strong>
              <small>{action.copy}</small>
            </span>
            <UiIcon name="arrow" />
          </button>
        ))}
      </div>
    </section>
  );
}
