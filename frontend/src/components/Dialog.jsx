import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const DialogContext = createContext(null);

// Reemplaza confirm()/alert() del navegador por un diálogo modal con el diseño del sitio.
//   const { confirm, notify } = useDialog();
//   if (await confirm({ title, message, confirmLabel })) { ... }
//   await notify({ title, message });
export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);
  const ref = useRef(null);
  const focusRef = useRef(null);

  const ask = useCallback((options) => new Promise((resolve) => {
    resolver.current?.(false); // si ya había uno abierto, se descarta
    resolver.current = resolve;
    setDialog(options);
  }), []);
  const confirm = useCallback((options) => ask({ kind: 'confirm', ...options }), [ask]);
  const notify = useCallback((options) => ask({ kind: 'notify', ...options }), [ask]);

  function close(result) {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  }

  useEffect(() => {
    const el = ref.current;
    if (dialog && !el.open) {
      el.showModal();
      focusRef.current?.focus(); // el foco inicial va a la opción segura, no a la destructiva
    }
    if (!dialog && el.open) el.close();
  }, [dialog]);

  const isConfirm = dialog?.kind === 'confirm';
  return (
    <DialogContext.Provider value={{ confirm, notify }}>
      {children}
      <dialog ref={ref} className="confirm" onCancel={(e) => { e.preventDefault(); close(false); }} onClick={(e) => e.target === ref.current && close(false)}>
        {dialog && (
          <>
            <h2>{dialog.title}</h2>
            {dialog.message && <p>{dialog.message}</p>}
            <div className="row">
              {isConfirm ? (
                <>
                  <button className="btn btn-red" onClick={() => close(true)}>{dialog.confirmLabel || 'Aceptar'}</button>
                  <button ref={focusRef} className="btn btn-dark" onClick={() => close(false)}>Cancelar</button>
                </>
              ) : (
                <button ref={focusRef} className="btn btn-red" onClick={() => close(true)}>{dialog.confirmLabel || 'Entendido'}</button>
              )}
            </div>
          </>
        )}
      </dialog>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  return useContext(DialogContext);
}
