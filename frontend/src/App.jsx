import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { usePageMeta } from './pageMeta.js';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Proposals from './pages/Proposals.jsx';
import News from './pages/News.jsx';
import Mailbox from './pages/Mailbox.jsx';
import Team from './pages/Team.jsx';
import Privacy from './pages/Privacy.jsx';
import Track from './pages/Track.jsx';
import Login from './pages/Login.jsx';
import Profile from './pages/Profile.jsx';
import Spinner from './components/Spinner.jsx';
import './App.css';

// El panel de administración se descarga solo cuando alguien entra a él: los visitantes no cargan su código.
// La noticia individual también se descarga aparte: trae el lector de Markdown, que el resto del sitio no necesita
const NewsDetail = lazy(() => import('./pages/NewsDetail.jsx'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'));
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages.jsx'));
const AdminNews = lazy(() => import('./pages/admin/AdminNews.jsx'));
const AdminProposals = lazy(() => import('./pages/admin/AdminProposals.jsx'));
const AdminTeam = lazy(() => import('./pages/admin/AdminTeam.jsx'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings.jsx'));

// Toda página empieza arriba, sin importar dónde se quedó el scroll en la anterior: al cambiar de ruta, al recargar, al
// volver atrás y al pulsar un enlace a la página en la que ya estás (cada navegación trae su propia `key`; los enlaces con
// ancla `#` se dejan al navegador). Por eso se apaga la restauración automática del navegador y el salto es inmediato (`instant`; el
// `scroll-behavior: smooth` global lo animaría desde donde estaba y las páginas que cargan después lo cortarían a medias).
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

// Además, para quien usa teclado o lector de pantalla, el foco pasa al contenido nuevo (no en la primera carga, para no
// robarle el foco a la página recién abierta)
function ScrollToTop() {
  const { pathname, hash, key } = useLocation();
  const first = useRef(true);
  useLayoutEffect(() => {
    if (!hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); // antes de pintar: no se ve el salto
  }, [key, hash]);
  useEffect(() => {
    if (first.current) first.current = false;
    else document.getElementById('contenido')?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

function NotFound() {
  usePageMeta({ title: 'Página no encontrada' });
  return (
    <section className="section paper page-min">
      <div className="container narrow">
        <h1 className="title">Página <mark>no encontrada</mark></h1>
        <p className="lead">La dirección que abriste no existe o ya cambió.</p>
        <Link to="/" className="btn btn-red">Ir al inicio</Link>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <ScrollToTop />
      <Header />
      <main id="contenido" tabIndex={-1}>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/propuestas" element={<Proposals />} />
            <Route path="/noticias" element={<News />} />
            <Route path="/noticias/:slug" element={<NewsDetail />} />
            <Route path="/buzon" element={<Mailbox />} />
            <Route path="/equipo" element={<Team />} />
            <Route path="/privacidad" element={<Privacy />} />
            <Route path="/seguimiento" element={<Track />} />
            <Route path="/acceso" element={<Login />} />
            <Route path="/perfil" element={<Profile />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="mensajes" replace />} />
              <Route path="mensajes" element={<AdminMessages />} />
              <Route path="noticias" element={<AdminNews />} />
              <Route path="propuestas" element={<AdminProposals />} />
              <Route path="equipo" element={<AdminTeam />} />
              <Route path="ajustes" element={<AdminSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
