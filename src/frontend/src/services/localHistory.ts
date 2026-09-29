export type LocalHistoryKind = "fearless" | "teams";
export type LocalHistoryWinner = "blue" | "red";
export type LocalHistoryMode = "local" | "online";
export type SyncStatus = "pending" | "synced" | "failed";

export type LocalHistoryRecord = {
  id: string;
  kind: LocalHistoryKind;
  createdAt: string;
  blueTeam: number[];
  redTeam: number[];
  winner?: LocalHistoryWinner;
  seriesId?: string;
  gameNumber?: number;
  connectionMode?: LocalHistoryMode;
  remoteGameNumber?: number;
  syncStatus?: SyncStatus;
  syncError?: string;
  syncAttemptCount?: number;
  syncUpdatedAt?: string;
};

const localHistoryKey = "perso-builder-local-history";
const legacyFearlessGamesKey = "perso-builder-local-fearless-games";
const maxHistoryRecords = 250;

export class LocalHistoryStorageError extends Error {
  constructor() {
    super("No se pudo guardar el historial local. Libera espacio en el dispositivo e inténtalo de nuevo.");
    this.name = "LocalHistoryStorageError";
  }
}

function isChampionId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function normalizeRecord(value: unknown): LocalHistoryRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    (record.kind !== "fearless" && record.kind !== "teams") ||
    typeof record.createdAt !== "string" ||
    !Array.isArray(record.blueTeam) || !Array.isArray(record.redTeam)
  ) return null;
  const kind = record.kind;
  const connectionMode = record.connectionMode === "online" || record.connectionMode === "local"
    ? record.connectionMode : undefined;
  const remoteGameNumber = isChampionId(record.remoteGameNumber) ? record.remoteGameNumber : undefined;
  const storedStatus = record.syncStatus;
  const syncStatus: SyncStatus | undefined =
    storedStatus === "pending" || storedStatus === "synced" || storedStatus === "failed"
      ? storedStatus
      : kind === "fearless" && connectionMode === "online"
        ? remoteGameNumber ? "synced" : "pending"
        : undefined;
  const blueTeam = record.blueTeam.filter(isChampionId);
  const redTeam = record.redTeam.filter(isChampionId);
  const validTeams = kind === "fearless"
    ? blueTeam.length === 5 && redTeam.length === 5
    : blueTeam.length === 5 && (redTeam.length === 0 || redTeam.length === 5);
  if (!validTeams) return null;
  return {
    id: record.id, kind, createdAt: record.createdAt,
    blueTeam, redTeam,
    winner: record.winner === "blue" || record.winner === "red" ? record.winner : undefined,
    seriesId: typeof record.seriesId === "string" ? record.seriesId : undefined,
    gameNumber: isChampionId(record.gameNumber) ? record.gameNumber : undefined,
    connectionMode, remoteGameNumber, syncStatus,
    syncError: typeof record.syncError === "string" ? record.syncError : undefined,
    syncAttemptCount: typeof record.syncAttemptCount === "number" && record.syncAttemptCount >= 0
      ? record.syncAttemptCount : undefined,
    syncUpdatedAt: typeof record.syncUpdatedAt === "string" ? record.syncUpdatedAt : undefined,
  };
}

function readHistory(): LocalHistoryRecord[] {
  try {
    const storedHistory = localStorage.getItem(localHistoryKey);
    if (storedHistory !== null) {
      const records: unknown = JSON.parse(storedHistory);
      return Array.isArray(records) ? records.flatMap((record) => {
        const normalized = normalizeRecord(record);
        return normalized ? [normalized] : [];
      }) : [];
    }
    const legacyGames: unknown = JSON.parse(localStorage.getItem(legacyFearlessGamesKey) ?? "[]");
    if (!Array.isArray(legacyGames)) return [];
    return legacyGames.flatMap((game, index) => {
      if (!game || typeof game !== "object") return [];
      const value = game as Record<string, unknown>;
      if (!Array.isArray(value.blueTeam) || !Array.isArray(value.redTeam)) return [];
      return [{
        id: `legacy-fearless-${index}`, kind: "fearless" as const,
        createdAt: typeof value.savedAt === "string" ? value.savedAt : new Date(0).toISOString(),
        blueTeam: value.blueTeam.filter(isChampionId), redTeam: value.redTeam.filter(isChampionId),
        seriesId: typeof value.seriesId === "string" ? value.seriesId : undefined,
        gameNumber: isChampionId(value.gameNumber) ? value.gameNumber : undefined,
      }];
    });
  } catch { return []; }
}

