import './EmptyState.css';

// Aviso de «no hay nada que mostrar»: ícono, título, explicación y, si ayuda, un botón para salir del callejón.
export default function EmptyState({ icon, title, children, action }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
