import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  navigationItems,
  type PageId,
} from "../app/routes";
import { Logo } from "../components/Logo/Logo";
import { UiIcon } from "../components/UiIcon/UiIcon";
import { PageHeader } from "../components/PageHeader/PageHeader";
import type { PageLayoutConfig } from "../app/pageLayoutConfig";
import {
  activateLocalMode,
  checkApiHealth,
  getConnectionStatus,
  subscribeToConnectionStatus,
} from "../services/connectionStatus";
import { getApiUrl } from "../services/appSettings";

function AppHeader({ activePage }: { activePage: PageId }) {
  const [connectionStatus, setConnectionStatus] = useState(getConnectionStatus);
  const [checkingMode, setCheckingMode] = useState(false);
  const [modeMessage, setModeMessage] = useState("");
  useEffect(() => subscribeToConnectionStatus(setConnectionStatus), []);
  const online = connectionStatus === "online";
  const toggleMode = async () => {
    if (checkingMode) return;
    setModeMessage("");
    if (online) {
      activateLocalMode();
      return;
    }
    setCheckingMode(true);
    const result = await checkApiHealth(getApiUrl());
    if (result.status !== "online") {
      activateLocalMode();
      setModeMessage("No ha sido posible conectar con la API. La aplicación continúa en modo Local.");
    }
    setCheckingMode(false);
  };
  return (
    <header className="app-header">
      <div className="header-brand">
        <Logo />
        <span>
          <strong>PersoBuilder</strong>
          <small>
            {activePage === "draft" ? "PERSONAL DRAFT" : "TU DRAFT, MIS REGLAS"}
          </small>
        </span>
      </div>
      <button
        className={`local-status ${online ? "online-status" : ""}`}
        type="button"
        disabled={checkingMode}
        aria-busy={checkingMode}
        aria-label={online ? "Cambiar a modo Local" : "Cambiar a modo Online"}
        onClick={toggleMode}
      >
        {checkingMode
          ? <i className="ui-icon bi bi-arrow-repeat connection-mode-spinner" aria-hidden="true" />
          : <UiIcon name={online ? "cloud" : "database"} />}
        <span>
          <small>MODO</small>
          <strong>{checkingMode ? "..." : online ? "ONLINE" : "LOCAL"}</strong>
        </span>
      </button>
      {modeMessage && (
        <div className="connection-mode-notice" role="alert">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
          <span>{modeMessage}</span>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setModeMessage("")}>
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
      )}
    </header>
  );
}

function Navigation({
  activePage,
  onNavigate,
}: {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}) {
  return (
    <nav className="navigation" aria-label="Navegación principal">
      {navigationItems.map((item) => (
        <button
          key={item.id}
          className={item.id === activePage ? "nav-item active" : "nav-item"}
          type="button"
          aria-current={item.id === activePage ? "page" : undefined}
          onClick={() => onNavigate(item.id)}
        >
          <UiIcon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function AppLayout({
  activePage,
  onNavigate,
  page,
  children,
}: {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  page: PageLayoutConfig;
  children: ComponentChildren;
}) {
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activePage]);

  return (
    <div className="app-shell" data-layout="app">
      <AppHeader activePage={activePage} />
      <main
        ref={contentRef}
        className="app-content"
        data-app-scroll-container
      >
        <section className="app-page-bar" aria-label="Encabezado de página">
          <div className="app-page-bar-inner">
            <PageHeader
              title={page.title}
              description={page.description}
              icon={page.icon}
              onBack={page.showBackButton ? () => onNavigate("home") : undefined}
            />
          </div>
        </section>
        <div className="app-content-inner">{children}</div>
      </main>
      <footer className="app-footer">
        <Navigation activePage={activePage} onNavigate={onNavigate} />
      </footer>
    </div>
  );
}
