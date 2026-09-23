import { Logo } from "../../components/Logo/Logo";
import { UiIcon } from "../../components/UiIcon/UiIcon";

export function WelcomePage({ onStart }: { onStart: () => void }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-hero">
        <Logo large />
      </div>
      <div className="welcome-copy">
        <h1>
          <span>Perso</span> Builder
        </h1>
        <div className="welcome-tagline">TU DRAFT, MIS REGLAS</div>
        <div className="gold-divider">
          <i />
        </div>
        <button
          className="gold-button welcome-button"
          type="button"
          onClick={onStart}
        >
          Comenzar <UiIcon name="arrow" />
        </button>
      </div>
    </div>
  );
}
