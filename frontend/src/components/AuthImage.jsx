import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Imagen privada (adjuntos del buzón): solo la ve un administrador con sesión, así que no puede ir en un <img src>
// normal (el navegador no manda la cabecera Authorization). Se descarga con fetch y se muestra desde un Blob.
// Muestra la versión reducida; al hacer clic abre la original en otra pestaña.
export default function AuthImage({ id, alt }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

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

  async function openOriginal(e) {
    e.preventDefault();
    const tab = window.open('about:blank', '_blank'); // se abre ya, dentro del clic, para que no lo bloquee el navegador
    try {
      const url = URL.createObjectURL(await api(`/files/${id}`, { blob: true }));
      if (tab) tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
    }
  }

  if (failed) return <span className="muted">No se pudo cargar la imagen.</span>;
  if (!src) return <span className="muted">Cargando imagen…</span>;
  return (
    <a href={src} onClick={openOriginal} title="Abrir imagen">
      <img src={src} alt={alt} />
    </a>
  );
}
