import { useEffect, useRef } from 'react';

// Diálogo modal de confirmación basado en <dialog>: atrapa el foco y se cierra con Esc.
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Aceptar', onConfirm, onCancel }) {
  const ref = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current.focus(); // el foco inicial va a la opción segura, no a la destructiva
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="confirm" onCancel={(e) => { e.preventDefault(); onCancel(); }} onClick={(e) => e.target === ref.current && onCancel()}>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="row">
        <button className="btn btn-red" onClick={onConfirm}>{confirmLabel}</button>
        <button ref={cancelRef} className="btn btn-dark" onClick={onCancel}>Cancelar</button>
      </div>
    </dialog>
  );
}
