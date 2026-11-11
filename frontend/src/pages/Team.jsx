import { useFeed, useFetch } from '../hooks.js';
import Spinner from '../components/Spinner.jsx';
import NewItemsBanner from '../components/NewItemsBanner.jsx';
import { fileUrl } from '../api.js';
import { initials, semesterGroupLine } from '../utils.js';
import { groupByLevel } from '../hierarchy.js';
import { OrgAmbient, TierDecor } from '../components/TeamDecor.jsx';
import './Team.css';
import { usePageMeta } from '../pageMeta.js';

const TIER_LABEL = { 1: 'Presidencia', 2: 'Vicepresidencia y tesorería', 3: 'Integrantes' };

export default function Team() {
  usePageMeta({ title: 'Equipo', description: 'Conoce a las personas de la planilla Generación de Impacto y cómo contactarlas.' });
  const members = useFeed('/members');
  const { data: settings } = useFetch('/settings');
  const social = settings?.social || {};
  const links = [
    ['Instagram', social.instagram],
  ].filter(([, url]) => /^https?:\/\//i.test(url || '')); // solo enlaces http(s)

  return (
    <section className="section paper page-min">
      <div className="container">
        <div className="team-head">
          <h1 className="title">Nuestro <mark>equipo</mark></h1>
          <p className="team-slogan" aria-hidden="true">Nuestra voz, nuestras ideas, nuestro impacto.</p>
        </div>
        <NewItemsBanner count={members.incoming} singular="integrante nuevo" plural="integrantes nuevos" onShow={members.showIncoming} />
        {members.loading && <Spinner />}
        {members.error && <p className="error">{members.error}</p>}
        {members.data?.length === 0 && <p className="muted">Pronto presentaremos a los integrantes de la planilla.</p>}
        {/* Organigrama: presidencia arriba, vicepresidencia y tesorería en medio y el resto debajo (ver hierarchy.js) */}
        <div className="org">
          <OrgAmbient />
          {groupByLevel(members.data ?? []).map(({ level, members: tier }) => (
            <div key={level} className={`tier tier-${level}`} role="group" aria-label={TIER_LABEL[level]}>
              <TierDecor level={level} />
              {tier.map((m) => (
                <article key={m._id} className="member">
                  {m.photo ? <img src={fileUrl(m.photo, 640)} alt={m.name} loading="lazy" /> : <div className="avatar">{initials(m.name)}</div>}
                  <div className="member-info">
                    <h3>{m.name}</h3>
                    {m.role && <p className="role">{m.role}</p>}
                    {m.degree && <p className="muted">{m.degree}</p>}
                    {semesterGroupLine(m) && <p className="muted">{semesterGroupLine(m)}</p>}
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>

        {(links.length > 0 || social.email) && (
          <div className="contact">
            <h2 className="title small">Contacto y <mark>redes</mark></h2>
            <div className="chips">
              {links.map(([label, url]) => (
                <a key={label} className="btn btn-dark" href={url} target="_blank" rel="noopener noreferrer">{label}</a>
              ))}
              {social.email && <a className="btn btn-red" href={`mailto:${social.email}`}>{social.email}</a>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
