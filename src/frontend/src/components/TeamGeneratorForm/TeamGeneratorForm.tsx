import type { GeneratedTeams, GenerationMode, TeamCount } from "../../types";
import { UiIcon } from "../UiIcon/UiIcon";
import { Button } from "../Button/Button";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl";

export function TeamGeneratorForm({ mode, teamCount, teams, loading, onModeChange, onTeamCountChange, onGenerate }: {
  mode: GenerationMode;
  teamCount: TeamCount;
  teams: GeneratedTeams | null;
  loading: boolean;
  onModeChange: (mode: GenerationMode) => void;
  onTeamCountChange: (count: TeamCount) => void;
  onGenerate: () => void;
}) {
  return <section className="config-panel">
    <span className="config-label" id="team-count-label">Número de equipos</span>
    <SegmentedControl ariaLabel="Número de equipos" value={teamCount} onChange={onTeamCountChange} options={[{ value: 1, label: "1 equipo" }, { value: 2, label: "2 equipos" }]} />
    <span className="config-label" id="team-mode-label">Distribución de posiciones</span>
    <SegmentedControl ariaLabel="Distribución de posiciones" value={mode} onChange={onModeChange} options={[{ value: "roles", label: "Por posiciones" }, { value: "random", label: "Todo aleatorio" }]} />
    <small>Incluye TOP, Jungla, MID, ADC y Support.</small>
    <Button variant="gold" className="generate-button" disabled={loading} onClick={onGenerate}>
      <UiIcon name={teams ? "refresh" : "shuffle"} />
      {loading ? "Generando…" : teams ? "Generar otros equipos" : "Generar equipos"}
    </Button>
  </section>;
}
