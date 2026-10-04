import { invoke } from "@tauri-apps/api/core";
import { getApiRequestUrl } from "./appSettings";
import { getAdminToken } from "./adminToken";
import {
  getPendingFearlessSyncRecords,
  getLocalHistory,
  saveLocalHistoryRecord,
  updateLocalHistoryRecord,
  type LocalHistoryMode,
  type LocalHistoryRecord,
} from "./localHistory";

import { defaultFearlessSeriesId } from "./fearlessSeries";
export { defaultFearlessSeriesId } from "./fearlessSeries";

type UsedChampionsResponse = { seriesId?: string; usedChampions?: unknown };
type SeriesResponse = {
  games?: SeriesGameResponse[];
  series?: { games?: SeriesGameResponse[] };
  updatedAt?: unknown;
};
type SeriesGameResponse = {
  gameNumber?: unknown;
  blueTeam?: unknown;
  redTeam?: unknown;
  createdAt?: unknown;
  winner?: unknown;
};

export type FearlessSeriesGame = {
  seriesId: string;
  gameNumber: number;
  blueTeam: number[];
  redTeam: number[];
  createdAt: string;
  winner?: "blue" | "red";
};
type ApiResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  championId?: number;
  seriesId?: string;
  gameNumber?: number;
};

export type FearlessSeriesSummary = { seriesId: string; gamesCount: number };

export async function getFearlessSeriesSummaries(): Promise<FearlessSeriesSummary[]> {
  const path = "/api/series";
  const result = await apiRequest("GET", path);
  const payload = result.payload as { success?: boolean; series?: unknown; message?: string; error?: string } | null;
  if (!result.ok || payload?.success === false) {
    throw new FearlessSyncError(describeApiError(payload, "No se pudieron consultar las series."),
      formatApiDiagnostic("GET", path, result));
  }
  if (!Array.isArray(payload?.series) || payload.series.some((item) =>
    !item || typeof item.seriesId !== "string" || !item.seriesId ||
    !Number.isInteger(item.gamesCount) || item.gamesCount < 0)) {
    throw new FearlessSyncError("La API devolvió un listado de series no válido.");
  }
  return payload.series.map((item) => ({ seriesId: item.seriesId, gamesCount: item.gamesCount }));
}
type NativeApiResult = {
  ok: boolean;
  status: number | null;
  statusText: string;
  body: string;
  error: string | null;
};
type ApiResult = {
  ok: boolean;
  status: number | null;
  statusText: string;
  payload: unknown;
  error: string | null;
};

export class FearlessSyncError extends Error {
  constructor(message: string, readonly diagnostic = "", readonly code = "") {
    super(message);
    this.name = "FearlessSyncError";
  }
}

let pendingSync: Promise<void> | null = null;
const remoteReadTtlMs = 30_000;

type ReadCacheEntry<T> = {
  expiresAt: number;
  value?: T;
  pending?: Promise<T>;
};

const usedChampionsCache = new Map<string, ReadCacheEntry<number[]>>();
const seriesGamesCache = new Map<string, ReadCacheEntry<FearlessSeriesGame[]>>();

function endpoint(path: string) {
  return `${getApiRequestUrl()}${path}`;
}

function seriesCacheKey(seriesId: string) {
  return `${getApiRequestUrl()}::${seriesId}`;
}

function readThroughCache<T>(
  cache: Map<string, ReadCacheEntry<T>>,
  key: string,
  load: () => Promise<T>,
  force = false,
) {
  const cached = cache.get(key);
  if (cached?.pending) return cached.pending;
  if (!force && cached?.value !== undefined && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value);
  }

  const pending = load();
  cache.set(key, { expiresAt: 0, pending });
  void pending.then(
    (value) => {
      if (cache.get(key)?.pending === pending) {
        cache.set(key, { value, expiresAt: Date.now() + remoteReadTtlMs });
      }
    },
    () => {
      if (cache.get(key)?.pending === pending) cache.delete(key);
    },
  );
  return pending;
}

function invalidateSeriesReadCache(seriesId: string) {
  const key = seriesCacheKey(seriesId);
  usedChampionsCache.delete(key);
  seriesGamesCache.delete(key);
}

