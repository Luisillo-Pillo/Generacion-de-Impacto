import PasswordInput from '../../components/PasswordInput.jsx';
import { CrudPanel, ImageField, text } from './shared.jsx';

export default function AdminTeam() {
  return (
    <CrudPanel
      listPath="/members/all" endpoint="/members" newLabel="Nuevo integrante"
      deleteNote="También se eliminará su cuenta de acceso."
      blank={(items) => ({ name: '', role: '', degree: '', photo: null, order: items?.length || 0, email: '', password: '' })}
      summary={(m) => <><strong>{m.name}</strong><br /><span className="muted">{m.role ? `${m.role} · ` : ''}{m.email}</span></>}
      fields={(m, set) => (
        <>
          {text('Nombre', m.name, set('name'), { required: true, maxLength: 100 })}
          {text('Cargo', m.role, set('role'), { maxLength: 100 })}
          {text('Licenciatura', m.degree, set('degree'), { maxLength: 120 })}
          {text('Orden', m.order, (v) => set('order')(Number(v)), { type: 'number' })}
          {text('Correo de acceso', m.email, set('email'), { type: 'email', required: true, autoComplete: 'off' })}
          <label>{m._id ? 'Nueva contraseña (déjala vacía para no cambiarla)' : 'Contraseña (mínimo 8 caracteres)'}
            <PasswordInput required={!m._id} minLength={8} value={m.password ?? ''} onChange={(e) => set('password')(e.target.value)} autoComplete="new-password" />
          </label>
          <ImageField label="Foto" value={m.photo} onChange={set('photo')} />
        </>
      )}
    />
  );
}
