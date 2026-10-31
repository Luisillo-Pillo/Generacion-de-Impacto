import { useFetch } from '../hooks.js';
import Spinner from '../components/Spinner.jsx';
import { fileUrl } from '../api.js';
import { initials } from '../utils.js';

export default function Team() {
  const members = useFetch('/members');
  const { data: settings } = useFetch('/settings');
  const social = settings?.social || {};
  const links = [
    ['Instagram', social.instagram],
    ['Facebook', social.facebook],
    ['TikTok', social.tiktok],
  ].filter(([, url]) => /^https?:\/\//i.test(url || '')); // solo enlaces http(s)

  return (
    <section className="section paper page-min">
      <div className="container">
        <h1 className="title">Nuestro <mark>equipo</mark></h1>
        {members.loading && <Spinner />}
        {members.error && <p className="error">{members.error}</p>}
        {members.data?.length === 0 && <p className="muted">Pronto presentaremos a los integrantes de la planilla.</p>}
        <div className="grid members">
          {members.data?.map((m) => (
            <article key={m._id} className="member">
              {m.photo ? <img src={fileUrl(m.photo)} alt={m.name} loading="lazy" /> : <div className="avatar">{initials(m.name)}</div>}
              <h3>{m.name}</h3>
              {m.role && <p className="role">{m.role}</p>}
              {m.degree && <p className="muted">{m.degree}</p>}
            </article>
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
