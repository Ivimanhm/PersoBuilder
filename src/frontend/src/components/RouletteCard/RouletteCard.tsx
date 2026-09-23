import type { Champion } from "../../types";
import "./RouletteCard.css";

export function RouletteCard({ champion, selected = false }: { champion: Champion; selected?: boolean }) {
  return <article className={`roulette-card${selected ? " selected" : ""}`}><div><span>{champion.name[0]}</span><img src={champion.image} alt="" loading="eager" decoding="async" /></div><strong>{champion.name}</strong></article>;
}
