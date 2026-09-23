import { invoke } from "@tauri-apps/api/core";
import type {
  Champion,
  GeneratedTeams,
  GenerationMode,
  Role,
  TeamCount,
  TeamMember,
} from "../types";

const roles: Role[] = ["top", "jungle", "mid", "adc", "support"];
let catalogPromise: Promise<Champion[]> | undefined;
const warmedImageUrls = new Set<string>();

const isTauri = () => "__TAURI_INTERNALS__" in window;

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function fallbackGenerate(
  champions: Champion[],
  mode: GenerationMode,
  teamCount: TeamCount,
): GeneratedTeams {
  const memberCount = teamCount * 5;
  if (mode === "random") {
    const selected = shuffle(champions)
      .slice(0, memberCount)
      .map((champion) => ({ champion }));
    return {
      blue: selected.slice(0, 5),
      red: teamCount === 2 ? selected.slice(5) : [],
    };
  }
  const used = new Set<number>();
  const pick = (role: Role): TeamMember => {
    const champion = shuffle(
      champions.filter(
        (candidate) =>
          candidate.roles.includes(role) && !used.has(candidate.id),
      ),
    )[0];
    if (!champion)
      throw new Error(`No hay candidatos suficientes para ${role}.`);
    used.add(champion.id);
    return { champion, role };
  };
  return { blue: roles.map(pick), red: teamCount === 2 ? roles.map(pick) : [] };
}

export function getChampions(): Promise<Champion[]> {
  if (!catalogPromise) {
    const request = isTauri()
      ? invoke<Champion[]>("get_champions")
      : fetch("/champions.json").then((response) => {
          if (!response.ok)
            throw new Error("No se pudo cargar el catálogo local.");
          return response.json() as Promise<Champion[]>;
        });
    catalogPromise = request.then((champions) => {
      if (!Array.isArray(champions) || champions.some((champion) =>
        !Number.isInteger(champion.id) || !champion.name || !Array.isArray(champion.roles) || !champion.image,
      )) throw new Error("El catálogo local tiene un formato no válido.");
      return champions;
    }).catch((error) => {
      catalogPromise = undefined;
      throw error;
    });
  }
  return catalogPromise;
}

export function reloadChampions() {
  catalogPromise = undefined;
  return getChampions();
}

/** Carga el catálogo local poco a poco para que las pantallas no muestren
 * placeholders al abrirse, sin saturar el WebView Android. */
export function warmChampionImageCache(champions: Champion[]) {
  const pending = champions
    .map((champion) => champion.image)
    .filter((url) => !warmedImageUrls.has(url));
  pending.forEach((url) => warmedImageUrls.add(url));
  let cursor = 0;
  const workers = Math.min(4, pending.length);
  const loadNext = () => {
    const url = pending[cursor++];
    if (!url) return;
    const image = new Image();
    image.decoding = "async";
    image.onload = image.onerror = loadNext;
    image.src = url;
  };
  for (let worker = 0; worker < workers; worker += 1) loadNext();
}

export async function generateTeams(
  mode: GenerationMode,
  teamCount: TeamCount,
  excludedChampionIds: number[] = [],
): Promise<GeneratedTeams> {
  const excludedIds = new Set(excludedChampionIds);
  return isTauri()
    ? invoke<GeneratedTeams>("generate_teams", {
        mode,
        teamCount,
        excludedChampionIds,
      })
    : fallbackGenerate(
        (await getChampions()).filter(
          (champion) => !excludedIds.has(champion.id),
        ),
        mode,
        teamCount,
      );
}
