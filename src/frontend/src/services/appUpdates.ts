import { isTauri } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import appConfig from "../../../backend/tauri.conf.json";

export const releasesUrl = "https://api.github.com/repos/Ivimanhm/PersoBuilder/releases?per_page=100";
const releasePath = "/Ivimanhm/PersoBuilder/releases/";
const seenKey = "perso-builder-update-seen";
const checkInterval = 15 * 60 * 1000;

export type AndroidUpdate = { version: string; tag: string; downloadUrl: string };
export type UpdateCheck = { installedVersion: string; update: AndroidUpdate | null };

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
  if (!Array.isArray(payload)) throw new Error("GitHub devolvió una respuesta no válida.");
  if (!parseVersion(installedVersion)) throw new Error("No se pudo leer la versión instalada.");
  let update: AndroidUpdate | null = null;
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
    if (apk) update = {
      version, tag: release.tag_name, downloadUrl: apk.browser_download_url,
    };
  }
  return update;
}

let pending: Promise<UpdateCheck> | null = null;
let cached: UpdateCheck | null = null;
let checkedAt = 0;

export function supportsAndroidUpdates() {
  return !isTauri() || /Android/i.test(navigator.userAgent);
}

export function checkAndroidUpdates(force = false): Promise<UpdateCheck> {
  if (pending) return pending;
  if (!force && cached && Date.now() - checkedAt < checkInterval) return Promise.resolve(cached);
  pending = (async () => {
    const installedVersion = isTauri() ? await getVersion() : appConfig.version;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(releasesUrl, {
        headers: { Accept: "application/vnd.github+json" }, signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 403 || response.status === 429
        ? "GitHub ha limitado las consultas. Inténtalo más tarde."
        : "No se pudieron consultar las actualizaciones. Inténtalo de nuevo.");
      const result = { installedVersion, update: selectAndroidUpdate(await response.json(), installedVersion) };
      cached = result;
      checkedAt = Date.now();
      return result;
    } finally { window.clearTimeout(timeout); }
  })().finally(() => { pending = null; });
  return pending;
}

export function wasUpdateRead(tag: string) {
  try { return localStorage.getItem(seenKey) === tag; } catch { return false; }
}

export function markUpdateRead(tag: string) {
  try { localStorage.setItem(seenKey, tag); } catch { /* Reading still works in memory. */ }
}

export async function downloadAndroidUpdate(update: AndroidUpdate) {
  if (!isReleaseDownload(update.downloadUrl)) throw new Error("El enlace de descarga no es válido.");
  if (isTauri()) await openUrl(update.downloadUrl);
  else {
    const opened = window.open(update.downloadUrl, "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
  }
}
