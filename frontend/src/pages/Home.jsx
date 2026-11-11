import { Link } from 'react-router-dom';
import { useFeed } from '../hooks.js';
import Spinner from '../components/Spinner.jsx';
import ProposalCard from '../components/ProposalCard.jsx';
import NewsCard from '../components/NewsCard.jsx';
import NewItemsBanner from '../components/NewItemsBanner.jsx';
import './Home.css';

// Papelitos decorativos del héroe: posición horizontal (%), tamaño (px), duración y retraso (s), deriva lateral y giro.
// Valores fijos (no aleatorios) para que la página se dibuje igual en cada visita.
const CONFETTI = [
  { x: 5, s: 16, t: 15, d: 0, dx: 30, r: 260, paper: false },
  { x: 14, s: 10, t: 19, d: 4, dx: -24, r: -200, paper: true },
  { x: 26, s: 14, t: 17, d: 9, dx: 40, r: 320, paper: false },
  { x: 38, s: 9, t: 21, d: 2, dx: -30, r: -280, paper: true },
  { x: 52, s: 15, t: 16, d: 6, dx: 26, r: 240, paper: false },
  { x: 63, s: 10, t: 20, d: 11, dx: -36, r: -220, paper: true },
  { x: 76, s: 13, t: 18, d: 3, dx: 34, r: 300, paper: false },
  { x: 86, s: 9, t: 22, d: 8, dx: -22, r: -260, paper: true },
  { x: 94, s: 15, t: 16, d: 12, dx: -28, r: -300, paper: false },
];

export default function Home() {
  // Se actualizan solas cada minuto sin mover lo que se lee: lo nuevo se avisa con un botón (ver useFeed)
  const proposals = useFeed('/proposals');
  const news = useFeed('/news');

  return (
    <>
      <section className="hero">
        <div className="hero-confetti" aria-hidden="true">
          {CONFETTI.map((c) => (
            <span
              key={c.x}
              className={`bit${c.paper ? ' paper' : ''}`}
              style={{ '--x': `${c.x}%`, '--s': `${c.s}px`, '--t': `${c.t}s`, '--d': `${c.d}s`, '--dx': `${c.dx}px`, '--r': `${c.r}deg` }}
            />
          ))}
        </div>
        <div className="container hero-inner">
          <h1 className="hero-title">
            <img className="hero-logo" src="/brand/logo-planilla.svg" alt="Generación de Impacto" />
          </h1>
          <p className="hero-sub">Planilla del Consejo Estudiantil de la ENSFA</p>
          <div className="btn-row">
            <Link to="/buzon" className="btn btn-red">Escríbenos en el buzón</Link>
            <Link to="/propuestas" className="btn btn-light">Conoce nuestras propuestas</Link>
          </div>
        </div>
      </section>

      <section className="section paper">
        <div className="container">
          <h2 className="title">Últimas <mark>noticias</mark></h2>
          <NewItemsBanner count={news.incoming} singular="noticia nueva" plural="noticias nuevas" onShow={news.showIncoming} />
          {news.loading && <Spinner />}
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
          <NewItemsBanner count={proposals.incoming} singular="propuesta nueva" plural="propuestas nuevas" onShow={proposals.showIncoming} />
          {proposals.loading && <Spinner />}
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
