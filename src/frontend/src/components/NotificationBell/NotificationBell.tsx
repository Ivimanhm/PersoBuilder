import { useEffect, useRef, useState } from "preact/hooks";
import {
  checkAndroidUpdates, downloadAndroidUpdate, markUpdateRead,
  supportsAndroidUpdates, wasUpdateRead, type UpdateCheck,
} from "../../services/appUpdates";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<UpdateCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [readTag, setReadTag] = useState<string | null>(null);
  const supported = supportsAndroidUpdates();
  const update = result?.update;
  const unread = !!update && readTag !== update.tag && !wasUpdateRead(update.tag);
  const mounted = useRef(true);
  const checkingRef = useRef(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);
  const bellPointerType = useRef<string | null>(null);
  const swipeStart = useRef<{
    x: number;
    y: number;
    pointerId: number;
    direction: "horizontal" | "vertical" | null;
  } | null>(null);

  const loadUpdates = async (force = false) => {
    if (!supported || checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setError("");
    try {
      const next = await checkAndroidUpdates(force);
      if (mounted.current) setResult(next);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error &&
        failure.name !== "AbortError" && failure.name !== "TypeError"
        ? failure.message : "No se pudieron consultar las actualizaciones. Comprueba tu conexión y reintenta.");
    } finally {
      checkingRef.current = false;
      if (mounted.current) setChecking(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    void loadUpdates();
    const refresh = () => {
      if (document.visibilityState === "visible") void loadUpdates();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    if (open && update) {
      markUpdateRead(update.tag);
      setReadTag(update.tag);
    }
  }, [open, update?.tag]);

  const closePanel = (blurButton = true) => {
    if (blurButton && document.activeElement === button.current) button.current?.blur();
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    swipeStart.current = null;
    setOpen(false);
    setOffset(0);
    setDragging(false);
    setClosing(false);
  };

  const cancelDrag = () => {
    if (!swipeStart.current) return;
    swipeStart.current = null;
    setDragging(false);
    setOffset(0);
  };

  const togglePanel = () => {
    const shouldOpen = !open || closing;
    closePanel(!shouldOpen);
    if (shouldOpen) {
      setOpen(true);
      void loadUpdates();
    }
  };

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) closePanel();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="header-notifications" ref={container}>
      <button
        ref={button}
        className="notification-bell"
        type="button"
        aria-label={unread ? "Notificaciones: 1 sin leer" : "Notificaciones"}
        aria-expanded={open}
        aria-controls="header-notification-panel"
        onPointerDown={(event) => {
          bellPointerType.current = event.pointerType;
        }}
        onPointerUp={(event) => {
          if (event.pointerType !== "touch" || !event.isPrimary) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX >= bounds.left && event.clientX <= bounds.right &&
              event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
            togglePanel();
          }
        }}
        onClick={(event) => {
          // Touch browsers can omit the compatibility click after a swipe.
          // Handle touch on pointerup, while keeping mouse and keyboard clicks.
          if (event.detail !== 0 && bellPointerType.current === "touch") return;
          togglePanel();
        }}
      >
        <i className="ui-icon bi bi-bell" aria-hidden="true" />
        {unread && <span className="notification-unread-dot" aria-hidden="true" />}
      </button>
      <section
        id="header-notification-panel"
        className="notification-panel"
        data-dragging={dragging}
        data-closing={closing}
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          opacity: closing ? 0 : Math.max(0.25, 1 - Math.abs(offset) / 400),
        }}
        aria-label="Notificaciones"
        hidden={!open && !closing}
        onPointerDown={(event) => {
          if (closing || !event.isPrimary || event.button !== 0) return;
          if ((event.target as Element).closest("button, a")) return;
          swipeStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, direction: null };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = swipeStart.current;
          if (!start || start.pointerId !== event.pointerId) return;
          const horizontal = event.clientX - start.x;
          const vertical = Math.abs(event.clientY - start.y);
          if (!start.direction && Math.max(Math.abs(horizontal), vertical) >= 6) {
            start.direction = Math.abs(horizontal) > vertical * 1.25 ? "horizontal" : "vertical";
          }
          if (start.direction === "horizontal") {
            setDragging(true);
            setOffset(horizontal);
          }
        }}
        onPointerUp={(event) => {
          const start = swipeStart.current;
          if (!start || start.pointerId !== event.pointerId) return;
          swipeStart.current = null;
          setDragging(false);
          const distance = event.clientX - start.x;
          const threshold = Math.min(80, event.currentTarget.offsetWidth * 0.25);
          if (start.direction === "horizontal" && Math.abs(distance) >= threshold) {
            setOpen(false);
            button.current?.blur();
            setClosing(true);
            setOffset(Math.sign(distance) * (window.innerWidth + event.currentTarget.offsetWidth));
            closeTimer.current = window.setTimeout(closePanel, 220);
          } else {
            setOffset(0);
          }
        }}
        onPointerCancel={cancelDrag}
        onLostPointerCapture={cancelDrag}
        onTransitionEnd={(event) => {
          if (closing && event.target === event.currentTarget && event.propertyName === "transform") closePanel();
        }}
      >
        <div className="notification-panel-heading">
          <h2>Notificaciones</h2>
          <button className="notification-close" type="button" aria-label="Cerrar notificaciones"
            onClick={() => closePanel()}>
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
        <div aria-live="polite">
        {!supported && <p>Las actualizaciones de este panel son para Android.</p>}
        {checking && !update && <p>Buscando actualizaciones…</p>}
        {error && <p role="alert">{error}</p>}
        {!checking && !error && result && !update && <p>No hay actualizaciones disponibles.</p>}
        {update && <ul className="notification-list">
          <li className="notification-item">
            <span className="notification-item-icon" aria-hidden="true"><i className="bi bi-download" /></span>
            <div>
              <h3>Actualización disponible · {update.version}</h3>
              <button className="notification-action" type="button" disabled={downloading}
                onClick={async () => {
                  if (downloading) return;
                  setDownloading(true);
                  setDownloadError("");
                  try { await downloadAndroidUpdate(update); }
                  catch { if (mounted.current) setDownloadError("No se pudo abrir la descarga. Inténtalo de nuevo."); }
                  finally { if (mounted.current) setDownloading(false); }
                }}>
                {downloading ? "Abriendo…" : "Descargar APK"}
              </button>
              {downloadError && <p role="alert">{downloadError}</p>}
            </div>
          </li>
        </ul>}
        </div>
        {supported && (!update || error) && <button className="notification-action notification-check" type="button"
          disabled={checking} onClick={() => void loadUpdates(true)}>
          {error ? "Reintentar" : "Comprobar actualizaciones"}
        </button>}
      </section>
    </div>
  );
}
