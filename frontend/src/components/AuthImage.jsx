import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useDialog } from './Dialog.jsx';
import Spinner from './Spinner.jsx';
import './AuthImage.css';

// Imagen privada (adjuntos del buzón): solo la ve un integrante con sesión, así que no puede ir en un <img src> normal (el
// navegador no manda la cabecera Authorization). Se descarga con fetch y se muestra desde un Blob.
// La miniatura es la versión reducida; al hacer clic se abre en un visor DENTRO de la misma página (nada de pestañas nuevas): se ve
// al instante la miniatura ampliada y, en cuanto llega, la versión grande (1280 px, mucho más ligera que la original de hasta 5 MB).
// Desde el visor se puede descargar la original.
export default function AuthImage({ id, alt }) {
  const { notify } = useDialog();
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [big, setBig] = useState(null); // versión grande, cuando llega
  const [downloading, setDownloading] = useState(false);
  const dialog = useRef(null);

  useEffect(() => {
    let url = null;
    let cancelled = false;
    api(`/files/${id}?w=640`, { blob: true })
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  // Con el visor abierto se pide la versión grande; al cerrarlo se libera
  useEffect(() => {
    if (!open) return undefined;
    let url = null;
    let cancelled = false;
    api(`/files/${id}?w=1280`, { blob: true })
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setBig(url);
      })
      .catch(() => {}); // si falla, se queda la miniatura ampliada
    return () => {
      cancelled = true;
      setBig(null);
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, id]);

  // <dialog> modal nativo: foco atrapado, Esc lo cierra y el resto de la página queda inerte
  useEffect(() => {
    const el = dialog.current;
    if (open && el && !el.open) el.showModal();
  }, [open]);

  async function downloadOriginal() {
    setDownloading(true);
    try {
      const blob = await api(`/files/${id}`, { blob: true });
      const url = URL.createObjectURL(blob);
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      Object.assign(document.createElement('a'), { href: url, download: `imagen-adjunta.${ext}` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      await notify({ title: 'No se pudo descargar la imagen', message: err.message });
    } finally {
      setDownloading(false);
    }
  }

  if (failed) return <span className="muted">No se pudo cargar la imagen.</span>;
  if (!src) return <span className="muted">Cargando imagen…</span>;
  return (
    <>
      <button type="button" className="auth-image-thumb" title="Ver imagen" onClick={() => setOpen(true)}>
        <img src={src} alt={alt} />
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="image-viewer"
          aria-label="Imagen adjunta ampliada"
          onClose={() => setOpen(false)}
          onClick={(e) => e.target === dialog.current && dialog.current.close()} // clic fuera de la imagen: cerrar
        >
          <div className="viewer-stage">
            <img src={big ?? src} alt={alt} className={big ? '' : 'viewer-loading'} />
            {!big && <span className="viewer-wait"><Spinner inline /> Cargando…</span>}
          </div>
          <div className="viewer-actions">
            <button type="button" className="btn btn-light sm" disabled={downloading} onClick={downloadOriginal}>{downloading ? 'Descargando…' : 'Descargar original'}</button>
            <button type="button" className="btn btn-red sm" autoFocus onClick={() => dialog.current.close()}>Cerrar</button>
          </div>
        </dialog>
      )}
    </>
  );
}
