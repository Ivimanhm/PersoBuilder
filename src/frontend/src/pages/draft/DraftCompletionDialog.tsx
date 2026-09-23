import { useEffect, useRef } from "preact/hooks";
import type { Champion } from "../../types";
import { UiIcon } from "../../components/UiIcon/UiIcon";

type SaveOutcome = "idle" | "local" | "synced" | "sync-error";

type DraftCompletionDialogProps = {
  blueSlots: (Champion | null)[];
  redSlots: (Champion | null)[];
  saving: boolean;
  saveError: string;
  saveOutcome: SaveOutcome;
  diagnostic: string;
  savedGameNumber: number | null;
  onClose: () => void;
  onContinueEditing: () => void;
  onSave: () => void;
};

export function DraftCompletionDialog({
  blueSlots,
  redSlots,
  saving,
  saveError,
  saveOutcome,
  diagnostic,
  savedGameNumber,
  onClose,
  onContinueEditing,
  onSave,
}: DraftCompletionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  const roster = (slots: (Champion | null)[]) => slots.map((champion) => champion?.name).filter(Boolean).join(" · ");
  return (
    <dialog ref={dialogRef} className="draft-completion-modal" aria-labelledby="draft-completion-title" onClose={onClose}>
      <section className="draft-completion-dialog">
        <span className="draft-completion-icon"><UiIcon name="shield" /></span>
        <small>Draft Fearless completado</small>
        <h2 id="draft-completion-title">La partida está lista</h2>
        <p>Revisa la selección antes de guardarla en el historial</p>
        {!savedGameNumber && <div className="draft-completion-summary"><div><strong>Equipo Azul</strong><span>{roster(blueSlots)}</span></div><div><strong>Equipo Rojo</strong><span>{roster(redSlots)}</span></div></div>}
        {savedGameNumber
          ? <DraftSaveResult outcome={saveOutcome} diagnostic={diagnostic} onClose={onClose} />
          : <DraftSaveActions saving={saving} error={saveError} onContinueEditing={onContinueEditing} onSave={onSave} />}
      </section>
    </dialog>
  );
}

function DraftSaveResult({ outcome, diagnostic, onClose }: {
  outcome: SaveOutcome;
  diagnostic: string;
  onClose: () => void;
}) {
  const message = outcome === "local"
    ? " La partida se ha guardado correctamente en el dispositivo."
    : outcome === "synced"
      ? " La partida se ha guardado en el dispositivo y se ha sincronizado correctamente con la API."
      : " La partida se ha guardado correctamente en el dispositivo, pero no ha sido posible sincronizarla con la API.";
  return <><p className={`draft-sync-feedback ${outcome === "sync-error" ? "error" : "success"}`} role={outcome === "sync-error" ? "alert" : "status"}><i className="bi bi-save2" />{message}</p>{outcome !== "local" && <section className="draft-api-diagnostic" aria-label="Salida de la API"><small>SALIDA DE LA API</small><pre>{diagnostic}</pre></section>}<footer className="draft-completion-close"><button className="gold-button" type="button" onClick={onClose}>Cerrar</button></footer></>;
}

function DraftSaveActions({ saving, error, onContinueEditing, onSave }: {
  saving: boolean;
  error: string;
  onContinueEditing: () => void;
  onSave: () => void;
}) {
  return <><footer><button className="draft-continue-button" type="button" onClick={onContinueEditing}>Seguir editando</button><button className="gold-button draft-save-button" type="button" disabled={saving} onClick={onSave}><i className="bi bi-save2" />{saving ? "Guardando…" : error ? "Guardar en local" : "Guardar partida"}</button></footer>{error && <p className="draft-sync-feedback error" role="alert">{error}</p>}</>;
}
