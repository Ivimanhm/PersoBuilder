import { invoke } from "@tauri-apps/api/core";
import { getApiRequestUrl } from "./appSettings";
import {
  getPendingFearlessSyncRecords,
  saveLocalHistoryRecord,
  updateLocalHistoryRecord,
  type LocalHistoryMode,
  type LocalHistoryRecord,
} from "./localHistory";

export const defaultFearlessSeriesId = "fearless-001";

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
};

export type FearlessSeriesGame = {
  seriesId: string;
  gameNumber: number;
  blueTeam: number[];
  redTeam: number[];
  createdAt: string;
};
type ApiResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  championId?: number;
  seriesId?: string;
  gameNumber?: number;
};
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
  constructor(message: string, readonly diagnostic = "") {
    super(message);
    this.name = "FearlessSyncError";
  }
}

const ensuredSeries = new Set<string>();
const pendingSeriesChecks = new Map<string, Promise<void>>();
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
  method: "GET" | "POST",
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
  if (payload?.error === "CHAMPION_ALREADY_USED" && payload.championId) {
    return `El campeon con ID ${payload.championId} ya se uso en esta serie.`;
  }
  const detail = payload?.message ?? payload?.error;
  return detail ? `La API rechazo la peticion: ${detail}.` : fallback;
}

