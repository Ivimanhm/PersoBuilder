import type { Champion } from "../../types";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { HistoryRoster } from "../../components/HistoryRoster/HistoryRoster";
import { UiIcon } from "../../components/UiIcon/UiIcon";
import {
  deleteLocalHistoryRecords,
  getLocalHistory,
  updateLocalHistoryRecord,
  type LocalHistoryRecord,
} from "../../services/localHistory";
import {
  defaultFearlessSeriesId,
  deleteFearlessGame,
  getFearlessSeriesGames,
  updateFearlessGameWinner,
  validateFearlessAdminToken,
} from "../../services/fearlessSync";
import { getAdminTokenStatus, subscribeToAdminTokenStatus } from "../../services/adminTokenStatus";
import {
  getConnectionStatus,
  subscribeToConnectionStatus,
  type ConnectionStatus,
} from "../../services/connectionStatus";

type HistorySource = "local" | "online";
type HistorySourceFilter = "local" | "online" | "all";
type HistoryKindFilter = "fearless" | "teams" | "all";
type HistoryRecord = LocalHistoryRecord & { source: HistorySource };
const historyDateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(date: string) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "Fecha desconocida";
  return historyDateFormatter.format(value);
}

function teamSignature(record: HistoryRecord) {
  if (record.kind !== "fearless") return "";
  return `${record.seriesId ?? defaultFearlessSeriesId}:${record.blueTeam.join(",")}:${record.redTeam.join(",")}`;
}

function remoteIdentity(record: HistoryRecord) {
  if (record.kind !== "fearless") return "";
  const gameNumber = record.source === "online"
    ? record.gameNumber
    : record.remoteGameNumber ??
      (record.connectionMode === "online" ? record.gameNumber : undefined);
  return gameNumber
    ? `${record.seriesId ?? defaultFearlessSeriesId}:${gameNumber}`
    : "";
}

function requiresAdminToken(record: HistoryRecord) {
  return record.kind === "fearless" && (
    record.source === "online" ||
    (record.connectionMode === "online" && record.syncStatus === "synced")
  );
}

function combineWithoutDuplicates(
  localRecords: HistoryRecord[],
  onlineRecords: HistoryRecord[],
) {
  return [
    ...localRecords.filter((localRecord) => !onlineRecords.some((onlineRecord) =>
      Boolean(remoteIdentity(localRecord) && remoteIdentity(localRecord) === remoteIdentity(onlineRecord)) ||
      teamSignature(localRecord) === teamSignature(onlineRecord))),
    ...onlineRecords,
  ];
}

