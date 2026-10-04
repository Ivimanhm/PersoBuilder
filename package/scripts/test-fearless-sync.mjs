import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(root, "src/frontend/package.json"));
const ts = require("typescript");
const ids = (count, start = 1) => Array.from({ length: count }, (_, i) => i + start);
const state = (seriesId = "server-generated-id", count = 20, nextGameNumber = 1) => ({
  seriesId, availableChampions: ids(count), usedChampions: [], nextGameNumber,
  catalogVersion: "2026.10", totalChampions: count,
});

function harness(respond, native = false) {
  const storage = new Map([["perso-builder-api-url", "https://example.org/custom-base/"]]);
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const calls = [];
  const request = async (method, path, body, authToken) => {
    calls.push({ method, path, body, authToken });
    return respond({ method, path, body, authToken });
  };
  const window = { setTimeout, clearTimeout, ...(native ? { __TAURI_INTERNALS__: {} } : {}) };
  const fetch = async (url, options) => {
    assert.ok(url.startsWith("https://example.org/custom-base/api/"));
    const { status = 200, payload } = await request(options.method,
      url.slice("https://example.org/custom-base".length),
      options.body ? JSON.parse(options.body) : undefined, options.headers.Authorization);
    return { ok: status >= 200 && status < 300, status, statusText: "", text: async () => JSON.stringify(payload) };
  };
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} };
    cache.set(path, module);
    const js = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const localRequire = (specifier) => {
      if (specifier === "@tauri-apps/api/core") return { invoke: async (command, args) => {
        assert.equal(command, "fearless_api_request");
        assert.equal(args.apiUrl, "https://example.org/custom-base");
        const { status = 200, payload } = await request(args.method, args.path, args.body, args.authToken);
        return { ok: status >= 200 && status < 300, status, statusText: "", body: JSON.stringify(payload), error: null };
      } };
      return load(resolve(dirname(path), `${specifier}.ts`));
    };
    new Function("require", "module", "exports", "window", "localStorage", "fetch", js)(
      localRequire, module, module.exports, window, localStorage, fetch);
    return module.exports;
  }
  return {
    api: load(resolve(root, "src/frontend/src/services/fearlessSync.ts")),
    history: load(resolve(root, "src/frontend/src/services/localHistory.ts")), calls,
  };
}

function prepareLocal(h, prepared) {
  return h.api.saveFearlessGameLocally({ seriesId: prepared.seriesId, preparedGameNumber: prepared.nextGameNumber,
    minimumGameNumber: prepared.nextGameNumber, connectionMode: "online",
    blueTeam: prepared.availableChampions.slice(0, 5), redTeam: prepared.availableChampions.slice(5, 10) });
}

for (const native of [false, true]) {
  test(`GET / POST completo y cambio de serie (${native ? "Tauri" : "web"})`, async () => {
    let active = state("opaque-series-A", 19, 7);
    const saved = [];
    const h = harness(({ method, path, body, authToken }) => {
      assert.equal(path, "/api/fearless");
      assert.ok(!authToken);
      if (method === "GET") return { payload: active };
      assert.deepEqual(Object.keys(body).sort(), ["blueTeam", "gameNumber", "redTeam", "seriesId"]);
      assert.equal(body.seriesId, active.seriesId);
      assert.equal(body.gameNumber, active.nextGameNumber);
      assert.deepEqual(body.blueTeam, ids(5));
      assert.deepEqual(body.redTeam, ids(5, 6));
      saved.push(body);
      active = state("opaque-series-B", 19);
      return { payload: { game: body, seriesId: body.seriesId, seriesArchived: true, activeSeriesId: active.seriesId } };
    }, native);
    const prepared = await h.api.getFearlessState();
    const record = prepareLocal(h, prepared);
    // Simultaneous confirmation and background queue share a single request.
    const first = h.api.syncFearlessLocalRecord(record);
    const second = h.api.syncFearlessLocalRecord(record);
    await h.api.syncPendingFearlessGames();
    assert.equal(first, second);
    const result = await first;
    assert.equal(result.seriesArchived, true);
    assert.equal(h.history.getLocalHistory()[0].syncStatus, "synced");
    await h.api.syncFearlessLocalRecord(record);
    assert.equal(saved.length, 1);
    const next = await h.api.getFearlessState();
    assert.equal(next.seriesId, "opaque-series-B");
    assert.equal(next.nextGameNumber, 1);
    assert.deepEqual(next.availableChampions, ids(19));
    assert.equal(record.seriesId, "opaque-series-A");
    assert.equal(record.remoteGameNumber, 7);
  });
}

test("Con 10 disponibles se prepara en la misma serie; no se inventan IDs", async () => {
  const h = harness(() => ({ payload: state("same-series", 10, 3) }));
  assert.equal((await h.api.getFearlessState()).seriesId, "same-series");
  assert.equal((await h.api.getFearlessState()).availableChampions.length, 10);
  assert.equal(h.calls.length, 2); // Fresh GET for each preparation, no read TTL.
});

test("POST que deja exactamente 10 disponibles conserva la serie", async () => {
  let active = state("continues", 20, 2);
  const h = harness(({ method, body }) => {
    if (method === "GET") return { payload: active };
    active = { ...active, availableChampions: ids(10, 11), usedChampions: ids(10), nextGameNumber: 3 };
    return { payload: { game: body, seriesId: body.seriesId, seriesArchived: false, activeSeriesId: body.seriesId } };
  });
  const record = prepareLocal(h, await h.api.getFearlessState());
  assert.equal((await h.api.syncFearlessLocalRecord(record)).seriesArchived, false);
  const next = await h.api.getFearlessState();
  assert.equal(next.seriesId, "continues");
  assert.equal(next.nextGameNumber, 3);
  assert.deepEqual(next.availableChampions, ids(10, 11));
});

