import { useState } from 'react';
import { Link } from 'react-router-dom';
import './TrackingCode.css';

// Código de seguimiento del mensaje recién enviado. Se muestra una sola vez: el servidor solo guarda su hash.
export default function TrackingCode({ code }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false); // sin permiso para el portapapeles: se puede seleccionar y copiar a mano
    }
  }
  return (
    <div className="tracking-code" role="group" aria-label="Código de seguimiento">
      <p className="tracking-title">Tu código de seguimiento</p>
      <p className="tracking-value" translate="no">{code}</p>
      <button type="button" className="btn btn-dark sm" onClick={copy}>{copied ? 'Copiado ✔' : 'Copiar código'}</button>
      <p className="tracking-warning">
        <strong>Guárdalo ahora: no se vuelve a mostrar y no lo podemos recuperar</strong> (así protegemos tu anonimato). Con él puedes
        ver en qué va tu mensaje y leer la respuesta del equipo en <Link to="/seguimiento">Seguimiento</Link>.
      </p>
    </div>
  );
}
