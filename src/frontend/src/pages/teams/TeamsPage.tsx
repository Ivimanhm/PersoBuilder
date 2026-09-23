import type { GeneratedTeams, GenerationMode, TeamCount } from "../../types";
import { TeamBoard } from "../../components/TeamTable/TeamTable";
import { TeamGeneratorForm } from "../../components/TeamGeneratorForm/TeamGeneratorForm";

type TeamsPageProps = {
  mode: GenerationMode;
  setMode: (mode: GenerationMode) => void;
  teamCount: TeamCount;
  setTeamCount: (count: TeamCount) => void;
  teams: GeneratedTeams | null;
  loading: boolean;
  error: string;
  onRetryCatalog?: () => void;
  onGenerate: () => void;
};

export function TeamsPage({ mode, setMode, teamCount, setTeamCount, teams, loading, error, onRetryCatalog, onGenerate }: TeamsPageProps) {
  return (
    <section className="app-page teams-page">
      <TeamGeneratorForm mode={mode} teamCount={teamCount} teams={teams} loading={loading}
        onModeChange={setMode} onTeamCountChange={setTeamCount} onGenerate={onGenerate} />
      {error && <div className="error-message" role="alert">{error}{onRetryCatalog && <button type="button" onClick={onRetryCatalog}>Reintentar catálogo</button>}</div>}
      <TeamBoard teams={teams} teamCount={teamCount} />
    </section>
  );
}
