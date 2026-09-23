import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Champion, Role } from "../../types";
import { RouletteCard } from "../../components/RouletteCard/RouletteCard";
import { roleLabels, roleOrder } from "../../components/TeamTable/TeamTable";
import { RoleIcon } from "../../components/RoleIcon/RoleIcon";
import { UiIcon } from "../../components/UiIcon/UiIcon";

type RouletteItem = { key: string; champion: Champion };

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function RoulettePage({
  champions,
}: {
  champions: Champion[];
}) {
  const [selectedRole, setSelectedRole] = useState<Role>("top");
  const [items, setItems] = useState<RouletteItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [starting, setStarting] = useState(false);
  const [winner, setWinner] = useState<Champion | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const chosenRef = useRef<Champion | null>(null);
  const fallbackRef = useRef<number | null>(null);
  const timerRefs = useRef<number[]>([]);
  const frameRefs = useRef<number[]>([]);
  const nextItemId = useRef(0);
  const rollingRef = useRef(false);
  const pool = useMemo(
    () => champions.filter((champion) => champion.roles.includes(selectedRole)),
    [champions, selectedRole],
  );
  const setRollingState = (value: boolean) => {
    rollingRef.current = value;
    setRolling(value);
  };
  const createItems = useCallback((champions: Champion[]) => champions.map((champion) => ({
    key: `roulette-${nextItemId.current++}`,
    champion,
  })), []);
  const scheduleFrame = useCallback((callback: FrameRequestCallback) => {
    const frame = requestAnimationFrame(callback);
    frameRefs.current.push(frame);
    return frame;
  }, []);
  const scheduleTimeout = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timerRefs.current.push(timer);
    return timer;
  }, []);
  const center = useCallback((index: number, animate: boolean) =>
    scheduleFrame(() =>
      scheduleFrame(() => {
        const item = trackRef.current?.children[index] as
          | HTMLElement
          | undefined;
        if (!item || !viewportRef.current) return;
        setRollingState(animate);
        setOffset(
          -(
            item.offsetLeft +
            item.offsetWidth / 2 -
            viewportRef.current.clientWidth / 2
          ),
        );
      }),
    ), [scheduleFrame]);
  useEffect(() => {
    if (!pool.length || rollingRef.current) return;
    const initial = createItems(shuffle(pool).slice(0, Math.min(9, pool.length)));
    const index = Math.floor(initial.length / 2);
    setItems(initial);
    setOffset(0);
    setWinner(null);
    setSelectedIndex(index);
    center(index, false);
  }, [pool, center, createItems]);
  useEffect(
    () => () => {
      if (fallbackRef.current !== null)
        window.clearTimeout(fallbackRef.current);
      timerRefs.current.forEach((timer) => window.clearTimeout(timer));
      frameRefs.current.forEach((frame) => window.cancelAnimationFrame(frame));
    },
    [],
  );
  const complete = () => {
    if (fallbackRef.current !== null) window.clearTimeout(fallbackRef.current);
    fallbackRef.current = null;
    setStarting(false);
    setRollingState(false);
    setWinner(chosenRef.current);
  };
  const spin = () => {
    if (rolling || !pool.length) return;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const next = [
      ...items,
      ...createItems(shuffle(pool)),
      ...createItems(shuffle(pool)),
      ...createItems(shuffle(pool)),
    ];
    const index = Math.max(0, next.length - 5);
    next[index] = createItems([chosen])[0];
    chosenRef.current = chosen;
    setWinner(null);
    setSelectedIndex(index);
    setRollingState(true);
    setStarting(true);
    setItems(next);
    scheduleTimeout(
      () =>
        scheduleFrame(() => {
          const item = trackRef.current?.children[index] as
            | HTMLElement
            | undefined;
          if (!item || !viewportRef.current) return complete();
          setStarting(false);
          setOffset(
            -(
              item.offsetLeft +
              item.offsetWidth / 2 -
              viewportRef.current.clientWidth / 2
            ),
          );
          fallbackRef.current = scheduleTimeout(complete, 4_800);
        }),
      100,
    );
  };
  return (
    <section className="app-page roulette-page">
      <section className="step-card role-step">
        <h2>
          <span>1.</span> Elige una posición
        </h2>
        <div className="role-options">
          {roleOrder.map((role) => (
            <button
              key={role}
              type="button"
              className={selectedRole === role ? "selected" : ""}
              disabled={rolling}
              onClick={() => setSelectedRole(role)}
            >
              <RoleIcon role={role} />
              <span>{roleLabels[role]}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="step-card wheel-step">
        <header>
          <h2>
            <span>2.</span> Gira la ruleta
          </h2>
          <small>{pool.length} campeones disponibles</small>
        </header>
        <div className="roulette-viewport" ref={viewportRef}>
          <i className="marker top" />
          <i className="marker bottom" />
          <div
            className={`roulette-track${rolling ? " rolling" : ""}${starting ? " starting" : ""}`}
            ref={trackRef}
            style={{ transform: `translate3d(${offset}px,0,0)` }}
            onTransitionEnd={(event) => {
              if (event.propertyName === "transform" && !starting) complete();
            }}
          >
            {items.map((item, index) => (
              <RouletteCard
                key={item.key}
                champion={item.champion}
                selected={winner?.id === item.champion.id && index === selectedIndex}
              />
            ))}
          </div>
        </div>
      </section>
      <button
        className="gold-button spin-button"
        type="button"
        disabled={rolling || !pool.length}
        onClick={spin}
      >
        <UiIcon name="sparkles" />
        {rolling ? "Girando…" : winner ? "Girar otra vez" : "Girar ruleta"}
      </button>
      <section className={`roulette-result${winner ? " has-winner" : ""}`}>
        {winner ? (
          <>
            <div className="roulette-winner-portrait">
              <img src={winner.image} alt={`Retrato de ${winner.name}`} />
            </div>
            <div className="roulette-winner-copy">
              <small>CAMPEÓN ELEGIDO</small>
              <h2>{winner.name}</h2>
              <p>{roleLabels[selectedRole]} · Selección aleatoria</p>
            </div>
          </>
        ) : (
          <div className="roulette-empty-result">
            <div className="roulette-empty-copy">
              <p>El campeón elegido aparecerá aquí.</p>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