export function HistoryPage({ champions }: { champions: Champion[] }) {
  const [seriesId, setSeriesId] = useState(() =>
    getLocalHistory().slice().reverse().find((record) => record.kind === "fearless")?.seriesId ?? defaultFearlessSeriesId);
  const [sourceFilter, setSourceFilter] = useState<HistorySourceFilter>("all");
  const [kindFilter, setKindFilter] = useState<HistoryKindFilter>("all");
  const [search, setSearch] = useState("");
  const [localRecords, setLocalRecords] = useState(getLocalHistory);
  const [onlineRecords, setOnlineRecords] = useState<HistoryRecord[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    getConnectionStatus,
  );
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState("");
  const [onlineReload, setOnlineReload] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [winnerRecord, setWinnerRecord] = useState<HistoryRecord | null>(null);
  const [deleteRecordIds, setDeleteRecordIds] = useState<string[] | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [localError, setLocalError] = useState("");
  const [adminValid, setAdminValid] = useState(getAdminTokenStatus() === "valid");
  const [mutating, setMutating] = useState(false);
  const winnerDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const dialog = winnerDialogRef.current;
    if (winnerRecord && dialog && !dialog.open) {
      dialog.showModal();
      dialog.focus({ preventScroll: true });
    }
  }, [winnerRecord]);
  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (deleteRecordIds && dialog && !dialog.open) {
      dialog.showModal();
      dialog.focus({ preventScroll: true });
    }
  }, [deleteRecordIds]);

  useEffect(() => () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }, []);

  useEffect(
    () => subscribeToConnectionStatus(setConnectionStatus),
    [],
  );
  useEffect(() => subscribeToAdminTokenStatus((status) => setAdminValid(status === "valid")), []);

  useEffect(() => {
    if (connectionStatus !== "online") {
      setLoadingOnline(false);
      setOnlineRecords([]);
      setOnlineError("");
      setLocalRecords(getLocalHistory());
      setOpenMenuId(null);
      setSelectedRecordIds(new Set());
      setSelectionMode(false);
      return;
    }
    let active = true;
    setOnlineRecords([]);
    setLoadingOnline(true);
    setOnlineError("");
    getFearlessSeriesGames(seriesId, {
      force: onlineReload > 0,
    })
      .then((games) => {
        if (!active) return;
        setOnlineRecords(games.map((game) => ({
          id: `api:${game.seriesId}:${game.gameNumber}`,
          source: "online" as const,
          kind: "fearless" as const,
          connectionMode: "online" as const,
          seriesId: game.seriesId,
          gameNumber: game.gameNumber,
          remoteGameNumber: game.gameNumber,
          createdAt: game.createdAt,
          blueTeam: game.blueTeam,
          redTeam: game.redTeam,
          winner: game.winner,
        })));
      })
      .catch((error) => {
        if (active) {
          const detail = error instanceof Error ? error.message : "Error desconocido.";
          setOnlineError(`No se pudo cargar el historial de la API. ${detail}`);
        }
      })
      .finally(() => {
        if (active) setLoadingOnline(false);
      });
    return () => {
      active = false;
    };
  }, [connectionStatus, onlineReload, seriesId]);

  const championsById = useMemo(
    () => new Map(champions.map((champion) => [champion.id, champion])),
    [champions],
  );
  // Local mode is a hard boundary: no remote records remain in state or in the view.
  const effectiveSourceFilter = connectionStatus === "online" ? sourceFilter : "local";
  const roster = (ids: number[]) => ids
    .map((id) => championsById.get(id))
    .filter((champion): champion is Champion => Boolean(champion));
  const results = useMemo(() => {
    const localView = localRecords.map((record) => ({ ...record, source: "local" as const }));
    const sourceRecords = effectiveSourceFilter === "local"
      ? localView
      : effectiveSourceFilter === "online"
        ? onlineRecords
        : onlineError
          ? localView
          : combineWithoutDuplicates(localView.filter((record) => record.syncStatus !== "synced"), onlineRecords);
    const normalizedSearch = search.toLocaleLowerCase("es");
    return sourceRecords
      .filter((record) => {
        const championNames = [...record.blueTeam, ...record.redTeam]
          .map((id) => championsById.get(id)?.name ?? "")
          .join(" ");
        return (record.kind !== "fearless" || (record.seriesId ?? defaultFearlessSeriesId) === seriesId) &&
          (kindFilter === "all" || record.kind === kindFilter) &&
          `${formatDate(record.createdAt)} ${record.kind} ${record.source} ${championNames}`
            .toLocaleLowerCase("es")
            .includes(normalizedSearch);
      })
      .sort((left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
  }, [championsById, effectiveSourceFilter, kindFilter, localRecords, onlineError, onlineRecords, search, seriesId]);

  const setWinner = async (side: "blue" | "red") => {
    if (!winnerRecord || mutating) return;
    const remoteRecord = requiresAdminToken(winnerRecord);
    if (remoteRecord && !adminValid) return;
    setMutating(true);
    try {
      if (remoteRecord && !await validateFearlessAdminToken()) {
        setAdminValid(false);
        throw new Error("El Admin Token ya no es válido.");
      }
      if (remoteRecord) {
        await updateFearlessGameWinner(winnerRecord.seriesId ?? defaultFearlessSeriesId, winnerRecord.remoteGameNumber ?? winnerRecord.gameNumber!, side);
        setOnlineReload((value) => value + 1);
        const identity = remoteIdentity(winnerRecord);
        for (const local of localRecords) {
          if (local.syncStatus === "synced" && remoteIdentity({ ...local, source: "local" }) === identity) {
            updateLocalHistoryRecord(local.id, { winner: side });
          }
        }
        setLocalRecords(getLocalHistory());
      }
      if (winnerRecord.source === "local") {
      updateLocalHistoryRecord(winnerRecord.id, { winner: side });
      setLocalRecords((current) => current.map((record) =>
        record.id === winnerRecord.id ? { ...record, winner: side } : record,
      ));
      }
      setOnlineRecords((current) => current.map((record) => record.id === winnerRecord.id ? { ...record, winner: side } : record));
      setWinnerRecord(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "No se pudo actualizar la partida.");
    } finally {
      setMutating(false);
    }
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  const beginSelection = (recordId: string) => {
    setOpenMenuId(null);
    setSelectionMode(true);
    setSelectedRecordIds(new Set([recordId]));
    suppressClickRef.current = true;
  };
  const toggleSelection = (recordId: string) => {
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      next.has(recordId) ? next.delete(recordId) : next.add(recordId);
      return next;
    });
  };
  const exitSelection = () => {
    clearLongPress();
    setSelectionMode(false);
    setSelectedRecordIds(new Set());
  };
  const deleteSelectedRecords = async () => {
    if (!deleteRecordIds?.length) return;
    if (mutating) return;
    setMutating(true);
    try {
      const ids = new Set(deleteRecordIds);
      const targets = [...localRecords.map((record) => ({ ...record, source: "local" as const })), ...onlineRecords]
        .filter((record) => ids.has(record.id));
      for (const record of targets) {
        if (!requiresAdminToken(record)) continue;
        if (!adminValid) throw new Error("Necesitas un Admin Token válido para borrar partidas Fearless.");
        if (!await validateFearlessAdminToken()) {
          setAdminValid(false);
          throw new Error("El Admin Token ya no es válido.");
        }
        if (requiresAdminToken(record)) {
          await deleteFearlessGame(record.seriesId ?? defaultFearlessSeriesId, record.remoteGameNumber ?? record.gameNumber!);
          const identity = remoteIdentity(record);
          for (const local of localRecords) {
            const localView = { ...local, source: "local" as const };
            if (local.kind === "fearless" && (
              (local.syncStatus === "synced" && remoteIdentity(localView) === identity) ||
              teamSignature(localView) === teamSignature(record)
            )) ids.add(local.id);
          }
        }
      }
      deleteLocalHistoryRecords(localRecords.filter((record) => ids.has(record.id)).map((record) => record.id));
      setLocalRecords((current) => current.filter((record) => !ids.has(record.id)));
      setOnlineRecords((current) => current.filter((record) => !ids.has(record.id)));
      setOnlineReload((value) => value + 1);
      setDeleteRecordIds(null);
      exitSelection();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "No se pudieron eliminar las partidas.");
    } finally {
      setMutating(false);
    }
  };

  const showsOnlineFearless = connectionStatus === "online" && sourceFilter !== "local" && kindFilter !== "teams";
  const waitingForOnline = loadingOnline && showsOnlineFearless;

  return <section className="app-page history-page">
    <label>Serie del historial <input value={seriesId} disabled={mutating} list="history-series"
      onChange={(event) => {
        const id = event.currentTarget.value.trim();
        if (id) setSeriesId(id);
        setOnlineRecords([]);
        setOnlineError("");
        setOpenMenuId(null);
        setSelectedRecordIds(new Set());
        setSelectionMode(false);
      }} /></label>
    <datalist id="history-series">{[...new Set(localRecords.flatMap((record) => record.seriesId ? [record.seriesId] : []))]
      .map((id) => <option key={id} value={id} />)}</datalist>
    <div className="history-filters" role="tablist" aria-label="Tipo de partida">
      <button className={kindFilter === "all" ? "active" : ""} type="button" onClick={() => setKindFilter("all")}>Todos</button>
      <button className={kindFilter === "fearless" ? "active" : ""} type="button" onClick={() => setKindFilter("fearless")}>Fearless</button>
      <button className={kindFilter === "teams" ? "active" : ""} type="button" onClick={() => setKindFilter("teams")}>Equipos aleatorios</button>
    </div>
    <div className="history-tools">
      <label className="history-search"><i className="bi bi-search" aria-hidden="true" /><span className="visually-hidden">Buscar en el historial</span><input value={search} onInput={(event) => setSearch(event.currentTarget.value)} placeholder="Buscar por campeón, fecha..." /></label>
      <select aria-label="Origen del historial" value={effectiveSourceFilter} disabled={connectionStatus !== "online"} onChange={(event) => setSourceFilter(event.currentTarget.value as HistorySourceFilter)}><option value="all">Todos</option><option value="local">Local</option><option value="online">Online</option></select>
    </div>
    {selectionMode && <div className="history-selection-bar" role="status">
      <span>{selectedRecordIds.size} seleccionada{selectedRecordIds.size === 1 ? "" : "s"}</span>
      <button type="button" onClick={exitSelection}>Cancelar</button>
      <button className="danger" type="button" disabled={!selectedRecordIds.size} onClick={() => setDeleteRecordIds([...selectedRecordIds])}><i className="bi bi-trash3" />Eliminar</button>
    </div>}
    {localError && <div className="history-online-error" role="alert"><i className="bi bi-exclamation-triangle-fill" /><span>{localError}</span><button type="button" onClick={() => setLocalError("")}>Cerrar</button></div>}
    {onlineError && showsOnlineFearless && <div className="history-online-error" role="alert"><i className="bi bi-exclamation-triangle-fill" /><span>{onlineError} Las partidas locales siguen disponibles.</span><button type="button" onClick={() => setOnlineReload((value) => value + 1)}>Reintentar</button></div>}
    <div className={`history-list${kindFilter === "teams" ? " teams-filter" : ""}`} aria-busy={waitingForOnline}>
      {waitingForOnline ? (
        <div className="history-loading" role="status"><i className="bi bi-arrow-repeat" /><span>Cargando historial online...</span></div>
      ) : (<>
        {results.map((record) => {
          const blue = roster(record.blueTeam);
          const red = roster(record.redTeam);
          const fearless = record.kind === "fearless";
          const fearlessMode = record.source === "online" || record.connectionMode === "online" ? "online" : "local";
          const isSelectable = record.source === "local" && record.kind === "teams";
          const isSelected = selectedRecordIds.has(record.id);
          return <article
            className={`history-card${isSelected ? " selected" : ""}${selectionMode && isSelectable ? " selectable" : ""}`}
            key={`${record.source}:${record.id}`}
            aria-selected={selectionMode && isSelectable ? isSelected : undefined}
            onPointerDown={(event) => {
              if (!isSelectable || selectionMode || event.button !== 0 || (event.target as Element).closest("button, input, select, a")) return;
              clearLongPress();
              longPressTimerRef.current = setTimeout(() => beginSelection(record.id), 500);
            }}
            onPointerUp={clearLongPress}
            onPointerCancel={clearLongPress}
            onPointerMove={clearLongPress}
            onContextMenu={(event) => {
              if (!isSelectable) return;
              event.preventDefault();
              if (!selectionMode) beginSelection(record.id);
            }}
            onClick={(event) => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                event.preventDefault();
                return;
              }
              if (selectionMode && isSelectable && !(event.target as Element).closest("button, input, select, a")) toggleSelection(record.id);
            }}
          >
            <header><span className={`history-kind ${record.kind}${fearless ? ` ${fearlessMode}` : ""}`} title={fearless ? `Modo ${fearlessMode === "online" ? "Online" : "Local"}` : undefined}><UiIcon name={fearless ? (fearlessMode === "online" ? "cloud" : "database") : "shuffle"} /></span><div><h2>{fearless ? "Draft Fearless" : "Equipos aleatorios"}</h2><p>{formatDate(record.createdAt)}</p></div><small>{fearless ? `Partida ${record.gameNumber ?? "-"}` : `${record.redTeam.length ? 2 : 1} equipo${record.redTeam.length ? "s" : ""}`}</small></header>
            <div className="history-matchup"><HistoryRoster side="blue" champions={blue} /><span className="history-vs">VS</span><HistoryRoster side="red" champions={red} /></div>
            {record.winner && <div className={`history-winner ${record.winner}`}><i className="bi bi-trophy-fill" />Ganador: Equipo {record.winner === "blue" ? "Azul" : "Rojo"}</div>}
            {!selectionMode && <div className="history-actions"><button type="button" aria-label="Opciones" aria-expanded={openMenuId === record.id} onClick={() => setOpenMenuId(openMenuId === record.id ? null : record.id)}><i className="bi bi-three-dots-vertical" /></button>{openMenuId === record.id && <div className="history-menu">{(!requiresAdminToken(record) || adminValid) ? <><button type="button" onClick={() => { setWinnerRecord(record); setOpenMenuId(null); }}><i className="bi bi-trophy" />{record.winner ? "Modificar ganador" : "Seleccionar ganador"}</button><button className="danger" type="button" onClick={() => { setDeleteRecordIds([record.id]); setOpenMenuId(null); }}><i className="bi bi-trash3" />Eliminar partida</button></> : <span className="history-admin-hint">Requiere un Admin Token válido</span>}</div>}</div>}
          </article>;
        })}
        {!results.length && <div className="history-empty">No hay partidas que coincidan con la búsqueda</div>}
      </>)}
    </div>
    {winnerRecord && <dialog ref={winnerDialogRef} tabIndex={-1} className="history-dialog-backdrop" aria-labelledby="winner-dialog-title" onClose={() => setWinnerRecord(null)}><section className="history-dialog"><i className="bi bi-trophy-fill" /><h2 id="winner-dialog-title">Selecciona el ganador</h2><p>¿Qué equipo ganó esta partida?</p><div><button className="blue" type="button" disabled={mutating} onClick={() => void setWinner("blue")}>Equipo Azul</button><button className="red" type="button" disabled={mutating} onClick={() => void setWinner("red")}>Equipo Rojo</button></div><button className="history-dialog-cancel" type="button" disabled={mutating} onClick={() => setWinnerRecord(null)}>Cancelar</button></section></dialog>}
    {deleteRecordIds && <dialog ref={deleteDialogRef} tabIndex={-1} className="history-dialog-backdrop" aria-labelledby="delete-dialog-title" onClose={() => setDeleteRecordIds(null)}><section className="history-dialog"><i className="bi bi-trash3" /><h2 id="delete-dialog-title">¿Eliminar {deleteRecordIds.length === 1 ? "partida" : "partidas"}?</h2><p>Esta acción no se puede deshacer.</p><div><button className="history-dialog-cancel" type="button" disabled={mutating} onClick={() => setDeleteRecordIds(null)}>Cancelar</button><button className="history-delete-confirm" type="button" disabled={mutating} onClick={() => void deleteSelectedRecords()}>{mutating ? "Eliminando..." : "Eliminar"}</button></div></section></dialog>}
  </section>;
}
