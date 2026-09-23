import { useEffect, useState } from "preact/hooks";
import { generateTeams } from "../services/draftlab";
import { saveLocalHistoryRecord } from "../services/localHistory";
import type { Champion, GeneratedTeams, GenerationMode, TeamCount } from "../types";
import type { PageId } from "./routes";

function saveGeneratedTeamsLocally(teams: GeneratedTeams) {
  saveLocalHistoryRecord({
    kind: "teams",
    blueTeam: teams.blue.map(({ champion }) => champion.id),
    redTeam: teams.red.map(({ champion }) => champion.id),
  });
}

export function useTeamGeneration(champions: Champion[], previewPage: PageId | null) {
  const [mode, setMode] = useState<GenerationMode>("roles");
  const [teamCount, setTeamCount] = useState<TeamCount>(2);
  const [teams, setTeams] = useState<GeneratedTeams | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (previewPage !== "teams" || !champions.length || teams) return;
    generateTeams("roles", 2)
      .then((generatedTeams) => {
        saveGeneratedTeamsLocally(generatedTeams);
        setTeams(generatedTeams);
      })
      .catch((reason) => setError(String(reason)));
  }, [champions, previewPage, teams]);
  const runGeneration = async () => {
    setLoading(true); setError("");
    try {
      const generatedTeams = await generateTeams(mode, teamCount);
      saveGeneratedTeamsLocally(generatedTeams);
      setTeams(generatedTeams);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  };
  const changeTeamCount = (count: TeamCount) => { setTeamCount(count); setTeams(null); };
  return { mode, setMode, teamCount, changeTeamCount, teams, loading, error, runGeneration };
}
