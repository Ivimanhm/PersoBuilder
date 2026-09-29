import { AppLayout } from "../layouts/AppLayout";
import { DraftPage } from "../pages/draft/DraftPage";
import { HistoryPage } from "../pages/history/HistoryPage";
import { HomePage } from "../pages/home/HomePage";
import { RoulettePage } from "../pages/roulette/RoulettePage";
import { SettingsPage } from "../pages/settings/SettingsPage";
import { TeamsPage } from "../pages/teams/TeamsPage";
import { WelcomePage } from "../pages/welcome/WelcomePage";
import { pageLayoutConfig } from "./pageLayoutConfig";
import { useAppNavigation } from "./useAppNavigation";
import { useChampionCatalog } from "./useChampionCatalog";
import { useTeamGeneration } from "./useTeamGeneration";
import { useVirtualKeyboardViewport } from "./useVirtualKeyboardViewport";
import { useEffect } from "preact/hooks";
import { getConnectionStatus, refreshConnectionStatusIfStale, subscribeToConnectionStatus } from "../services/connectionStatus";
import { syncPendingFearlessGames } from "../services/fearlessSync";
import { getAdminToken } from "../services/adminToken";
import { checkAdminTokenAtStartup } from "../services/adminTokenStatus";
import { validateFearlessAdminToken } from "../services/fearlessSync";

export function App() {
  useVirtualKeyboardViewport();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void refreshConnectionStatusIfStale();
    };
    refresh();
    const checkAdmin = () => {
      if (getConnectionStatus() === "online" && getAdminToken()) {
        void checkAdminTokenAtStartup(validateFearlessAdminToken);
      }
    };
    checkAdmin();
    const unsubscribe = subscribeToConnectionStatus((status) => {
      if (status === "online") {
        void syncPendingFearlessGames();
        checkAdmin();
      }
    });
    if (getConnectionStatus() === "online") void syncPendingFearlessGames();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      unsubscribe();
    };
  }, []);
  const navigation = useAppNavigation();
  const catalog = useChampionCatalog();
  const generation = useTeamGeneration(catalog.champions, navigation.previewPage);
  if (!navigation.welcomed) return <WelcomePage onStart={navigation.start} />;
  return (
    <AppLayout
      activePage={navigation.activePage}
      onNavigate={navigation.navigate}
      page={pageLayoutConfig[navigation.activePage]}
    >
      {navigation.activePage === "home" && <HomePage onNavigate={navigation.navigate} />}
      {navigation.activePage === "teams" && (
        <TeamsPage
          mode={generation.mode}
          setMode={generation.setMode}
          teamCount={generation.teamCount}
          setTeamCount={generation.changeTeamCount}
          teams={generation.teams}
          loading={generation.loading}
          error={catalog.error || generation.error}
          onRetryCatalog={catalog.error ? catalog.reload : undefined}
          onGenerate={generation.runGeneration}
        />
      )}
      {navigation.activePage === "draft" && <DraftPage champions={catalog.champions} />}
      {navigation.activePage === "roulette" && <RoulettePage champions={catalog.champions} />}
      {navigation.activePage === "history" && <HistoryPage champions={catalog.champions} />}
      {navigation.activePage === "settings" && <SettingsPage />}
    </AppLayout>
  );
}
