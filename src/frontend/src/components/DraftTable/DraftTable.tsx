import type { Champion } from "../../types";
import { TeamTable, type MatchupSelection, type MatchupSide } from "../TeamTable/TeamTable";
import "./DraftTable.css";

export type DraftSide = MatchupSide;
export type DraftTarget = MatchupSelection;

function DraftPortrait({ champion, side }: { champion: Champion | null; side: DraftSide }) {
  return <div className={`portrait ${side}${champion ? "" : " placeholder"}`}>{champion ? <img src={champion.image} alt="" loading="eager" decoding="async" /> : <i className="helmet-shape" aria-hidden="true" />}</div>;
}

export function DraftTable({ blueSlots, redSlots, target, onSelectSlot }: { blueSlots: (Champion | null)[]; redSlots: (Champion | null)[]; target: DraftTarget | null; onSelectSlot: (target: DraftTarget) => void }) {
  return <TeamTable selectedCell={target} onSelectCell={onSelectSlot}
    renderBlue={(_, index) => <><DraftPortrait champion={blueSlots[index]} side="blue" /><strong>{blueSlots[index]?.name ?? "Pendiente"}</strong></>}
    renderRed={(_, index) => <><strong>{redSlots[index]?.name ?? "Pendiente"}</strong><DraftPortrait champion={redSlots[index]} side="red" /></>}
  />;
}