async function apiRequest(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<ApiResult> {
  if ("__TAURI_INTERNALS__" in window) {
    let native: NativeApiResult;
    try {
      native = await invoke<NativeApiResult>("fearless_api_request", {
        apiUrl: getApiRequestUrl(),
        method,
        path,
        body: body ?? null,
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
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "POST" ? JSON.stringify(body) : undefined,
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

/** Crea la serie una vez por sesion y acepta que ya exista en el servidor. */
export function ensureFearlessSeries(
  seriesId = defaultFearlessSeriesId,
): Promise<void> {
  const cacheKey = seriesCacheKey(seriesId);
  if (ensuredSeries.has(cacheKey)) return Promise.resolve();
  const pending = pendingSeriesChecks.get(cacheKey);
  if (pending) return pending;

  const path = "/api/series";
  const body = { seriesId };
  const check = apiRequest("POST", path, body)
    .then((result) => {
      const payload = result.payload as ApiResponse | null;
      const alreadyExists = result.status === 409 ||
        payload?.error === "SERIES_ALREADY_EXISTS" ||
        payload?.error === "SERIES_EXISTS";
      if (!result.ok && !alreadyExists) {
        throw new FearlessSyncError(
          describeApiError(payload, "No se pudo crear la serie Fearless."),
          formatApiDiagnostic("POST", path, result, body),
        );
      }
      ensuredSeries.add(cacheKey);
    })
    .finally(() => pendingSeriesChecks.delete(cacheKey));

  pendingSeriesChecks.set(cacheKey, check);
  return check;
}

export async function getUsedFearlessChampionIds(
  seriesId = defaultFearlessSeriesId,
  options: { force?: boolean } = {},
) {
  return readThroughCache(usedChampionsCache, seriesCacheKey(seriesId), async () => {
    const path = `/api/series/${encodeURIComponent(seriesId)}/used-champions`;
    let result = await apiRequest("GET", path);
    if (result.status === 404) {
      ensuredSeries.delete(seriesCacheKey(seriesId));
      await ensureFearlessSeries(seriesId);
      result = await apiRequest("GET", path);
    }
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
    ensuredSeries.add(seriesCacheKey(seriesId));
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
  if (result.status === 404 && payload?.error === "SERIES_NOT_FOUND") {
    ensuredSeries.delete(seriesCacheKey(seriesId));
    return [];
  }
  if (!result.ok) {
    throw new FearlessSyncError(
      describeApiError(payload, "No se pudo cargar el historial de la API."),
      formatApiDiagnostic("GET", path, result),
    );
  }
  ensuredSeries.add(seriesCacheKey(seriesId));

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

async function getNextFearlessGameNumber(seriesId: string) {
  const games = await getFearlessSeriesGames(seriesId);
  return Math.max(0, ...games.map((game) => game.gameNumber)) + 1;
}

export async function saveFearlessGame({
  seriesId = defaultFearlessSeriesId,
  blueTeam,
  redTeam,
  gameNumber,
  idempotencyKey,
}: {
  seriesId?: string;
  blueTeam: number[];
  redTeam: number[];
  gameNumber: number;
  idempotencyKey: string;
}) {
  validateTeams(blueTeam, redTeam);
  if (!Number.isInteger(gameNumber) || gameNumber < 1) {
    throw new FearlessSyncError("La partida no tiene un número válido para sincronizar.");
  }
  if (!idempotencyKey) {
    throw new FearlessSyncError("La partida no tiene una clave de sincronización válida.");
  }
  await ensureFearlessSeries(seriesId);

  const path = `/api/series/${encodeURIComponent(seriesId)}/games`;
  // La API actual requiere que el cliente indique el siguiente número de la serie.
  const body = { gameNumber, blueTeam, redTeam, idempotencyKey };
  const result = await apiRequest("POST", path, body);
  const payload = result.payload as ApiResponse | null;
  const diagnostic = formatApiDiagnostic("POST", path, result, body);
  if (!result.ok || payload?.success === false) {
    throw new FearlessSyncError(
      describeApiError(payload, "No se pudo guardar la partida en la API."),
      diagnostic,
    );
  }
  const savedGameNumber = payload?.gameNumber;
  if (!Number.isInteger(savedGameNumber) || (savedGameNumber ?? 0) < 1) {
    throw new FearlessSyncError(
      "La API no devolvió un número de partida válido.",
      diagnostic,
    );
  }
  invalidateSeriesReadCache(seriesId);
  return {
    seriesId: payload?.seriesId ?? seriesId,
    gameNumber: savedGameNumber as number,
    diagnostic,
  };
}

export async function syncFearlessLocalRecord(record: LocalHistoryRecord) {
  if (record.kind !== "fearless" || record.connectionMode !== "online") return null;
  const attempts = (record.syncAttemptCount ?? 0) + 1;
  updateLocalHistoryRecord(record.id, {
    syncStatus: "pending",
    syncError: undefined,
    syncAttemptCount: attempts,
    syncUpdatedAt: new Date().toISOString(),
  });
  try {
    const seriesId = record.seriesId ?? defaultFearlessSeriesId;
    // Persistimos el número antes de enviar para reutilizarlo en un reintento.
    const gameNumber = record.remoteGameNumber ?? await getNextFearlessGameNumber(seriesId);
    if (record.remoteGameNumber !== gameNumber) {
      updateLocalHistoryRecord(record.id, { remoteGameNumber: gameNumber });
    }
    const result = await saveFearlessGame({
      seriesId,
      blueTeam: record.blueTeam,
      redTeam: record.redTeam,
      gameNumber,
      idempotencyKey: record.id,
    });
    updateLocalHistoryRecord(record.id, {
      remoteGameNumber: result.gameNumber,
      syncStatus: "synced",
      syncError: undefined,
      syncAttemptCount: attempts,
      syncUpdatedAt: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    updateLocalHistoryRecord(record.id, {
      syncStatus: "failed",
      syncError: error instanceof Error ? error.message : "Error de sincronización desconocido.",
      syncAttemptCount: attempts,
      syncUpdatedAt: new Date().toISOString(),
    });
    throw error;
  }
}

/** Reintenta la cola local en orden. El servidor debe deduplicar por idempotencyKey. */
export function syncPendingFearlessGames() {
  if (pendingSync) return pendingSync;
  pendingSync = (async () => {
    const recordsBySeries = new Map<string, LocalHistoryRecord[]>();
    for (const record of getPendingFearlessSyncRecords()) {
      const seriesId = record.seriesId ?? defaultFearlessSeriesId;
      const records = recordsBySeries.get(seriesId) ?? [];
      records.push(record);
      recordsBySeries.set(seriesId, records);
    }

    for (const [seriesId, records] of recordsBySeries) {
      let nextGameNumber: number | undefined;
      for (const originalRecord of records) {
        let record = originalRecord;
        try {
          if (!record.remoteGameNumber) {
            if (!nextGameNumber) {
              const games = await getFearlessSeriesGames(seriesId, { force: true });
              nextGameNumber = Math.max(0, ...games.map((game) => game.gameNumber)) + 1;
            }
            updateLocalHistoryRecord(record.id, { remoteGameNumber: nextGameNumber });
            record = { ...record, remoteGameNumber: nextGameNumber };
          }
          const result = await syncFearlessLocalRecord(record);
          if (result) nextGameNumber = result.gameNumber + 1;
        } catch {
          // Una serie es secuencial: no enviamos el resto con números que el servidor rechazará.
          break;
        }
      }
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
}: {
  seriesId?: string;
  blueTeam: number[];
  redTeam: number[];
  connectionMode: LocalHistoryMode;
}) {
  validateTeams(blueTeam, redTeam);
  return saveLocalHistoryRecord({
    kind: "fearless",
    seriesId,
    blueTeam,
    redTeam,
    connectionMode,
  });
}
