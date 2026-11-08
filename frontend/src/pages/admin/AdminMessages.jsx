import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { canEdit } from '../../roles.js';
import { useDialog } from '../../components/Dialog.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useList } from './shared.jsx';
import MessageCard from './MessageCard.jsx';
import { TYPES, STATUS, REVIEW, URGENCY, TYPE_LABEL } from './messageLabels.js';
import './AdminMessages.css';

const PAGE_SIZE = 20;

function Filter({ label, options, value, onChange }) {
  return (
    <label className="filter">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export default function AdminMessages() {
  const { confirm, notify } = useDialog();
  const { user } = useAuth();
  const { stats, refreshStats } = useOutletContext();
  const role = user?.role;
  const isMod = canEdit(role); // el Moderador además ve la papelera y elimina; el Miembro lee, responde, actualiza y exporta
  // Todos los filtros empiezan en «Todos»; la lista siempre va en orden cronológico, lo más reciente arriba
  const [filters, setFilters] = useState({ type: '', status: '', review: '', urgency: '' });
  const [typed, setTyped] = useState(''); // lo que se escribe en el buscador
  const [search, setSearch] = useState(''); // la búsqueda aplicada
  const [page, setPage] = useState(1);
  const [trash, setTrash] = useState(false); // papelera: mensajes eliminados, se borran solos a los 30 días
  const [exporting, setExporting] = useState(false);

  const filterQuery = new URLSearchParams(Object.entries({ ...filters, q: search }).filter(([, v]) => v)).toString();
  const query = trash ? `trash=1&page=${page}` : `${filterQuery}${filterQuery ? '&' : ''}page=${page}`;
  const { items: data, loading, error, reload, setError } = useList(`/messages?${query}&limit=${PAGE_SIZE}`);
  const items = data?.items;

  const setFilter = (key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const applySearch = (value) => {
    setSearch(value);
    setPage(1);
  };
  const refresh = () => {
    reload();
    refreshStats();
  };
  const fail = (title) => (err) => notify({ title, message: err.message });

  const actions = {
    // Devuelven true si salió bien (las tarjetas lo usan para confirmar o limpiar sus campos) y false si falló
    update: (id, changes) => api(`/messages/${id}`, { method: 'PATCH', body: changes }).then(() => { refresh(); return true; }).catch((e) => { setError(e.message); return false; }),
    addNote: (id, text) => api(`/messages/${id}/notes`, { method: 'POST', body: { text } }).then(() => { reload(); return true; }).catch(async (e) => { await notify({ title: 'No se pudo agregar la nota', message: e.message }); return false; }),
    async remove(id) {
      const ok = await confirm({ title: '¿Enviar a la papelera?', message: 'Podrás restaurarlo durante 30 días; después se eliminará definitivamente.', confirmLabel: 'Enviar a la papelera' });
      if (ok) await api(`/messages/${id}`, { method: 'DELETE' }).then(refresh).catch(fail('No se pudo eliminar'));
    },
    restore: (id) => api(`/messages/${id}/restore`, { method: 'POST' }).then(refresh).catch(fail('No se pudo restaurar')),
    async removeForever(id) {
      const ok = await confirm({ title: '¿Eliminar definitivamente?', message: 'Se eliminará el mensaje con sus imágenes. Esta acción no se puede deshacer.', confirmLabel: 'Eliminar definitivamente' });
      if (ok) await api(`/messages/${id}/permanent`, { method: 'DELETE' }).then(refresh).catch(fail('No se pudo eliminar'));
    },
  };

  // El archivo lleva datos personales: se descarga con la sesión (un enlace normal no puede enviar el token) y queda en la bitácora
  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await api(`/messages/export${filterQuery ? `?${filterQuery}` : ''}`, { blob: true });
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), { href: url, download: `mensajes-${new Date().toISOString().slice(0, 10)}.csv` });
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      await notify({ title: 'No se pudo exportar', message: err.message });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      {stats && !trash && (
        <p className="stats" aria-label="Resumen de mensajes">
          <strong>{stats.nuevos}</strong> nuevos · <strong>{stats.pendientes}</strong> pendientes · {stats.total} en total
          <span className="muted"> ({Object.entries(stats.porTipo).map(([t, n]) => `${n} ${TYPE_LABEL[t].toLowerCase()}s`).join(', ')})</span>
        </p>
      )}
      <div className="filters">
        {!trash && (
          <>
            <Filter label="Tipo" options={TYPES} value={filters.type} onChange={setFilter('type')} />
            <Filter label="Estado" options={STATUS} value={filters.status} onChange={setFilter('status')} />
            <Filter label="Revisión" options={[['', 'Todas'], ...REVIEW]} value={filters.review} onChange={setFilter('review')} />
            <Filter label="Urgencia" options={[['', 'Todas'], ...URGENCY]} value={filters.urgency} onChange={setFilter('urgency')} />
            <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); applySearch(typed.trim()); }}>
              <label>Buscar
                <input type="search" value={typed} maxLength={100} placeholder="En el asunto o el mensaje" onChange={(e) => setTyped(e.target.value)} />
              </label>
              <button className="btn btn-dark sm">Buscar</button>
              {search && <button type="button" className="btn btn-dark sm" onClick={() => { setTyped(''); applySearch(''); }}>Limpiar</button>}
            </form>
          </>
        )}
        <span className="filters-end">
          {!trash && <button type="button" className="btn btn-dark sm" disabled={exporting} onClick={exportCsv}>{exporting ? 'Exportando…' : 'Exportar CSV'}</button>}
          {isMod && (
            <button type="button" className="btn btn-dark sm" aria-pressed={trash} onClick={() => { setTrash(!trash); setPage(1); }}>
              {trash ? '← Volver a los mensajes' : 'Papelera'}
            </button>
          )}
        </span>
      </div>
      {trash && <p className="muted">Los mensajes eliminados se quedan aquí 30 días y después se borran solos.</p>}
      {error && <p className="error">{error}</p>}
      {loading && <Spinner />}
      {items?.length === 0 && <p className="muted">{trash ? 'La papelera está vacía.' : 'No hay mensajes con estos filtros.'}</p>}
      {items?.map((m) => <MessageCard key={m._id} m={m} trash={trash} role={role} actions={actions} />)}
      {data?.pages > 1 && (
        <nav className="pager" aria-label="Páginas de mensajes">
          <button className="btn btn-dark sm" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>← Anterior</button>
          <span>Página {data.page} de {data.pages} · {data.total} mensajes</span>
          <button className="btn btn-dark sm" disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)}>Siguiente →</button>
        </nav>
      )}
    </div>
  );
}
