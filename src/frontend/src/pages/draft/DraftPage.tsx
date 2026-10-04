import { useEffect, useRef, useState } from "preact/hooks";
import type { Champion, Role } from "../../types";
import { DraftTable, type DraftSide, type DraftTarget } from "../../components/DraftTable/DraftTable";
import { Timer } from "../../components/Timer/Timer";
import { defaultFearlessSeriesId } from "../../services/fearlessSeries";
import { DraftChampionPicker } from "./DraftChampionPicker";
import { DraftCompletionDialog } from "./DraftCompletionDialog";
import {
  FearlessSyncError,
  getFearlessState,
  type FearlessState,
  saveFearlessGameLocally,
  syncFearlessLocalRecord,
} from "../../services/fearlessSync";
import {
  getLocalUsedFearlessChampionIds,
  type LocalHistoryRecord,
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
  const [preparedState, setPreparedState] = useState<FearlessState | null>(null);
  const seriesId = preparedState?.seriesId ?? defaultFearlessSeriesId;
  const saveLock = useRef(false);
  const savedRecord = useRef<LocalHistoryRecord | null>(null);
  const [canRetrySync, setCanRetrySync] = useState(false);
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
  const [loadingUsedChampions, setLoadingUsedChampions] = useState(getConnectionStatus() === "online");
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
    resetDraft();
    setPreparedState(null);
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
    getFearlessState()
      .then((state) => {
        if (active) {
          setPreparedState(state);
          setUsedChampionIds(new Set(state.usedChampions));
        }
      })
      .catch((error) => {
        if (active) setUsedChampionsError(error instanceof Error ? error.message : "No se pudo consultar Fearless.");
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
      (connectionStatus !== "online" || (!loadingUsedChampions && !usedChampionsError && preparedState?.availableChampions.includes(champion.id))) &&
      !selectedIds.has(champion.id) &&
      !usedChampionIds.has(champion.id) &&
      (roleFilter === "all" || champion.roles.includes(roleFilter)) &&
      champion.name
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es")),
  );
  const complete = [...blueSlots, ...redSlots].every(Boolean);
  const confirmSelection = () => {
    if (!selected || !target || loadingUsedChampions || usedChampionsError || usedChampionIds.has(selected.id) || (connectionStatus === "online" && !preparedState?.availableChampions.includes(selected.id))) return;
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
  const swapCells = (side: DraftSide, from: number, to: number) => {
    const setSlots = side === "blue" ? setBlueSlots : setRedSlots;
    setSlots((current) => {
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };
  const clearDragSelection = () => {
    setTarget(null);
    setSelected(null);
    setCompletionDeadline(null);
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
    if (!complete || saveLock.current) return;
    const mode = preparedState ? "online" : "local";
    if (connectionStatus === "online" && (!preparedState || loadingUsedChampions || usedChampionsError)) return;
    saveLock.current = true;
    setSaving(true);
    setSaveError("");
    setSaveOutcome("idle");
    setApiDiagnostic("");
    setCanRetrySync(false);
    const blueTeam = blueSlots.flatMap((champion) => champion ? [champion.id] : []);
    const redTeam = redSlots.flatMap((champion) => champion ? [champion.id] : []);
    const minimumGameNumber = preparedState?.nextGameNumber ?? 1;
    let localGame;
    try {
      // Este paso siempre ocurre primero y no depende del modo ni de la API.
      localGame = saveFearlessGameLocally({
        seriesId,
        blueTeam,
        redTeam,
        connectionMode: mode,
        minimumGameNumber,
        preparedGameNumber: mode === "online" ? preparedState?.nextGameNumber : undefined,
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar la partida.");
      saveLock.current = false;
      setSaving(false);
      return;
    }

    const localGameNumber = localGame.gameNumber ?? 1;
    savedRecord.current = localGame;
    setUsedChampionIds((current) =>
      new Set([...current, ...blueTeam, ...redTeam]),
    );
    if (mode !== "online") {
      setSavedGameNumber(localGameNumber);
      setSaveOutcome("local");
      resetDraft();
      saveLock.current = false;
      setSaving(false);
      return;
    }

    try {
      const result = await syncFearlessLocalRecord(localGame);
      if (!result) throw new Error("No se pudo preparar la partida para sincronizar.");
      setSavedGameNumber(result.gameNumber);
      setSaveOutcome("synced");
      setApiDiagnostic(result.diagnostic);
    } catch (error) {
      setCanRetrySync(!(error instanceof FearlessSyncError && error.code === "fearless_series_changed"));
      setSaveError(error instanceof Error ? error.message : "No se pudo sincronizar la partida.");
      setSavedGameNumber(localGameNumber);
      setSaveOutcome("sync-error");
      setApiDiagnostic(
        error instanceof FearlessSyncError && error.diagnostic
          ? error.diagnostic
          : "PETICION\nNo realizada\n\nRESPUESTA\nNo hay salida disponible.",
      );
    } finally {
      resetDraft();
      setPreparedState(null);
      setLoadingUsedChampions(connectionStatus === "online");
      setUsedChampionsReload((value) => value + 1);
      saveLock.current = false;
      setSaving(false);
    }
  };
  const retrySync = async () => {
    if (!savedRecord.current || saveLock.current || connectionStatus !== "online") return;
    saveLock.current = true;
    setSaving(true);
    try {
      const result = await syncFearlessLocalRecord(savedRecord.current);
      if (!result) return;
      setSaveOutcome("synced");
      setSaveError("");
      setCanRetrySync(false);
      setApiDiagnostic(result.diagnostic);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo sincronizar la partida.");
      setCanRetrySync(!(error instanceof FearlessSyncError && error.code === "fearless_series_changed"));
      if (error instanceof FearlessSyncError) setApiDiagnostic(error.diagnostic);
    } finally {
      setUsedChampionsReload((value) => value + 1);
      saveLock.current = false;
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
        draggableCells
        onCellDragStart={clearDragSelection}
        onCellsSwap={swapCells}
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
        canConfirm={Boolean(selected && target && !loadingUsedChampions && !usedChampionsError)}
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
        onRetrySync={canRetrySync && connectionStatus === "online" ? retrySync : undefined}
      />}
    </section>
  );
}