function writeHistory(records: LocalHistoryRecord[]) {
  try {
    localStorage.setItem(localHistoryKey, JSON.stringify(records));
  } catch {
    throw new LocalHistoryStorageError();
  }
}

function retainRecords(records: LocalHistoryRecord[]) {
  if (records.length <= maxHistoryRecords) return records;
  const pending = records.filter((record) => record.syncStatus === "pending" || record.syncStatus === "failed");
  if (pending.length >= maxHistoryRecords) {
    throw new LocalHistoryStorageError();
  }
  const newestRegular = records
    .filter((record) => record.syncStatus !== "pending" && record.syncStatus !== "failed")
    .slice(-(maxHistoryRecords - pending.length));
  return [...pending, ...newestRegular]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function getLocalHistory() { return readHistory(); }

export function getPendingFearlessSyncRecords() {
  return readHistory().filter((record) =>
    record.kind === "fearless" && record.connectionMode === "online" && record.syncStatus !== "synced",
  );
}

export function saveLocalHistoryRecord({ kind, blueTeam, redTeam, seriesId, connectionMode, minimumGameNumber = 1 }: {
  kind: LocalHistoryKind;
  blueTeam: number[];
  redTeam: number[];
  seriesId?: string;
  connectionMode?: LocalHistoryMode;
  minimumGameNumber?: number;
}): LocalHistoryRecord {
  const records = readHistory();
  const gameNumber = kind === "fearless"
    ? Math.max(minimumGameNumber - 1, ...records.filter((record) => record.kind === "fearless" && record.seriesId === seriesId)
      .map((record) => Math.max(record.gameNumber ?? 0, record.remoteGameNumber ?? 0))) + 1
    : undefined;
  const record: LocalHistoryRecord = {
    id: crypto.randomUUID(), kind, createdAt: new Date().toISOString(),
    blueTeam: [...blueTeam], redTeam: [...redTeam], seriesId, gameNumber, connectionMode,
    syncStatus: kind === "fearless" && connectionMode === "online" ? "pending" : undefined,
    syncAttemptCount: kind === "fearless" && connectionMode === "online" ? 0 : undefined,
  };
  writeHistory(retainRecords([...records, record]));
  return record;
}

export function getLocalUsedFearlessChampionIds(seriesId: string, includeSynced = true) {
  return [...new Set(readHistory().filter((record) => record.kind === "fearless" && (record.seriesId === seriesId || record.seriesId === undefined) && (includeSynced || record.syncStatus !== "synced"))
    .flatMap((record) => [...record.blueTeam, ...record.redTeam]))];
}

export function updateLocalHistoryRecord(
  id: string,
  changes: Partial<Pick<LocalHistoryRecord, "winner" | "gameNumber" | "remoteGameNumber" | "syncStatus" | "syncError" | "syncAttemptCount" | "syncUpdatedAt">>,
) {
  writeHistory(readHistory().map((record) => record.id === id ? { ...record, ...changes } : record));
}

export function deleteLocalHistoryRecord(id: string) {
  deleteLocalHistoryRecords([id]);
}

export function deleteLocalHistoryRecords(ids: Iterable<string>) {
  const idsToDelete = new Set(ids);
  if (!idsToDelete.size) return;
  writeHistory(readHistory().filter((record) => !idsToDelete.has(record.id)));
}
