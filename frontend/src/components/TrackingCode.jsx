import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { renderCodeImage } from '../codeImage.js';
import { forgetCode, saveCode } from '../myMessages.js';
import './TrackingCode.css';

// Código de seguimiento del mensaje recién enviado. Se muestra una sola vez: el servidor solo guarda su hash. Para que no se
// pierda se puede copiar, descargar como imagen (con el aviso de no perderlo) o recordar en este dispositivo (solo en su
// navegador).
export default function TrackingCode({ code, subject }) {
  const [copied, setCopied] = useState(false);
  const [remember, setRemember] = useState(true);
  const [image, setImage] = useState({ busy: false, error: '' });

  // Recordar en este dispositivo (se puede desmarcar, p. ej. en una computadora compartida)
  useEffect(() => {
    if (remember) saveCode({ code, subject });
    else forgetCode(code);
  }, [remember, code, subject]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false); // sin permiso para el portapapeles: se puede seleccionar y copiar a mano
    }
  }

  // Imagen con el código, el aviso de no perderlo y el enlace de seguimiento (nunca el asunto ni el mensaje)
  async function download() {
    setImage({ busy: true, error: '' });
    try {
      const url = URL.createObjectURL(await renderCodeImage(code));
      const a = Object.assign(document.createElement('a'), { href: url, download: `codigo-seguimiento-${code}.png` });
      a.click();
      URL.revokeObjectURL(url);
      setImage({ busy: false, error: '' });
    } catch {
      setImage({ busy: false, error: 'No se pudo generar la imagen. Copia el código o tómale una captura de pantalla.' });
    }
  }

  return (
    <div className="tracking-code" role="group" aria-label="Código de seguimiento">
      <p className="tracking-title">Tu código de seguimiento</p>
      <p className="tracking-value" translate="no">{code}</p>
      <div className="tracking-actions">
        <button type="button" className="btn btn-dark sm" onClick={copy}>{copied ? 'Copiado ✔' : 'Copiar código'}</button>
        <button type="button" className="btn btn-dark sm" onClick={download} disabled={image.busy}>{image.busy ? 'Generando…' : 'Descargar imagen'}</button>
      </div>
      {image.error && <p className="tracking-error" role="alert">{image.error}</p>}
      <label className="tracking-remember">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <span>Recordar este código en este dispositivo <small>(solo en este navegador; no lo marques si usas una computadora compartida)</small></span>
      </label>
      <p className="tracking-warning">
        <strong>Guárdalo ahora: no se vuelve a mostrar y no lo podemos recuperar</strong> (así protegemos tu anonimato). Con él puedes
        ver en qué va tu mensaje y leer la respuesta del equipo en <Link to="/seguimiento">Seguimiento</Link>.
      </p>
    </div>
  );
}
