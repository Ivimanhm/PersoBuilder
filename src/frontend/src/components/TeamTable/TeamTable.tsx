import type { ComponentChildren } from "preact";
import type { GeneratedTeams, Role, TeamCount, TeamMember } from "../../types";
import { RoleIcon } from "../RoleIcon/RoleIcon";

export const roleOrder: Role[] = ["top", "jungle", "mid", "adc", "support"];
export const roleLabels: Record<Role, string> = {
  top: "TOP",
  jungle: "JG",
  mid: "MID",
  adc: "ADC",
  support: "SUP",
};
export type MatchupSide = "blue" | "red";
export type MatchupSelection = { side: MatchupSide; slot: number };

export function TeamHeading({ team }: { team: MatchupSide }) {
  return <div className={`team-heading ${team}`}><span className="team-gem" /><strong>Equipo {team === "blue" ? "Azul" : "Rojo"}</strong></div>;
}

export function ChampionPortrait({ member, team }: { member: TeamMember; team: MatchupSide }) {
  return <div className={`portrait ${team}`}><span>{member.champion.name[0]}</span><img src={member.champion.image} alt="" loading="eager" decoding="async" onError={(event) => { event.currentTarget.hidden = true; }} /></div>;
}

function EmptyMember({ team }: { team: MatchupSide }) {
  const portrait = <div className={`portrait ${team} placeholder`}><i className="helmet-shape" aria-hidden="true" /></div>;
  return <>{team === "red" && <strong>Pendiente</strong>}{portrait}{team === "blue" && <strong>Pendiente</strong>}</>;
}

type TeamTableProps = {
  teamCount?: TeamCount;
  className?: string;
  selectedCell?: MatchupSelection | null;
  onSelectCell?: (selection: MatchupSelection) => void;
  renderBlue: (role: Role, index: number) => ComponentChildren;
  renderRed: (role: Role, index: number) => ComponentChildren;
};

/** Team table supports a single-team view and optional clickable cells. */
export function TeamTable({ teamCount = 2, className = "", selectedCell = null, onSelectCell, renderBlue, renderRed }: TeamTableProps) {
  const single = teamCount === 1;
  return <section className={`matchup team-board${className ? ` ${className}` : ""}${single ? " single-team" : ""}`}>
    <div className="matchup-head"><TeamHeading team="blue" />{!single && <TeamHeading team="red" />}</div>
    {roleOrder.map((role, index) => <article className="matchup-row" key={role}>
      <Cell side="blue" slot={index} selected={selectedCell} onSelect={onSelectCell}>{renderBlue(role, index)}</Cell>
      <div className="row-role"><RoleIcon role={role} /><small>{roleLabels[role]}</small></div>
      {!single && <Cell side="red" slot={index} selected={selectedCell} onSelect={onSelectCell}>{renderRed(role, index)}</Cell>}
    </article>)}
  </section>;
}

function Cell({ side, slot, selected, onSelect, children }: { side: MatchupSide; slot: number; selected: MatchupSelection | null; onSelect?: (selection: MatchupSelection) => void; children: ComponentChildren }) {
  const active = selected?.side === side && selected.slot === slot;
  return <button type="button" className={`member ${side} matchup-cell${active ? " is-selected" : ""}`} disabled={!onSelect} aria-pressed={onSelect ? active : undefined} onClick={onSelect ? () => onSelect({ side, slot }) : undefined}>{children}</button>;
}

export function TeamBoard({ teams, teamCount }: { teams: GeneratedTeams | null; teamCount: TeamCount }) {
  return <TeamTable teamCount={teamCount} className={!teams ? "empty-team-board" : ""}
    renderBlue={(_, index) => teams ? <><ChampionPortrait member={teams.blue[index]} team="blue" /><strong>{teams.blue[index].champion.name}</strong></> : <EmptyMember team="blue" />}
    renderRed={(_, index) => teams ? <><strong>{teams.red[index].champion.name}</strong><ChampionPortrait member={teams.red[index]} team="red" /></> : <EmptyMember team="red" />}
  />;
}
