import { invoke } from "@tauri-apps/api/core";
import { getApiRequestUrl, getApiUrl } from "./appSettings";

export type ConnectionStatus = "online" | "offline";
type NativeHealthCheck = { online: boolean; status: number | null; detail: string };
export type HealthCheckResult = { status: ConnectionStatus; detail: string };

type ConnectionSnapshot = {
  status: ConnectionStatus;
  checkedAt: number;
  apiUrl: string;
  manualLocal?: boolean;
};

const connectionSnapshotKey = "perso-builder-connection-status";
const automaticCheckInterval = 10 * 60 * 1_000;

function readSnapshot(): ConnectionSnapshot | null {
  try {
    const value = JSON.parse(localStorage.getItem(connectionSnapshotKey) ?? "null") as ConnectionSnapshot | null;
    return value && (value.status === "online" || value.status === "offline") &&
      typeof value.checkedAt === "number" && typeof value.apiUrl === "string" ? value : null;
  } catch { return null; }
}

const initialSnapshot = readSnapshot();
let currentStatus: ConnectionStatus = initialSnapshot?.apiUrl === getApiUrl()
  ? initialSnapshot.status
  : "offline";
let automaticCheck: Promise<void> | null = null;
const listeners = new Set<(status: ConnectionStatus) => void>();

export function getConnectionStatus() { return currentStatus; }
export function subscribeToConnectionStatus(listener: (status: ConnectionStatus) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function setConnectionStatus(
  status: ConnectionStatus,
  apiUrl?: string,
  manualLocal = false,
) {
  currentStatus = status;
  if (apiUrl) {
    try {
      localStorage.setItem(connectionSnapshotKey, JSON.stringify({
        status,
        apiUrl: apiUrl.trim(),
        checkedAt: Date.now(),
        manualLocal,
      }));
    } catch { /* El estado en memoria sigue siendo válido. */ }
  }
  listeners.forEach((listener) => listener(status));
}

export function refreshConnectionStatusIfStale() {
  if (automaticCheck) return automaticCheck;
  const apiUrl = getApiUrl();
  const snapshot = readSnapshot();
  if (snapshot?.apiUrl === apiUrl && snapshot.manualLocal) {
    setConnectionStatus("offline");
    return Promise.resolve();
  }
  if (snapshot?.apiUrl === apiUrl && Date.now() - snapshot.checkedAt < automaticCheckInterval) {
    setConnectionStatus(snapshot.status);
    return Promise.resolve();
  }
  automaticCheck = checkApiHealth(apiUrl)
    .then(() => undefined)
    .finally(() => { automaticCheck = null; });
  return automaticCheck;
}

/** Activa el modo local de inmediato y lo mantiene hasta que el usuario solicite Online. */
export function activateLocalMode() {
  setConnectionStatus("offline", getApiUrl(), true);
}

/** Comprueba la API sin alterar nunca la URL guardada por el usuario. */
export async function checkApiHealth(apiUrl: string): Promise<HealthCheckResult> {
  if ("__TAURI_INTERNALS__" in window) {
    try {
      const result = await invoke<NativeHealthCheck>("check_api_health", { apiUrl });
      if (result.online) {
        setConnectionStatus("online", apiUrl);
        return { status: "online", detail: result.detail };
      }
      setConnectionStatus("offline", apiUrl);
      return { status: "offline", detail: result.detail };
    } catch (error) {
      console.error("No se pudo invocar el health check nativo", error);
    }
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${getApiRequestUrl(apiUrl)}/api/health`, { signal: controller.signal });
    const status: ConnectionStatus = response.ok ? "online" : "offline";
    setConnectionStatus(status, apiUrl);
    const body = await response.clone().text().catch((error) => `<error leyendo cuerpo: ${String(error)}>`);
    const command = `curl.exe -sSL --max-time 5 \"${getApiRequestUrl(apiUrl)}/api/health\"`;
    let formattedBody = body;
    try { formattedBody = JSON.stringify(JSON.parse(body), null, 2); } catch { /* El cuerpo no es JSON. */ }
    return { status, detail: `COMANDO USADO\n${command}\n\nRESPUESTA · HTTP ${response.status}\n${formattedBody}` };
  } catch (error) {
    setConnectionStatus("offline", apiUrl);
    return {
      status: "offline",
      detail: `ERROR\nNo se pudo verificar el health check. La API debe permitir CORS para esta ejecución web.\n${String(error)}`,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
