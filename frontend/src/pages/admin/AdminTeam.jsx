import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { ROLE_LABEL, canEdit } from '../../roles.js';
import AcademicFields from '../../components/AcademicFields.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';
import MemberOrder from './MemberOrder.jsx';
import MemberSummary from './MemberSummary.jsx';
import { CrudPanel, ImageField, text } from './shared.jsx';

const LIVE_TOPICS = ['team', 'presence']; // el aviso de presencia solo le llega al Moderador, que es quien ve quién está conectado

export default function AdminTeam() {
  const { user } = useAuth();
  const editable = canEdit(user?.role);
  const [version, setVersion] = useState(0); // al reordenar se vuelve a cargar la lista de abajo
  return (
    <>
    {editable ? <MemberOrder onChange={() => setVersion((v) => v + 1)} /> : (
      <p className="hint">Para cambiar <strong>tu información</strong> ve a <Link to="/perfil">Mi perfil</Link>. Si quieres sugerir algún cambio para otro compañero, contacta con un moderador.</p>
    )}
    <CrudPanel key={version}
      listPath="/members/all" endpoint="/members" newLabel="Nuevo integrante" newAtEnd
      deleteNote="También se eliminará su cuenta de acceso." liveTopics={LIVE_TOPICS}
      blank={(items) => ({ name: '', role: '', degree: '', semester: '', group: '', photo: null, order: items?.length || 0, email: '', password: '', access: 'miembro' })}
      summary={(m) => <MemberSummary m={m} />}
      fields={(m, set) => (
        <>
          {text('Nombre', m.name, set('name'), { required: true, maxLength: 100, spellCheck: false })}
          {text('Cargo', m.role, set('role'), { maxLength: 100 })}
          <AcademicFields degree={m.degree} semester={m.semester} group={m.group} onChange={(key, value) => set(key)(value)} />
          {text('Correo de acceso', m.email, set('email'), { type: 'email', required: true, autoComplete: 'off' })}
          <label>{m._id ? 'Nueva contraseña (déjala vacía para no cambiarla)' : 'Contraseña (mínimo 10 caracteres)'}
            <PasswordInput required={!m._id} minLength={10} value={m.password ?? ''} onChange={(e) => set('password')(e.target.value)} autoComplete="new-password" />
          </label>
          <label>Rol
            <select value={m.access ?? 'miembro'} onChange={(e) => set('access')(e.target.value)}>
              {Object.entries(ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <ImageField label="Foto" value={m.photo} onChange={set('photo')} />
        </>
      )}
    />
    </>
  );
}
