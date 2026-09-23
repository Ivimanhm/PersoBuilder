import type { Champion } from "../../types";

export function HistoryRoster({ side, champions }: { side: "blue" | "red"; champions: Champion[] }) {
  return <section className={`history-roster ${side}`}><strong><span className="team-gem" />Equipo {side === "blue" ? "Azul" : "Rojo"}</strong><div>{champions.map((champion) => <img key={champion.id} src={champion.image} alt={champion.name} loading="lazy" decoding="async" />)}</div></section>;
}
