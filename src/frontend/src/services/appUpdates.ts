import { isTauri } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import appConfig from "../../../backend/tauri.conf.json";

export const releasesUrl = "https://api.github.com/repos/Ivimanhm/PersoBuilder/releases?per_page=100";
const releasePath = "/Ivimanhm/PersoBuilder/releases/";
const snapshotKey = "perso-builder-update-check";
// La caducidad solo se consulta al entrar; no programa comprobaciones periódicas.
const cacheMaxAge = 15 * 60 * 1000;

export type AppUpdate = { version: string; tag: string; downloadUrl: string };
export type AndroidUpdate = AppUpdate;
export type UpdatePlatform = "android" | "windows";
export type UpdateCheck = { installedVersion: string; update: AppUpdate | null };

function parseVersion(value: string): number[] | null {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[\w.-]+)?$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1, 4).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left), b = parseVersion(right);
  if (!a || !b) throw new Error("El número de versión no es válido.");
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export function isReleaseDownload(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" &&
      !url.username && !url.password && !url.port && !url.search && !url.hash &&
      url.pathname.startsWith(`${releasePath}download/`) && url.pathname.endsWith(".apk");
  } catch { return false; }
}

export function selectAndroidUpdate(payload: unknown, installedVersion: string): AndroidUpdate | null {
  return selectUpdate(payload, installedVersion, "android");
}

export function selectWindowsUpdate(payload: unknown, installedVersion: string): AppUpdate | null {
  return selectUpdate(payload, installedVersion, "windows");
}

function selectUpdate(payload: unknown, installedVersion: string, platform: UpdatePlatform): AppUpdate | null {
  if (!Array.isArray(payload)) throw new Error("GitHub devolvió una respuesta no válida.");
  if (!parseVersion(installedVersion)) throw new Error("No se pudo leer la versión instalada.");
  let update: AppUpdate | null = null;
  for (const release of payload) {
    if (!release || release.draft !== false || release.prerelease !== false ||
        typeof release.tag_name !== "string" || !parseVersion(release.tag_name) ||
        !Array.isArray(release.assets)) continue;
    const version = release.tag_name.replace(/^v/, "");
    if (compareVersions(version, installedVersion) <= 0 ||
        (update && compareVersions(version, update.version) <= 0)) continue;
    // The release script builds this universal APK; architecture-specific APKs
    // and AABs must not be offered to arbitrary Android devices.
    const apk = release.assets.find((asset: { name?: unknown; browser_download_url?: unknown; state?: unknown }) =>
      asset?.name === `Perso-Builder-${version}.apk` && asset.state === "uploaded" &&
      typeof asset.browser_download_url === "string" && isReleaseDownload(asset.browser_download_url));
    const installer = platform === "windows" && release.assets.some((asset: { name?: unknown; state?: unknown }) =>
      asset?.state === "uploaded" && (asset.name === `Perso-Builder-${version}.msi` ||
        asset.name === `Perso-Builder-${version}-setup.exe`));
    if (platform === "android" ? apk : installer) update = {
      version, tag: release.tag_name, downloadUrl: platform === "android" ? apk.browser_download_url :
        `https://github.com${releasePath}tag/${release.tag_name}`,
    };
  }
  return update;
}

let pending: Promise<UpdateCheck> | null = null;
let cached: UpdateCheck | null = null;
let checkedAt = 0;
let cachedPlatform: UpdatePlatform | null = null;

function readSnapshot(installedVersion: string, platform: UpdatePlatform): UpdateCheck | null {
  try {
    const snapshot = JSON.parse(localStorage.getItem(snapshotKey) ?? "null");
    const age = Date.now() - snapshot?.checkedAt;
    if (!snapshot || typeof snapshot.checkedAt !== "number" || age < 0 || age >= cacheMaxAge ||
        snapshot.platform !== platform || snapshot.result?.installedVersion !== installedVersion) return null;
    const update = snapshot.result.update;
    if (update !== null && (!update || typeof update.version !== "string" ||
        typeof update.tag !== "string" || !parseVersion(update.tag) ||
        compareVersions(update.version, update.tag) !== 0 ||
        compareVersions(update.version, installedVersion) <= 0 ||
        !(platform === "android" ? isReleaseDownload(update.downloadUrl) :
          update.downloadUrl === `https://github.com${releasePath}tag/${update.tag}`))) return null;
    cached = snapshot.result;
    cachedPlatform = platform;
    checkedAt = snapshot.checkedAt;
    return cached;
  } catch { return null; }
}

export function supportsAndroidUpdates() {
  return !isTauri() || /Android/i.test(navigator.userAgent);
}

export function checkAndroidUpdates(force = false): Promise<UpdateCheck> {
  return checkAppUpdates(force, "android");
}

export function getUpdatePlatform(): UpdatePlatform | null {
  if (supportsAndroidUpdates()) return "android";
  return /Windows/i.test(navigator.userAgent) ? "windows" : null;
}

export function checkAppUpdates(force = false, platform = getUpdatePlatform()): Promise<UpdateCheck> {
  if (!platform) return Promise.reject(new Error("Esta plataforma no admite actualizaciones."));
  if (pending) return pending;
  pending = (async () => {
    const installedVersion = isTauri() ? await getVersion() : appConfig.version;
    const age = Date.now() - checkedAt;
    if (!force && cached?.installedVersion === installedVersion && cachedPlatform === platform &&
        age >= 0 && age < cacheMaxAge) return cached;
    if (!force) {
      const snapshot = readSnapshot(installedVersion, platform);
      if (snapshot) return snapshot;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(releasesUrl, {
        headers: { Accept: "application/vnd.github+json" }, signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 403 || response.status === 429
        ? "GitHub ha limitado las consultas. Inténtalo más tarde."
        : "No se pudieron consultar las actualizaciones. Inténtalo de nuevo.");
      const result = { installedVersion, update: selectUpdate(await response.json(), installedVersion, platform) };
      cached = result;
      cachedPlatform = platform;
      checkedAt = Date.now();
      try {
        localStorage.setItem(snapshotKey, JSON.stringify({ result, checkedAt, platform }));
      } catch { /* La caché en memoria funciona sin almacenamiento local. */ }
      return result;
    } finally { window.clearTimeout(timeout); }
  })().finally(() => { pending = null; });
  return pending;
}

export async function downloadAndroidUpdate(update: AndroidUpdate) {
  if (!isReleaseDownload(update.downloadUrl)) throw new Error("El enlace de descarga no es válido.");
  await openUpdateUrl(update.downloadUrl);
}

export async function openAppUpdate(update: AppUpdate, platform = getUpdatePlatform()) {
  if (!(platform === "android" ? isReleaseDownload(update.downloadUrl) :
      platform === "windows" && !!parseVersion(update.tag) &&
      update.downloadUrl === `https://github.com${releasePath}tag/${update.tag}`)) {
    throw new Error("El enlace de actualización no es válido.");
  }
  await openUpdateUrl(update.downloadUrl);
}

async function openUpdateUrl(url: string) {
  if (isTauri()) await openUrl(url);
  else {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
  }
}
