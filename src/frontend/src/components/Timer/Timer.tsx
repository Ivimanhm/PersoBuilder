import { useEffect, useRef, useState } from "preact/hooks";

type TimerProps = {
  deadline: number | null;
  durationSeconds: number;
  paused?: boolean;
  className?: string;
  onExpire?: () => void;
};

function secondsUntil(deadline: number | null, durationSeconds: number) {
  return deadline === null
    ? durationSeconds
    : Math.max(0, Math.ceil((deadline - Date.now()) / 1_000));
}

/** Cuenta atrás aislada: solo este componente se actualiza en cada segundo. */
export function Timer({
  deadline,
  durationSeconds,
  paused = false,
  className = "",
  onExpire,
}: TimerProps) {
  const [seconds, setSeconds] = useState(() =>
    secondsUntil(deadline, durationSeconds)
  );
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (paused || deadline === null) {
      setSeconds(durationSeconds);
      return;
    }

    let timeout = 0;
    let expirationNotified = false;

    const update = () => {
      window.clearTimeout(timeout);
      const remaining = secondsUntil(deadline, durationSeconds);
      setSeconds((current) => current === remaining ? current : remaining);

      if (remaining === 0) {
        if (!expirationNotified) {
          expirationNotified = true;
          onExpireRef.current?.();
        }
        return;
      }
      if (document.visibilityState !== "visible") return;

      const millisecondsRemaining = Math.max(0, deadline - Date.now());
      const nextSecondBoundary = Math.max(
        50,
        millisecondsRemaining - (remaining - 1) * 1_000 + 5,
      );
      timeout = window.setTimeout(update, nextSecondBoundary);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") update();
      else window.clearTimeout(timeout);
    };

    update();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [deadline, durationSeconds, paused]);

  const expired = !paused && deadline !== null && seconds === 0;
  const progressDegrees = durationSeconds > 0
    ? Math.min(360, (seconds / durationSeconds) * 360)
    : 0;

  return (
    <div
      className={`timer${paused ? " paused" : ""}${expired ? " expired" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--timer-progress": `${progressDegrees}deg` } as any}
    >
      <strong>{seconds}</strong>
      <small>s</small>
    </div>
  );
}
import "./Timer.css";
