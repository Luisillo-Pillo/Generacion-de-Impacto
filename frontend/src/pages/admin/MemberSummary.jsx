import { formatDate, formatTime } from '../../api.js';
import { IconBadge, IconCap, IconClock, IconMail } from '../../components/ActionIcons.jsx';
import { ROLE_LABEL } from '../../roles.js';
import { semesterGroupLine } from '../../utils.js';
import './MemberSummary.css';

// Estado de conexión para el punto y el texto: conectado ahora (verde que late), o cuánto hace que se conectó: hoy (verde fijo),
// esta semana (ámbar) o hace más (gris)
const HOUR = 3600 * 1000;
function seenState(iso, online) {
  if (online) return { cls: 'online', hint: '' };
  if (!iso) return { cls: 'none', hint: '' };
  const hours = (Date.now() - new Date(iso).getTime()) / HOUR;
  if (hours < 24) return { cls: 'today', hint: 'en las últimas 24 horas' };
  if (hours < 24 * 7) return { cls: 'week', hint: 'esta semana' };
  return { cls: 'old', hint: 'hace más de una semana' };
}

// Una fila de la tarjeta: ícono de color + etiqueta chica + dato. Cada dato tiene su propio color y forma para distinguirlo de un vistazo.
function Fact({ kind, icon, label, children }) {
  return (
    <li className={`ms-fact ms-${kind}`}>
      <span className="ms-icon">{icon}</span>
      <div className="ms-body">
        <span className="ms-label">{label}</span>
        <span className="ms-value">{children}</span>
      </div>
    </li>
  );
}

// Resumen de un integrante en Panel → Equipo: nombre y rol de acceso arriba; debajo, cargo, correo, estudios y (solo para el
// Moderador: la API manda `lastSeenAt` y `online` solo a él) si está conectado ahora o cuándo fue su última conexión.
export default function MemberSummary({ m }) {
  const seen = 'lastSeenAt' in m ? seenState(m.lastSeenAt, m.online) : null;
  const academic = semesterGroupLine(m);
  return (
    <div className="member-summary">
      <div className="ms-head">
        <strong className="ms-name">{m.name}</strong>
        {m.access && <span className={`ms-access ms-access-${m.access}`}>{ROLE_LABEL[m.access]}</span>}
      </div>
      <ul className="ms-facts">
        <Fact kind="role" icon={<IconBadge />} label="Cargo">
          {m.role ? <span className="ms-role-text">{m.role}</span> : <span className="ms-empty">Sin cargo</span>}
        </Fact>
        <Fact kind="email" icon={<IconMail />} label="Correo">
          <span className="ms-email-text">{m.email}</span>
        </Fact>
        {(m.degree || academic) && (
          <Fact kind="study" icon={<IconCap />} label="Estudios">
            {m.degree && <span className="ms-degree">{m.degree}</span>}
            {academic && <span className="ms-chips">{academic.split(' · ').map((part) => <span key={part} className="ms-chip">{part}</span>)}</span>}
          </Fact>
        )}
        {seen && (
          <Fact kind="seen" icon={<IconClock />} label="Conexión">
            <span className={`ms-when ms-when-${seen.cls}`}>
              <span className="ms-dot" aria-hidden="true" />
              {seen.cls === 'online' && <strong className="ms-online-text">Conectado</strong>}
              {seen.cls !== 'online' && m.lastSeenAt && <>Última conexión: {formatDate(m.lastSeenAt)} · {formatTime(m.lastSeenAt)}{seen.hint && <span className="ms-hint">{seen.hint}</span>}</>}
              {seen.cls === 'none' && 'Sin registro todavía'}
            </span>
          </Fact>
        )}
      </ul>
    </div>
  );
}
