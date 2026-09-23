import { useEffect, useState } from "preact/hooks";
import type { Champion, Role } from "../../types";
import { DraftTable, type DraftTarget } from "../../components/DraftTable/DraftTable";
import { Timer } from "../../components/Timer/Timer";
import { DraftChampionPicker } from "./DraftChampionPicker";
import { DraftCompletionDialog } from "./DraftCompletionDialog";
import {
  FearlessSyncError,
  defaultFearlessSeriesId,
  getUsedFearlessChampionIds,
  saveFearlessGameLocally,
  syncFearlessLocalRecord,
} from "../../services/fearlessSync";
import {
  getLocalUsedFearlessChampionIds,
} from "../../services/localHistory";
import {
  getConnectionStatus,
  subscribeToConnectionStatus,
  type ConnectionStatus,
} from "../../services/connectionStatus";

type SaveOutcome = "idle" | "local" | "synced" | "sync-error";

export function DraftPage({
  champions,
}: {
  champions: Champion[];
}) {
  const [deadline, setDeadline] = useState(() => Date.now() + 30_000);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [selected, setSelected] = useState<Champion | null>(null);
  const [target, setTarget] = useState<DraftTarget | null>(null);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [completionDeadline, setCompletionDeadline] = useState<number | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOutcome, setSaveOutcome] = useState<SaveOutcome>("idle");
  const [apiDiagnostic, setApiDiagnostic] = useState("");
  const [savedGameNumber, setSavedGameNumber] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    getConnectionStatus,
  );
  const [usedChampionIds, setUsedChampionIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [loadingUsedChampions, setLoadingUsedChampions] = useState(false);
  const [usedChampionsError, setUsedChampionsError] = useState("");
  const [usedChampionsReload, setUsedChampionsReload] = useState(0);
  const [blueSlots, setBlueSlots] = useState<(Champion | null)[]>(
    () => Array(5).fill(null),
  );
  const [redSlots, setRedSlots] = useState<(Champion | null)[]>(
    () => Array(5).fill(null),
  );
  useEffect(
    () => subscribeToConnectionStatus(setConnectionStatus),
    [],
  );

  useEffect(() => {
    if (connectionStatus !== "online") {
      setUsedChampionIds(
        new Set(getLocalUsedFearlessChampionIds(defaultFearlessSeriesId)),
      );
      setLoadingUsedChampions(false);
      setUsedChampionsError("");
      return;
    }
    let active = true;
    setSelected(null);
    setLoadingUsedChampions(true);
    setUsedChampionsError("");
    getUsedFearlessChampionIds(defaultFearlessSeriesId, {
      force: usedChampionsReload > 0,
    })
      .then((ids) => {
        if (active) {
          setUsedChampionIds(new Set([
            ...getLocalUsedFearlessChampionIds(defaultFearlessSeriesId),
            ...ids,
          ]));
        }
      })
      .catch(() => {
        if (active) {
          setUsedChampionIds(new Set());
          setUsedChampionsError("No se pudieron cargar los campeones usados.");
        }
      })
      .finally(() => {
        if (active) setLoadingUsedChampions(false);
      });
    return () => {
      active = false;
    };
  }, [connectionStatus, usedChampionsReload]);

  const selectedIds = new Set(
    [...blueSlots, ...redSlots].flatMap((champion) =>
      champion ? [champion.id] : [],
    ),
  );
  const available = champions.filter(
    (champion) =>
      !selectedIds.has(champion.id) &&
      !usedChampionIds.has(champion.id) &&
      (roleFilter === "all" || champion.roles.includes(roleFilter)) &&
      champion.name
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es")),
  );
  const complete = [...blueSlots, ...redSlots].every(Boolean);
  const confirmSelection = () => {
    if (!selected || !target) return;
    const next = (target.side === "blue" ? blueSlots : redSlots).map(
      (champion, index) => (index === target.slot ? selected : champion),
    );
    if (target.side === "blue") setBlueSlots(next);
    else setRedSlots(next);
    const all =
      target.side === "blue" ? [...next, ...redSlots] : [...blueSlots, ...next];
    setSelected(null);
    setTarget(null);
    setDeadline(Date.now() + 30_000);
    if (all.every(Boolean)) {
      setSaveError("");
      setSaveOutcome("idle");
      setApiDiagnostic("");
      setSavedGameNumber(null);
      setCompletionModalOpen(true);
    }
  };
  const selectTarget = (next: DraftTarget) => {
    setCompletionDeadline(null);
    setTarget(next);
    setDeadline(Date.now() + 30_000);
  };
  const continueEditing = () => {
    setCompletionModalOpen(false);
    setSaveError("");
    setSaveOutcome("idle");
    setApiDiagnostic("");
    setSavedGameNumber(null);
    setCompletionDeadline(Date.now() + 20_000);
  };
  const resetDraft = () => {
    setBlueSlots(Array(5).fill(null));
    setRedSlots(Array(5).fill(null));
    setSelected(null);
    setTarget(null);
    setSearch("");
    setRoleFilter("all");
    setCompletionDeadline(null);
    setDeadline(Date.now() + 30_000);
  };
  const saveGame = async () => {
    if (!complete || saving) return;
    setSaving(true);
    setSaveError("");
    setSaveOutcome("idle");
    setApiDiagnostic("");
    const blueTeam = blueSlots.flatMap((champion) => champion ? [champion.id] : []);
    const redTeam = redSlots.flatMap((champion) => champion ? [champion.id] : []);
    const mode = getConnectionStatus() === "online" ? "online" : "local";
    let localGame;
    try {
      // Este paso siempre ocurre primero y no depende del modo ni de la API.
      localGame = saveFearlessGameLocally({
        blueTeam,
        redTeam,
        connectionMode: mode,
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar la partida.");
      setSaving(false);
      return;
    }

    const localGameNumber = localGame.gameNumber ?? 1;
    setUsedChampionIds((current) =>
      new Set([...current, ...blueTeam, ...redTeam]),
    );
    if (mode !== "online") {
      setSavedGameNumber(localGameNumber);
      setSaveOutcome("local");
      resetDraft();
      setSaving(false);
      return;
    }

    try {
      const result = await syncFearlessLocalRecord(localGame);
      if (!result) throw new Error("No se pudo preparar la partida para sincronizar.");
      setSavedGameNumber(localGameNumber);
      setSaveOutcome("synced");
      setApiDiagnostic(result.diagnostic);
    } catch (error) {
      setSavedGameNumber(localGameNumber);
      setSaveOutcome("sync-error");
      setApiDiagnostic(
        error instanceof FearlessSyncError && error.diagnostic
          ? error.diagnostic
          : "PETICION\nNo realizada\n\nRESPUESTA\nNo hay salida disponible.",
      );
    } finally {
      resetDraft();
      setSaving(false);
    }
  };
  return (
    <section className="app-page draft-page">
      <section className="draft-intro">
        <span className="draft-helmet">
          <i className="helmet-shape" />
        </span>
        <div>
          <h1>Builds</h1>
          <p>Simula una fase de draft y crea la composición perfecta.</p>
        </div>
      </section>
      <DraftTable
        blueSlots={blueSlots}
        redSlots={redSlots}
        target={target}
        onSelectSlot={selectTarget}
      />
      <section className="current-turn">
        <div>
          {target ? (
            <h2>
              <span className={`team-gem ${target.side}`} />
              {target.side === "blue" ? "Equipo Azul" : "Equipo Rojo"} elige
            </h2>
          ) : complete ? (
              <button
              className="draft-review-button"
              type="button"
              onClick={() => {
                setCompletionDeadline(null);
                setSaveError("");
                setSaveOutcome("idle");
                setApiDiagnostic("");
                setSavedGameNumber(null);
                setCompletionModalOpen(true);
              }}
            >
              Partida lista <i className="bi bi-chevron-right" />
            </button>
          ) : (
            <h2>Elige una celda</h2>
          )}
        </div>
        <Timer
          className="draft-timer"
          deadline={completionDeadline ?? (target ? deadline : null)}
          durationSeconds={completionDeadline ? 20 : 30}
          paused={!target && !completionDeadline}
          onExpire={completionDeadline ? () => {
            setCompletionDeadline(null);
            setCompletionModalOpen(true);
          } : undefined}
        />
      </section>
      <DraftChampionPicker
        champions={available}
        selected={selected}
        canConfirm={Boolean(selected && target)}
        search={search}
        roleFilter={roleFilter}
        loading={loadingUsedChampions}
        error={usedChampionsError}
        onSearchChange={setSearch}
        onRoleFilterChange={setRoleFilter}
        onSelect={setSelected}
        onConfirm={confirmSelection}
        onRetry={() => setUsedChampionsReload((value) => value + 1)}
      />
      {completionModalOpen && <DraftCompletionDialog
        blueSlots={blueSlots}
        redSlots={redSlots}
        saving={saving}
        saveError={saveError}
        saveOutcome={saveOutcome}
        diagnostic={apiDiagnostic}
        savedGameNumber={savedGameNumber}
        onClose={() => setCompletionModalOpen(false)}
        onContinueEditing={continueEditing}
        onSave={saveGame}
      />}
    </section>
  );
}
