import type { ComponentChildren, JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
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
  draggableCells?: boolean;
  canDragCell?: (selection: MatchupSelection) => boolean;
  /** Clear the owning selection as soon as a draggable cell is pressed. */
  onCellDragStart?: () => void;
  /** Swap two entries within one team in the owning state. */
  onCellsSwap?: (side: MatchupSide, from: number, to: number) => void;
  renderBlue: (role: Role, index: number) => ComponentChildren;
  renderRed: (role: Role, index: number) => ComponentChildren;
};

/** Team table supports optional clickable cells and controlled same-team swaps. */
export function TeamTable({ teamCount = 2, className = "", selectedCell = null, onSelectCell, draggableCells = false, canDragCell, onCellDragStart, onCellsSwap, renderBlue, renderRed }: TeamTableProps) {
  const single = teamCount === 1;
  const reorderable = draggableCells && Boolean(onCellsSwap);
  const [draggedCell, setDraggedCell] = useState<MatchupSelection | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [holdingCell, setHoldingCell] = useState(false);
  const gesture = useRef<{
    pointerId: number;
    side: MatchupSide;
    slot: number;
    destination: number | null;
    startX: number;
    startY: number;
    active: boolean;
    timer?: ReturnType<typeof setTimeout>;
  } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => () => {
    clearTimeout(gesture.current?.timer);
  }, []);

  const startDrag = (event: JSX.TargetedPointerEvent<HTMLElement>, selection: MatchupSelection) => {
    if (!reorderable || !event.isPrimary || event.button !== 0 || gesture.current) return;
    suppressClick.current = false;
    onCellDragStart?.();
    setHoldingCell(true);
    // Prevent mouse focus from adding a second highlight during the hold.
    if (event.pointerType === "mouse") event.preventDefault();
    const focused = event.currentTarget.ownerDocument.activeElement;
    if (focused instanceof HTMLElement) focused.blur();
    const next = { pointerId: event.pointerId, ...selection, destination: null as number | null, startX: event.clientX, startY: event.clientY, active: false, timer: undefined as ReturnType<typeof setTimeout> | undefined };
    gesture.current = next;
    // Keep receiving pointer events when dragging outside the source cell.
    event.currentTarget.closest(".team-board")?.setPointerCapture(event.pointerId);
    if (event.pointerType !== "mouse") {
      next.timer = setTimeout(() => {
        next.active = true;
        suppressClick.current = true;
        setDraggedCell(selection);
      }, 250);
    }
  };

  const moveDrag = (event: JSX.TargetedPointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId || !reorderable) return;
    const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
    if (!current.active) {
      if (event.pointerType !== "mouse") {
        // A tap or a movement before the hold completes does not swap cells.
        if (distance > 8) clearTimeout(current.timer);
        return;
      }
      if (distance < 6) return;
      current.active = true;
      suppressClick.current = true;
    }
    event.preventDefault();
    const cells = event.currentTarget.querySelectorAll<HTMLElement>(`.matchup-cell.${current.side}`);
    current.destination = null;
    cells.forEach((cell) => {
      const rect = cell.getBoundingClientRect();
      if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
        const slot = Number(cell.dataset.slot);
        if (slot !== current.slot) current.destination = slot;
      }
    });
    setDraggedCell({ side: current.side, slot: current.slot });
    setDropTarget(current.destination);
  };

  const endDrag = (event: JSX.TargetedPointerEvent<HTMLElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    const current = gesture.current;
    clearTimeout(current.timer);
    if (event.type === "pointerup" && current.active && reorderable) {
      // Resolve the release position too, so stale hover feedback cannot cause a swap.
      moveDrag(event);
      if (current.destination !== null) onCellsSwap?.(current.side, current.slot, current.destination);
    }
    gesture.current = null;
    setDraggedCell(null);
    setDropTarget(null);
    setHoldingCell(false);
    if (current.active) {
      const focused = event.currentTarget.ownerDocument.activeElement;
      if (focused instanceof HTMLElement && event.currentTarget.contains(focused)) focused.blur();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const renderCell = (side: MatchupSide, role: Role, slot: number) => {
    const selection = { side, slot };
    const draggable = reorderable && (canDragCell?.(selection) ?? true);
    const dragging = draggedCell?.side === side && draggedCell.slot === slot;
    const receiving = draggedCell?.side === side && dropTarget === slot;
    return <Cell side={side} slot={slot} selected={holdingCell ? null : selectedCell} onSelect={onSelectCell}
      draggable={draggable} dragging={dragging} receiving={receiving}
      onPointerDown={draggable ? (event) => startDrag(event, selection) : undefined}
      onKeyDown={draggable ? (event) => {
        if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
        event.preventDefault();
        const destination = slot + (event.key === "ArrowUp" ? -1 : 1);
        if (destination < 0 || destination >= roleOrder.length) return;
        onCellDragStart?.();
        onCellsSwap?.(side, slot, destination);
        const cells = event.currentTarget.closest(".team-board")?.querySelectorAll(`.matchup-cell.${side}`);
        (cells?.[destination] as HTMLButtonElement | undefined)?.focus();
      } : undefined}
    >{side === "blue" ? renderBlue(role, slot) : renderRed(role, slot)}</Cell>;
  };

  return <section className={`matchup team-board${className ? ` ${className}` : ""}${single ? " single-team" : ""}${holdingCell ? " is-reordering" : ""}`}
    onPointerDownCapture={reorderable ? () => { suppressClick.current = false; } : undefined}
    onPointerMove={reorderable ? moveDrag : undefined}
    onPointerUp={reorderable ? endDrag : undefined}
    onPointerCancel={reorderable ? endDrag : undefined}
    onLostPointerCapture={reorderable ? endDrag : undefined}
    onFocusCapture={reorderable ? (event) => {
      if (gesture.current?.active && (event.target as HTMLElement).closest(".matchup-cell")) {
        (event.target as HTMLElement).blur();
      }
    } : undefined}
    onClickCapture={reorderable ? (event) => {
      if (suppressClick.current && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
        const focused = event.currentTarget.ownerDocument.activeElement;
        if (focused instanceof HTMLElement && event.currentTarget.contains(focused)) focused.blur();
      }
    } : undefined}
    onDragStart={reorderable ? (event) => event.preventDefault() : undefined}
    onContextMenu={reorderable ? (event) => {
      if ((event.target as HTMLElement).closest(".draggable-cell")) event.preventDefault();
    } : undefined}
  >
    <div className="matchup-head"><TeamHeading team="blue" />{!single && <TeamHeading team="red" />}</div>
    {roleOrder.map((role, index) => <article className="matchup-row" key={role}>
      {renderCell("blue", role, index)}
      <div className="row-role"><RoleIcon role={role} /><small>{roleLabels[role]}</small></div>
      {!single && renderCell("red", role, index)}
    </article>)}
  </section>;
}

function Cell({ side, slot, selected, onSelect, children, draggable, dragging, receiving, onPointerDown, onKeyDown }: { side: MatchupSide; slot: number; selected: MatchupSelection | null; onSelect?: (selection: MatchupSelection) => void; children: ComponentChildren; draggable: boolean; dragging: boolean; receiving: boolean; onPointerDown?: JSX.PointerEventHandler<HTMLButtonElement>; onKeyDown?: JSX.KeyboardEventHandler<HTMLButtonElement> }) {
  const active = selected?.side === side && selected.slot === slot;
  return <button type="button" data-slot={slot} className={`member ${side} matchup-cell${active ? " is-selected" : ""}${draggable ? " draggable-cell" : ""}${dragging ? " is-dragging" : ""}${receiving ? " is-drop-target" : ""}`} disabled={!onSelect && !draggable} aria-pressed={onSelect ? active : undefined}
    title={draggable ? "Mantén pulsado y arrastra a otra celda de este equipo. Teclado: Alt + flecha arriba o abajo." : undefined}
    onPointerDown={onPointerDown} onKeyDown={onKeyDown}
    onClick={onSelect ? () => onSelect({ side, slot }) : undefined}>{children}</button>;
}

export function TeamBoard({ teams, teamCount }: { teams: GeneratedTeams | null; teamCount: TeamCount }) {
  return <TeamTable teamCount={teamCount} className={!teams ? "empty-team-board" : ""}
    renderBlue={(_, index) => teams ? <><ChampionPortrait member={teams.blue[index]} team="blue" /><strong>{teams.blue[index].champion.name}</strong></> : <EmptyMember team="blue" />}
    renderRed={(_, index) => teams ? <><strong>{teams.red[index].champion.name}</strong><ChampionPortrait member={teams.red[index]} team="red" /></> : <EmptyMember team="red" />}
  />;
}
