import { useState } from 'react';
import PasswordInput from '../../components/PasswordInput.jsx';
import MemberOrder from './MemberOrder.jsx';
import { CrudPanel, ImageField, text } from './shared.jsx';

export default function AdminTeam() {
  const [version, setVersion] = useState(0); // al reordenar se vuelve a cargar la lista de abajo
  return (
    <>
    <MemberOrder onChange={() => setVersion((v) => v + 1)} />
    <CrudPanel key={version}
      listPath="/members/all" endpoint="/members" newLabel="Nuevo integrante" newAtEnd
      deleteNote="También se eliminará su cuenta de acceso."
      blank={(items) => ({ name: '', role: '', degree: '', photo: null, order: items?.length || 0, email: '', password: '', access: 'admin' })}
      summary={(m) => <><strong>{m.name}</strong><br /><span className="muted">{m.role ? `${m.role} · ` : ''}{m.email}{m.access === 'moderador' ? ' · Moderador' : ''}</span></>}
      fields={(m, set) => (
        <>
          {text('Nombre', m.name, set('name'), { required: true, maxLength: 100 })}
          {text('Cargo', m.role, set('role'), { maxLength: 100 })}
          {text('Licenciatura', m.degree, set('degree'), { maxLength: 120 })}
          {text('Correo de acceso', m.email, set('email'), { type: 'email', required: true, autoComplete: 'off' })}
          <label>{m._id ? 'Nueva contraseña (déjala vacía para no cambiarla)' : 'Contraseña (mínimo 10 caracteres)'}
            <PasswordInput required={!m._id} minLength={10} value={m.password ?? ''} onChange={(e) => set('password')(e.target.value)} autoComplete="new-password" />
          </label>
          <label>Acceso al panel
            <select value={m.access ?? 'admin'} onChange={(e) => set('access')(e.target.value)}>
              <option value="admin">Administrador (todo)</option>
              <option value="moderador">Moderador (solo mensajes, sin datos de contacto)</option>
            </select>
          </label>
          <ImageField label="Foto" value={m.photo} onChange={set('photo')} />
        </>
      )}
    />
    </>
  );
}
