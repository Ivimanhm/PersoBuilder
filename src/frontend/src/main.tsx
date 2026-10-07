import { render } from "preact";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { App } from "./app/App";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./pages/home/home.css";
import "./pages/draft/draft.css";
import "./styles/global.css";
import "./pages/settings/settings.css";
import "./pages/teams/teams.css";
import "./pages/roulette/roulette.css";
import "./pages/history/history.css";
import "./components/TeamTable/team-table.css";
import "./layouts/app-layout.css";
import "./styles/desktop.css";
import "./pages/welcome/welcome-desktop.css";

// El token de escritura ya no se usa; elimina cualquier valor guardado por versiones anteriores.
try { localStorage.removeItem("perso-builder-write-api-token"); } catch { /* Almacenamiento no disponible. */ }

render(<App />, document.getElementById("app")!);

if (isTauri()) {
  void invoke<boolean>("is_desktop_app").then(async (desktop) => {
    if (desktop) {
      document.documentElement.dataset.desktopApp = "true";
      if (await invoke<boolean>("is_windows_app")) document.documentElement.dataset.desktopPlatform = "windows";
    }
  }).catch((error) => console.error("No se pudo detectar el modo de escritorio", error));
}