test("409 bloquea la partida antigua y vuelve a consultar Fearless", async () => {
  let active = state("old");
  const h = harness(({ method }) => method === "GET" ? { payload: active } :
    { status: 409, payload: { error: "fearless_series_changed" } });
  const record = prepareLocal(h, await h.api.getFearlessState());
  active = state("new");
  await assert.rejects(h.api.syncFearlessLocalRecord(record), (error) => error.code === "fearless_series_changed");
  const stored = h.history.getLocalHistory()[0];
  assert.equal(stored.seriesId, "old");
  assert.equal(stored.syncStatus, "failed");
  assert.equal(stored.syncBlocked, true);
  assert.equal(h.calls.at(-1).method, "GET");
  await h.api.syncPendingFearlessGames();
  await h.api.syncFearlessLocalRecord(record);
  assert.equal(h.calls.filter((call) => call.method === "POST").length, 1);
});

test("503 de catálogo en GET muestra error y permite reintentar", async () => {
  let unavailable = true;
  const h = harness(() => unavailable ? { status: 503, payload: { error: "catalog_unavailable" } } : { payload: state() });
  await assert.rejects(h.api.getFearlessState(), (error) => error.code === "catalog_unavailable");
  unavailable = false;
  assert.equal((await h.api.getFearlessState()).availableChampions.length, 20);
});

test("POST fallido sigue pendiente; reintento conserva serie y número", async () => {
  let failed = true;
  const h = harness(({ method, path, body }) => {
    if (method === "GET") return { payload: path === "/api/fearless" ? state("prepared", 20, 4) : { games: [] } };
    return failed ? { status: 503, payload: { error: "catalog_unavailable" } } :
      { payload: { game: body, seriesId: body.seriesId, seriesArchived: false, activeSeriesId: body.seriesId } };
  });
  const record = prepareLocal(h, await h.api.getFearlessState());
  await assert.rejects(h.api.syncFearlessLocalRecord(record));
  assert.equal(h.history.getLocalHistory()[0].syncStatus, "failed");
  failed = false;
  await h.api.syncPendingFearlessGames();
  assert.equal(h.history.getLocalHistory()[0].syncStatus, "synced");
  const posts = h.calls.filter((call) => call.method === "POST");
  assert.deepEqual(posts[0].body, posts[1].body);
});

test("Respuesta perdida se reconcilia sin duplicar POST", async () => {
  let saved;
  const h = harness(({ method, path, body }) => {
    if (method === "GET") return { payload: path === "/api/fearless" ? state() : { games: [saved] } };
    saved = body;
    throw new Error("connection lost after server commit");
  });
  const record = prepareLocal(h, await h.api.getFearlessState());
  await assert.rejects(h.api.syncFearlessLocalRecord(record));
  assert.equal(h.history.getLocalHistory()[0].syncStatus, "failed");
  await h.api.syncPendingFearlessGames();
  assert.equal(h.history.getLocalHistory()[0].syncStatus, "synced");
  assert.equal(h.calls.filter((call) => call.method === "POST").length, 1);
});

test("Estado inválido, equipos inválidos y partidas antiguas sin preparación no se envían", async () => {
  const h = harness(() => ({ payload: { ...state(), availableChampions: null } }));
  await assert.rejects(h.api.getFearlessState());
  await assert.rejects(h.api.saveFearlessGame({ seriesId: "x", gameNumber: 1, blueTeam: ids(5), redTeam: ids(5) }));
  const legacy = h.api.saveFearlessGameLocally({ connectionMode: "online", blueTeam: ids(5), redTeam: ids(5, 6) });
  await assert.rejects(h.api.syncFearlessLocalRecord(legacy));
  assert.equal(h.calls.filter((call) => call.method === "POST").length, 0);
});

test("Listado de series para el historial funciona en web y Tauri", async () => {
  for (const native of [false, true]) {
    const h = harness(({ method, path }) => {
      assert.equal(method, "GET");
      assert.equal(path, "/api/series");
      return { payload: { success: true, series: [
        { seriesId: "fearless-002", gamesCount: 2 }, { seriesId: "fearless-001", gamesCount: 17 },
      ] } };
    }, native);
    assert.deepEqual(await h.api.getFearlessSeriesSummaries(), [
      { seriesId: "fearless-002", gamesCount: 2 }, { seriesId: "fearless-001", gamesCount: 17 },
    ]);
  }
});

test("Errores y listados de series inválidos no se interpretan como series vacías", async () => {
  for (const response of [
    { status: 503, payload: { error: "unavailable" } },
    { payload: { series: null } },
    { payload: { series: [{ seriesId: "fearless-001", gamesCount: -1 }] } },
  ]) {
    const h = harness(() => response);
    await assert.rejects(h.api.getFearlessSeriesSummaries());
  }
  const h = harness(() => ({ payload: { success: true, series: [] } }));
  assert.deepEqual(await h.api.getFearlessSeriesSummaries(), []);
});

test("POST con respuesta inválida no marca synced; 404 de historial no crea series", async () => {
  const h = harness(({ method, path }) => {
    if (path === "/api/fearless" && method === "GET") return { payload: state() };
    if (method === "POST") return { payload: { seriesId: "wrong", gameNumber: 1 } };
    return { status: 404, payload: { error: "series_not_found" } };
  });
  const record = prepareLocal(h, await h.api.getFearlessState());
  await assert.rejects(h.api.syncFearlessLocalRecord(record));
  assert.equal(h.history.getLocalHistory()[0].syncStatus, "failed");
  await assert.rejects(h.api.getUsedFearlessChampionIds("missing"));
  assert.equal(h.calls.filter((call) => call.method === "POST").length, 1);
});
