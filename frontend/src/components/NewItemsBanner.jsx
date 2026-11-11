import './NewItemsBanner.css';

// Aviso discreto de lo que llegó mientras se leía la página: no se inserta nada solo (para que el contenido no salte), la persona
// decide cuándo verlo. No usa `aria-live`: no interrumpe a quien usa lector de pantalla; el botón está en el orden normal de lectura.
export default function NewItemsBanner({ count, singular, plural, onShow }) {
  if (!count) return null;
  return (
    <div className="new-items">
      <span>Hay {count} {count === 1 ? singular : plural}</span>
      <button type="button" className="btn btn-red sm" onClick={onShow}>Ver</button>
    </div>
  );
}
