import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..", "..");
const backendDatasetDir = path.join(root, "src", "backend", "resources", "data");
const portraitsDir = path.join(root, "src", "frontend", "public", "champions");
const frontendDatasetPath = path.join(root, "src", "frontend", "public", "champions.json");
const versionsUrl = "https://ddragon.leagueoflegends.com/api/versions.json";
const ratesUrl = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-champion-statistics/global/default/rcp-fe-lol-champion-statistics.js";
const cdragonMetadataUrl = "https://raw.communitydragon.org/latest/content-metadata.json";
const roleNames = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "SUPPORT"];
const roleMap = { TOP: "top", JUNGLE: "jungle", MIDDLE: "mid", BOTTOM: "adc", SUPPORT: "support" };
const requestTimeoutMs = 15_000;
const requestAttempts = 3;

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= requestAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`${response.status} al descargar ${url}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < requestAttempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`No se pudo descargar ${url}: ${String(lastError)}`);
}

async function getJson(url) {
  const response = await fetchWithRetry(url);
  return response.json();
}

async function writeAtomic(destination, contents) {
  const temporary = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, destination);
}

function extractRoleRates(source) {
  const marker = ".exports=";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("No se encontró el objeto de estadísticas de posiciones.");
  const objectStart = source.indexOf("{", start + marker.length);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = objectStart; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) {
      const literal = source.slice(objectStart, index + 1)
        .replace(/([,{])([A-Z][A-Z0-9_]*):/g, '$1"$2":')
        .replace(/([{,])(\d+):/g, '$1"$2":')
        .replace(/:(\.\d+)/g, ":0$1");
      return JSON.parse(literal);
    }
  }
  throw new Error("El objeto de estadísticas está incompleto.");
}

function positionsFor(championId, rates) {
  const entries = roleNames.map((role) => ({ role, rate: Number(rates[role]?.[championId] ?? 0) }));
  entries.sort((a, b) => b.rate - a.rate);
  const primary = entries[0];
  if (!primary || primary.rate <= 0) return [];
  return entries
    .filter(({ rate }, index) => index === 0 || (rate >= primary.rate * 0.18 && rate >= 0.00015))
    .slice(0, 3)
    .map(({ role }) => roleMap[role]);
}

async function downloadPortrait(version, filename) {
  const url = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${filename}`;
  const response = await fetchWithRetry(url);
  await writeFile(path.join(portraitsDir, filename), Buffer.from(await response.arrayBuffer()));
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  }));
}

await mkdir(backendDatasetDir, { recursive: true });
await mkdir(portraitsDir, { recursive: true });

const versions = await getJson(versionsUrl);
const version = process.argv[2] ?? versions[0];
if (!versions.includes(version)) throw new Error(`La versión ${version} no existe en Data Dragon.`);

const championUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/data/es_ES/champion.json`;
const [championPayload, ratesSource, cdragonMetadata] = await Promise.all([
  getJson(championUrl),
  fetchWithRetry(ratesUrl).then((response) => response.text()),
  getJson(cdragonMetadataUrl),
]);

const rates = extractRoleRates(ratesSource);
const champions = Object.values(championPayload.data)
  .map((entry) => ({
    id: Number(entry.key),
    name: entry.name,
    roles: positionsFor(entry.key, rates),
    image: `/champions/${entry.image.full}`,
    imageFile: entry.image.full,
  }))
  .filter((champion) => champion.roles.length > 0)
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

const omitted = Object.keys(championPayload.data).length - champions.length;
if (champions.length < 150) throw new Error(`Solo ${champions.length} campeones tienen posición; se aborta la actualización.`);
const championIds = new Set(champions.map((champion) => champion.id));
if (
  championIds.size !== champions.length ||
  champions.some((champion) => !Number.isInteger(champion.id) || !champion.name || !champion.image ||
    !champion.roles.length || champion.roles.some((role) => !Object.values(roleMap).includes(role)))
) throw new Error("El dataset descargado no supera la validación de esquema.");

await runPool(champions, 12, (champion) => downloadPortrait(version, champion.imageFile));
const serializedChampions = `${JSON.stringify(champions.map(({ imageFile: _, ...champion }) => champion), null, 2)}\n`;
const serializedMetadata = `${JSON.stringify({
  version,
  locale: "es_ES",
  generatedAt: new Date().toISOString(),
  championCount: champions.length,
  omittedWithoutPositionData: omitted,
  roleRule: "Posición principal y alternativas con al menos el 18% de la presencia de la principal y tasa absoluta >= 0.00015; máximo tres posiciones.",
  sources: [versionsUrl, championUrl, ratesUrl, cdragonMetadataUrl],
  communityDragonVersion: cdragonMetadata.version,
}, null, 2)}\n`;
await Promise.all([
  writeAtomic(path.join(backendDatasetDir, "champions.json"), serializedChampions),
  writeAtomic(frontendDatasetPath, serializedChampions),
  writeAtomic(path.join(backendDatasetDir, "dataset-meta.json"), serializedMetadata),
]);

console.log(`Dataset ${version}: ${champions.length} campeones, ${omitted} omitidos, retratos guardados.`);
