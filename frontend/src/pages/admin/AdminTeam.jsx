import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { ROLE_LABEL, ROLE_HELP, canEdit } from '../../roles.js';
import PasswordInput from '../../components/PasswordInput.jsx';
import MemberOrder from './MemberOrder.jsx';
import { CrudPanel, ImageField, text } from './shared.jsx';

export default function AdminTeam() {
  const { user } = useAuth();
  const editable = canEdit(user?.role);
  const [version, setVersion] = useState(0); // al reordenar se vuelve a cargar la lista de abajo
  return (
    <>
    {editable ? <MemberOrder onChange={() => setVersion((v) => v + 1)} /> : (
      <p className="hint">Aquí ves a las personas de la planilla. Para cambiar <strong>tu información</strong> (nombre, cargo, licenciatura y foto) ve a <Link to="/perfil">Mi perfil</Link>; el resto lo administra un Técnico.</p>
    )}
    <CrudPanel key={version}
      listPath="/members/all" endpoint="/members" newLabel="Nuevo integrante" newAtEnd
      deleteNote="También se eliminará su cuenta de acceso."
      blank={(items) => ({ name: '', role: '', degree: '', photo: null, order: items?.length || 0, email: '', password: '', access: 'miembro' })}
      summary={(m) => <><strong>{m.name}</strong><br /><span className="muted">{m.role ? `${m.role} · ` : ''}{m.email ?? m.degree}{m.access ? ` · ${ROLE_LABEL[m.access]}` : ''}</span></>}
      fields={(m, set) => (
        <>
          {text('Nombre', m.name, set('name'), { required: true, maxLength: 100 })}
          {text('Cargo', m.role, set('role'), { maxLength: 100 })}
          {text('Licenciatura', m.degree, set('degree'), { maxLength: 120 })}
          {text('Correo de acceso', m.email, set('email'), { type: 'email', required: true, autoComplete: 'off' })}
          <label>{m._id ? 'Nueva contraseña (déjala vacía para no cambiarla)' : 'Contraseña (mínimo 10 caracteres)'}
            <PasswordInput required={!m._id} minLength={10} value={m.password ?? ''} onChange={(e) => set('password')(e.target.value)} autoComplete="new-password" />
          </label>
          <label>Rol
            <select value={m.access ?? 'miembro'} onChange={(e) => set('access')(e.target.value)}>
              {Object.entries(ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label} ({ROLE_HELP[value]})</option>)}
            </select>
          </label>
          <ImageField label="Foto" value={m.photo} onChange={set('photo')} />
        </>
      )}
    />
    </>
  );
}
