import { useEffect, useState } from "preact/hooks";
import { getChampions, reloadChampions, warmChampionImageCache } from "../services/draftlab";
import type { Champion } from "../types";

export function useChampionCatalog() {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    getChampions().then(setChampions).catch((reason) => setError(String(reason)));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!champions.length) return;
    const timeout = window.setTimeout(() => warmChampionImageCache(champions), 400);
    return () => window.clearTimeout(timeout);
  }, [champions]);
  return {
    champions,
    error,
    reload: () => {
      setError("");
      reloadChampions().then(setChampions).catch((reason) => setError(String(reason)));
    },
  };
}
