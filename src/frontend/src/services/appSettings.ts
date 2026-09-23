const apiUrlKey = "perso-builder-api-url";

export const defaultApiUrl =
  "https://fearless-sync.ivimanhm.chatgpt.site";

export function getApiUrl() {
  return localStorage.getItem(apiUrlKey) || defaultApiUrl;
}

export function saveApiUrl(apiUrl: string) {
  localStorage.setItem(apiUrlKey, normalizeApiUrl(apiUrl));
}

/** URL efectiva para peticiones: evita la redirección antigua del dominio de la API. */
export function getApiRequestUrl(apiUrl = getApiUrl()) {
  return normalizeApiUrl(apiUrl);
}

export function normalizeApiUrl(apiUrl: string) {
  try {
    const parsed = new URL(apiUrl.trim());
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) throw new Error("URL no permitida");
    if (parsed.hostname === "fearless-sync.daring-venus-3030.chatgpt.site") {
      parsed.hostname = "fearless-sync.ivimanhm.chatgpt.site";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    throw new Error("La URL de la API debe ser HTTPS y no puede incluir credenciales, consulta ni fragmento.");
  }
}
