import { Link } from 'react-router-dom';
import { useFetch } from '../hooks.js';
import ProposalCard from '../components/ProposalCard.jsx';
import NewsCard from '../components/NewsCard.jsx';

export default function Home() {
  const proposals = useFetch('/proposals');
  const news = useFetch('/news');

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <h1 className="hero-title">
            <img className="hero-logo" src="/brand/logo-planilla.svg" alt="Generación de Impacto" />
          </h1>
          <p className="hero-sub">Planilla del Consejo Estudiantil de la ENSFA</p>
          <div className="hero-cta">
            <Link to="/buzon" className="btn btn-red">Escríbenos en el buzón</Link>
            <Link to="/propuestas" className="btn btn-light">Conoce nuestras propuestas</Link>
          </div>
        </div>
      </section>

      <section className="section paper">
        <div className="container">
          <h2 className="title">Últimas <mark>noticias</mark></h2>
          {news.loading && <p className="muted">Cargando…</p>}
          {news.error && <p className="error">{news.error}</p>}
          {news.data?.length === 0 && <p className="muted">Pronto publicaremos novedades.</p>}
          <div className="grid">
            {news.data?.slice(0, 3).map((n) => <NewsCard key={n._id} n={n} />)}
          </div>
          <div className="center">
            <Link to="/noticias" className="btn btn-dark">Ver todas las noticias</Link>
          </div>
        </div>
      </section>

      <section className="section dark">
        <div className="container about">
          <div>
            <h2 className="title light">Quiénes <mark>somos</mark></h2>
            <p>
              <strong>Generación de Impacto</strong> propone un Consejo Estudiantil cercano a la comunidad de la ENSFA,
              que escuche a los distintos grupos, dé seguimiento a sus inquietudes y organice actividades que fortalezcan
              la formación docente, la convivencia y la responsabilidad social.
            </p>
            <p>
              Promover la participación y el bienestar de la comunidad estudiantil de la ENSFA mediante acciones
              académicas, recreativas, solidarias y de representación, con mecanismos claros de diálogo, gestión y
              rendición de cuentas.
            </p>
          </div>
          <img src="/brand/logo-ensfa.png" alt="Escuela Normal Superior Federal de Aguascalientes" className="about-ensfa" />
        </div>
      </section>

      <section className="section paper">
        <div className="container">
          <h2 className="title">Nuestras <mark>propuestas</mark></h2>
          {proposals.loading && <p className="muted">Cargando…</p>}
          {proposals.error && <p className="error">{proposals.error}</p>}
          <div className="grid">
            {proposals.data?.slice(0, 3).map((p) => <ProposalCard key={p._id} p={p} />)}
          </div>
          <div className="center">
            <Link to="/propuestas" className="btn btn-dark">Ver todas las propuestas</Link>
          </div>
        </div>
      </section>


      <section className="cta-band">
        <div className="container">
          <h2>Tu opinión cuenta</h2>
          <p>Quejas, propuestas, preguntas o problemas: cuéntanoslos, de forma anónima o con tus datos.</p>
          <Link to="/buzon" className="btn btn-light">Ir al buzón digital</Link>
        </div>
      </section>
    </>
  );
}