function prettyJson(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "(respuesta vacia)";
  }
  const output = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return output.length > 2_000 ? `${output.slice(0, 2_000)}\n...` : output;
}

function parseBody(body: string): unknown {
  if (!body) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

function formatApiDiagnostic(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  result: ApiResult,
  body?: unknown,
) {
  const sections = ["PETICION", `${method} ${endpoint(path)}`];
  if (body !== undefined) sections.push("", "CUERPO", prettyJson(body));
  sections.push(
    "",
    "RESPUESTA",
    result.status === null
      ? "ERROR DE RED"
      : `HTTP ${result.status}${result.statusText ? ` ${result.statusText}` : ""}`,
    result.error ?? prettyJson(result.payload),
  );
  return sections.join("\n");
}

function describeApiError(payload: ApiResponse | null, fallback: string) {
  if (payload?.error === "fearless_series_changed") return "La serie ha cambiado. La partida pertenece a una serie anterior y no se enviará a la nueva serie.";
  if (payload?.error === "catalog_unavailable") return "El catálogo de Fearless no está disponible. Vuelve a intentarlo.";
  if (payload?.error === "CHAMPION_ALREADY_USED" && payload.championId) {
    return `El campeon con ID ${payload.championId} ya se uso en esta serie.`;
  }
  const detail = payload?.message ?? payload?.error;
  return detail ? `La API rechazo la peticion: ${detail}.` : fallback;
}

async function apiRequest(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  authToken?: string,
): Promise<ApiResult> {
  if ("__TAURI_INTERNALS__" in window) {
    let native: NativeApiResult;
    try {
      native = await invoke<NativeApiResult>("fearless_api_request", {
        apiUrl: getApiRequestUrl(),
        method,
        path,
        body: body ?? null,
        authToken: authToken ?? null,
      });
    } catch (error) {
      const message = `No se pudo ejecutar la peticion nativa: ${String(error)}`;
      const result: ApiResult = {
        ok: false,
        status: null,
        statusText: "",
        payload: null,
        error: message,
      };
      throw new FearlessSyncError(
        "No se pudo conectar con la API de Fearless.",
        formatApiDiagnostic(method, path, result, body),
      );
    }
    const result: ApiResult = {
      ok: native.ok,
      status: native.status,
      statusText: native.statusText,
      payload: parseBody(native.body),
      error: native.error,
    };
    if (native.error) {
      throw new FearlessSyncError(
        "No se pudo conectar con la API de Fearless.",
        formatApiDiagnostic(method, path, result, body),
      );
    }
    return result;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(endpoint(path), {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = parseBody(await response.text());
      return {
        ok: false,
        status: response.status,
        statusText: response.statusText,
        payload,
        error: null,
      };
    }
    const payload = parseBody(await response.text());
    return {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      payload,
      error: null,
    };
  } catch (error) {
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "Tiempo de espera agotado (5 s)."
      : "No se pudo conectar con la API de Fearless.";
    const result: ApiResult = {
      ok: false,
      status: null,
      statusText: "",
      payload: null,
      error: message,
    };
    throw new FearlessSyncError(
      message,
      formatApiDiagnostic(method, path, result, body),
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

function validateTeams(blueTeam: number[], redTeam: number[]) {
  if (blueTeam.length !== 5 || redTeam.length !== 5) {
    throw new FearlessSyncError("La partida debe tener cinco campeones por equipo.");
  }
  const championIds = [...blueTeam, ...redTeam];
  if (!championIds.every((id) => Number.isInteger(id) && id > 0)) {
    throw new FearlessSyncError("Todos los campeones deben tener un ID numerico valido.");
  }
  if (new Set(championIds).size !== championIds.length) {
    throw new FearlessSyncError("No puede haber campeones repetidos en la partida.");
  }
}

export type FearlessState = {
  seriesId: string;
  availableChampions: number[];
  usedChampions: number[];
  nextGameNumber: number;
  catalogVersion: string | number;
  totalChampions: number;
};

export async function getFearlessState(): Promise<FearlessState> {
  const path = "/api/fearless";
  const result = await apiRequest("GET", path);
  const payload = result.payload as (FearlessState & ApiResponse) | null;
  if (!result.ok || payload?.success === false) {
    throw new FearlessSyncError(describeApiError(payload, "No se pudo consultar Fearless."),
      formatApiDiagnostic("GET", path, result), payload?.error);
  }
  const validIds = (ids: unknown): ids is number[] => Array.isArray(ids) &&
    ids.every((id) => Number.isInteger(id) && id > 0) && new Set(ids).size === ids.length;
  if (!payload || typeof payload.seriesId !== "string" || !payload.seriesId ||
      !validIds(payload.availableChampions) || !validIds(payload.usedChampions) ||
      !Number.isInteger(payload.nextGameNumber) || payload.nextGameNumber < 1 ||
      !((typeof payload.catalogVersion === "string" && payload.catalogVersion.length > 0) ||
        (typeof payload.catalogVersion === "number" && Number.isFinite(payload.catalogVersion))) ||
      !Number.isInteger(payload.totalChampions) || payload.totalChampions < 0 ||
      payload.availableChampions.length + payload.usedChampions.length !== payload.totalChampions ||
      payload.availableChampions.some((id) => payload.usedChampions.includes(id))) {
    throw new FearlessSyncError("La API devolvió un estado Fearless no válido.", formatApiDiagnostic("GET", path, result));
  }
  return payload;
}

export async function getUsedFearlessChampionIds(
  seriesId = defaultFearlessSeriesId,
  options: { force?: boolean } = {},
) {
  return readThroughCache(usedChampionsCache, seriesCacheKey(seriesId), async () => {
    const path = `/api/series/${encodeURIComponent(seriesId)}/used-champions`;
    const result = await apiRequest("GET", path);
    const payload = result.payload as (UsedChampionsResponse & ApiResponse) | null;
    if (!result.ok) {
      throw new FearlessSyncError(
        describeApiError(payload, "No se pudieron consultar los campeones usados."),
        formatApiDiagnostic("GET", path, result),
      );
    }
    if (!Array.isArray(payload?.usedChampions)) {
      throw new FearlessSyncError(
        "La API devolvio una lista de campeones usados no valida.",
        formatApiDiagnostic("GET", path, result),
      );
    }
    return payload.usedChampions.filter(
      (id): id is number => typeof id === "number" && Number.isInteger(id),
    );
  }, options.force);
}

async function loadFearlessSeriesGames(
  seriesId = defaultFearlessSeriesId,
): Promise<FearlessSeriesGame[]> {
  const path = `/api/series/${encodeURIComponent(seriesId)}`;
  const result = await apiRequest("GET", path);
  const payload = result.payload as (SeriesResponse & ApiResponse) | null;
  if (result.status === 404 && payload?.error?.toLowerCase() === "series_not_found") {
    return [];
  }
  if (!result.ok) {
    throw new FearlessSyncError(
      describeApiError(payload, "No se pudo cargar el historial de la API."),
      formatApiDiagnostic("GET", path, result),
    );
  }

  const games = payload?.games ?? payload?.series?.games ?? [];
  const fallbackDate = typeof payload?.updatedAt === "string"
    ? payload.updatedAt
    : new Date(0).toISOString();
  return games.flatMap((game) => {
    const gameNumber = Number(game.gameNumber);
    if (
      !Number.isInteger(gameNumber) ||
      !Array.isArray(game.blueTeam) ||
      !Array.isArray(game.redTeam)
    ) return [];
    const blueTeam = game.blueTeam.filter(
      (id): id is number => typeof id === "number" && Number.isInteger(id),
    );
    const redTeam = game.redTeam.filter(
      (id): id is number => typeof id === "number" && Number.isInteger(id),
    );
    if (blueTeam.length !== 5 || redTeam.length !== 5) return [];
    return [{
      seriesId,
      gameNumber,
      blueTeam,
      redTeam,
      createdAt: typeof game.createdAt === "string" ? game.createdAt : fallbackDate,
      winner: game.winner === "blue" || game.winner === "red" ? game.winner : undefined,
    }];
  });
}

export function getFearlessSeriesGames(
  seriesId = defaultFearlessSeriesId,
  options: { force?: boolean } = {},
): Promise<FearlessSeriesGame[]> {
  return readThroughCache(
    seriesGamesCache,
    seriesCacheKey(seriesId),
    () => loadFearlessSeriesGames(seriesId),
    options.force,
  );
}

export async function saveFearlessGame({ seriesId, blueTeam, redTeam, gameNumber }: {
  seriesId: string; blueTeam: number[]; redTeam: number[]; gameNumber: number;
}) {
  validateTeams(blueTeam, redTeam);
  if (!seriesId || !Number.isInteger(gameNumber) || gameNumber < 1) {
    throw new FearlessSyncError("Falta la identidad recibida al preparar la partida.");
  }
  const path = "/api/fearless";
  const body = { seriesId, gameNumber, blueTeam, redTeam };
  const result = await apiRequest("POST", path, body);
  const payload = result.payload as (ApiResponse & { game?: SeriesGameResponse; seriesArchived?: boolean; activeSeriesId?: string }) | null;
  const diagnostic = formatApiDiagnostic("POST", path, result, body);
  if (!result.ok || payload?.success === false) {
    throw new FearlessSyncError(describeApiError(payload, "No se pudo guardar la partida en la API."), diagnostic, payload?.error);
  }
  const savedGameNumber = payload?.game?.gameNumber ?? payload?.gameNumber;
  if (savedGameNumber !== gameNumber || payload?.seriesId !== seriesId) {
    throw new FearlessSyncError("La API no confirmó la identidad de la partida guardada.", diagnostic);
  }
  invalidateSeriesReadCache(seriesId);
  return { seriesId, gameNumber, diagnostic, seriesArchived: payload?.seriesArchived, activeSeriesId: payload?.activeSeriesId };
}

async function performRecordSync(record: LocalHistoryRecord) {
  if (record.kind !== "fearless" || record.connectionMode !== "online") return null;
  const attempts = (record.syncAttemptCount ?? 0) + 1;
  updateLocalHistoryRecord(record.id, { syncStatus: "pending", syncError: undefined,
    syncAttemptCount: attempts, syncUpdatedAt: new Date().toISOString() });
  try {
    const seriesId = record.seriesId;
    const gameNumber = record.remoteGameNumber;
    if (!seriesId || !gameNumber) throw new FearlessSyncError("Esta partida no conserva el estado de preparación de Fearless. Prepara una nueva partida.");
    // Verificar respuestas perdidas antes de reenviar el mismo POST.
    if ((record.syncAttemptCount ?? 0) > 0) {
      const games = await getFearlessSeriesGames(seriesId, { force: true });
      const saved = games.find((game) => game.gameNumber === gameNumber);
      if (saved) {
        if (saved.blueTeam.join(",") !== record.blueTeam.join(",") || saved.redTeam.join(",") !== record.redTeam.join(",")) {
          throw new FearlessSyncError("El número de partida ya está ocupado por otra composición.");
        }
        updateLocalHistoryRecord(record.id, { syncStatus: "synced", syncError: undefined });
        return { seriesId, gameNumber, diagnostic: "Partida verificada en el historial remoto." };
      }
    }
    const result = await saveFearlessGame({ seriesId, gameNumber, blueTeam: record.blueTeam, redTeam: record.redTeam });
    updateLocalHistoryRecord(record.id, { gameNumber: result.gameNumber, remoteGameNumber: result.gameNumber,
      syncStatus: "synced", syncError: undefined, syncUpdatedAt: new Date().toISOString() });
    return result;
  } catch (error) {
    updateLocalHistoryRecord(record.id, { syncStatus: "failed",
      syncError: error instanceof Error ? error.message : "Error de sincronización desconocido.",
      syncUpdatedAt: new Date().toISOString(),
      syncBlocked: error instanceof FearlessSyncError && error.code === "fearless_series_changed" });
    if (error instanceof FearlessSyncError && error.code === "fearless_series_changed") {
      try { await getFearlessState(); } catch { /* Conservar el conflicto original. */ }
    }
    throw error;
  }
}

const recordSyncs = new Map<string, Promise<Awaited<ReturnType<typeof performRecordSync>>>>();
export function syncFearlessLocalRecord(record: LocalHistoryRecord) {
  const pending = recordSyncs.get(record.id);
  if (pending) return pending;
  const current = getLocalHistory().find((item) => item.id === record.id) ?? record;
  if (current.syncStatus === "synced" || current.syncBlocked) return Promise.resolve(null);
  const request = performRecordSync(current).finally(() => recordSyncs.delete(record.id));
  recordSyncs.set(record.id, request);
  return request;
}

/** Reintenta conservando la identidad recibida al preparar cada partida. */
export function syncPendingFearlessGames() {
  if (pendingSync) return pendingSync;
  pendingSync = (async () => {
    for (const record of getPendingFearlessSyncRecords()) {
      try { await syncFearlessLocalRecord(record); } catch { break; }
    }
  })().finally(() => { pendingSync = null; });
  return pendingSync;
}

/** Guarda siempre la partida en el dispositivo antes de intentar la API. */
export function saveFearlessGameLocally({
  seriesId = defaultFearlessSeriesId,
  blueTeam,
  redTeam,
  connectionMode,
  minimumGameNumber,
  preparedGameNumber,
}: {
  seriesId?: string;
  blueTeam: number[];
  redTeam: number[];
  connectionMode: LocalHistoryMode;
  minimumGameNumber?: number;
  preparedGameNumber?: number;
}) {
  validateTeams(blueTeam, redTeam);
  return saveLocalHistoryRecord({
    kind: "fearless",
    seriesId,
    blueTeam,
    redTeam,
    connectionMode,
    minimumGameNumber,
    preparedGameNumber,
  });
}

function requireAdminToken() {
  const token = getAdminToken();
  if (!token) throw new FearlessSyncError("Configura un Admin Token en Configuración.");
  return token;
}

/** The server must verify the bearer token; no frontend state grants authority. */
export async function validateFearlessAdminToken() {
  const token = requireAdminToken();
  const result = await apiRequest("GET", "/api/admin/validate", undefined, token);
  const payload = result.payload as { valid?: boolean } | null;
  return result.ok && payload?.valid === true;
}

export async function updateFearlessGameWinner(seriesId: string, gameNumber: number, winner: "blue" | "red") {
  const token = requireAdminToken();
  const path = `/api/series/${encodeURIComponent(seriesId)}/games/${gameNumber}/winner`;
  const result = await apiRequest("PUT", path, { winner }, token);
  if (!result.ok) throw new FearlessSyncError(result.status === 404 || result.status === 405
    ? "FearlessSync aún no admite actualizar el ganador."
    : "FearlessSync rechazó la actualización del ganador.");
  invalidateSeriesReadCache(seriesId);
  const games = await getFearlessSeriesGames(seriesId, { force: true });
  if (games.find((game) => game.gameNumber === gameNumber)?.winner !== winner) {
    throw new FearlessSyncError("FearlessSync no confirmó el ganador al recargar la serie.");
  }
}

export async function deleteFearlessGame(seriesId: string, gameNumber: number) {
  const token = requireAdminToken();
  const path = `/api/series/${encodeURIComponent(seriesId)}/games/${gameNumber}`;
  const result = await apiRequest("DELETE", path, undefined, token);
  if (!result.ok) throw new FearlessSyncError(result.status === 404 || result.status === 405
    ? "FearlessSync aún no admite borrar partidas."
    : "FearlessSync rechazó el borrado de la partida.");
  invalidateSeriesReadCache(seriesId);
  const [games, usedIds] = await Promise.all([
    getFearlessSeriesGames(seriesId, { force: true }),
    getUsedFearlessChampionIds(seriesId, { force: true }),
  ]);
  if (games.some((game) => game.gameNumber === gameNumber)) {
    throw new FearlessSyncError("FearlessSync sigue devolviendo la partida borrada.");
  }
  const expected = new Set(games.flatMap((game) => [...game.blueTeam, ...game.redTeam]));
  if (usedIds.length !== expected.size || usedIds.some((id) => !expected.has(id))) {
    throw new FearlessSyncError("FearlessSync no recalculó los campeones usados.");
  }
}
