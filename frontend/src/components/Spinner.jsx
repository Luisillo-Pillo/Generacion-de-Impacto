// Círculo de carga. Por defecto ocupa el bloque de la sección que espera datos (con texto para lectores de pantalla);
// con `inline` es un círculo pequeño para botones y avisos.
export default function Spinner({ inline = false, label = 'Cargando…' }) {
  if (inline) return <span className="spinner inline" aria-hidden="true" />;
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
