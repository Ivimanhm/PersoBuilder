import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(resolve(root, "src/frontend/package.json"));
const ts = require("typescript");
const appVersion = JSON.parse(readFileSync(resolve(root, "src/backend/tauri.conf.json"), "utf8")).version;
const release = (version, overrides = {}) => ({
  tag_name: `v${version}`, draft: false, prerelease: false, body: "Cambios",
  assets: [{ name: `Perso-Builder-${version}.apk`, state: "uploaded",
    browser_download_url: `https://github.com/Ivimanhm/PersoBuilder/releases/download/v${version}/Perso-Builder-${version}.apk` }],
  ...overrides,
});

function harness({ native = false, installed = appVersion, respond = () => ({ status: 200, body: [] }) } = {}) {
  const storage = new Map(), requests = [], opened = [];
  const module = { exports: {} };
  const js = ts.transpileModule(readFileSync(resolve(root, "src/frontend/src/services/appUpdates.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const imports = name => {
    if (name === "@tauri-apps/api/core") return { isTauri: () => native };
    if (name === "@tauri-apps/api/app") return { getVersion: async () => installed };
    if (name === "@tauri-apps/plugin-opener") return { openUrl: async url => opened.push(url) };
    if (name.endsWith("tauri.conf.json")) return { default: { version: installed } };
    throw new Error(name);
  };
  const fetch = async (url, options) => {
    requests.push(url);
    assert.equal(url, "https://api.github.com/repos/Ivimanhm/PersoBuilder/releases?per_page=100");
    assert.ok(options.signal instanceof AbortSignal);
    const { status, body } = await respond();
    return { ok: status === 200, status, json: async () => body };
  };
  new Function("require", "module", "exports", "window", "navigator", "localStorage", "fetch", js)(
    imports, module, module.exports,
    { setTimeout, clearTimeout, open: url => { opened.push(url); return null; } },
    { userAgent: "Android" },
    { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, fetch,
  );
  return { api: module.exports, requests, opened, storage };
}

test("compares version numbers numerically, including optional v prefix", () => {
  const { api } = harness();
  assert.equal(api.compareVersions("v1.10.0", "1.9.9"), 1);
  assert.equal(api.compareVersions(appVersion, `v${appVersion}`), 0);
  assert.throws(() => api.compareVersions("1.2.0-beta", appVersion));
});

test("selects newest stable universal APK regardless of release ordering", () => {
  const { api } = harness();
  const result = api.selectAndroidUpdate([release("1.2.0"), release("1.10.0"), release("1.3.0")], appVersion);
  assert.equal(result.version, "1.10.0");
});

test("ignores drafts, previews, missing APKs and architecture-specific APKs", () => {
  const { api } = harness();
  const invalid = [release("2.0.0", { draft: true }), release("3.0.0", { prerelease: true }),
    release("4.0.0", { assets: [] }), release("5.0.0", { assets: [{ name: "android-arm64.apk" }] }),
    release("6.0.0-beta"), release("7.0.0", { assets: [{ name: "Perso-Builder-7.0.0.aab" }] })];
  assert.equal(api.selectAndroidUpdate(invalid, appVersion), null);
});

test("does not offer the installed version or downgrades", () => {
  const { api } = harness();
  assert.equal(api.selectAndroidUpdate([release(appVersion), release("1.0.0")], appVersion), null);
});

test("rejects links outside this repository and malformed API responses", () => {
  const { api } = harness();
  for (const url of ["https://evil.test/file.apk", "https://github.com/other/repo/releases/download/v2/app.apk",
    "https://github.com@evil.test/Ivimanhm/PersoBuilder/releases/download/v2/app.apk", "javascript:alert(1)"]) {
    assert.equal(api.isReleaseDownload(url), false);
  }
  assert.throws(() => api.selectAndroidUpdate({ message: "error" }, appVersion));
});

test("reading an update persists its tag and does not hide a later update", () => {
  const { api } = harness();
  api.markUpdateRead("v1.2.0");
  assert.equal(api.wasUpdateRead("v1.2.0"), true);
  assert.equal(api.wasUpdateRead("v1.3.0"), false);
});

test("deduplicates concurrent checks, caches successes and allows explicit refresh", async () => {
  const { api, requests } = harness({ respond: () => ({ status: 200, body: [release("1.2.0")] }) });
  const [first, second] = await Promise.all([api.checkAndroidUpdates(), api.checkAndroidUpdates(true)]);
  assert.equal(first, second);
  assert.equal(requests.length, 1);
  await api.checkAndroidUpdates();
  assert.equal(requests.length, 1);
  await api.checkAndroidUpdates(true);
  assert.equal(requests.length, 2);
});

test("HTTP failures are errors, not an empty update list, and can be retried", async () => {
  let fail = true;
  const { api, requests } = harness({ respond: () => ({ status: fail ? 503 : 200, body: [release("1.2.0")] }) });
  await assert.rejects(api.checkAndroidUpdates());
  fail = false;
  assert.equal((await api.checkAndroidUpdates()).update.version, "1.2.0");
  assert.equal(requests.length, 2);
});

test("rate limits explain that the user should retry later", async () => {
  const { api } = harness({ respond: () => ({ status: 429 }) });
  await assert.rejects(api.checkAndroidUpdates(), /limitado/);
});

test("native check reads the installed version and opens the APK through the OS", async () => {
  const { api, opened } = harness({ native: true, installed: "1.1.0", respond: () => ({ status: 200, body: [release("1.2.0")] }) });
  const result = await api.checkAndroidUpdates();
  assert.equal(result.installedVersion, "1.1.0");
  await api.downloadAndroidUpdate(result.update);
  assert.equal(opened[0], result.update.downloadUrl);
  await assert.rejects(api.downloadAndroidUpdate({ downloadUrl: "https://evil.test/app.apk" }));
});
