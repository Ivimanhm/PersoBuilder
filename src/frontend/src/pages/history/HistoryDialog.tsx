import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

export function HistoryDialog({
  id,
  title,
  icon,
  onClose,
  children,
}: {
  id: string;
  title: string;
  icon: string;
  onClose: () => void;
  children: ComponentChildren;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog ref={dialogRef} tabIndex={-1} className="history-dialog-backdrop"
      aria-labelledby={id} onClose={onClose}>
      <section className="history-dialog">
        <i className={icon} aria-hidden="true" />
        <h2 id={id}>{title}</h2>
        {children}
      </section>
    </dialog>
  );
}
