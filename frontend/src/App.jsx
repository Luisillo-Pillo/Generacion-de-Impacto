import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Proposals from './pages/Proposals.jsx';
import News from './pages/News.jsx';
import NewsDetail from './pages/NewsDetail.jsx';
import Mailbox from './pages/Mailbox.jsx';
import Team from './pages/Team.jsx';
import Login from './pages/Login.jsx';
import Profile from './pages/Profile.jsx';
import Spinner from './components/Spinner.jsx';
import './App.css';

// El panel de administración se descarga solo cuando alguien entra a él: los visitantes no cargan su código.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'));
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages.jsx'));
const AdminNews = lazy(() => import('./pages/admin/AdminNews.jsx'));
const AdminProposals = lazy(() => import('./pages/admin/AdminProposals.jsx'));
const AdminTeam = lazy(() => import('./pages/admin/AdminTeam.jsx'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings.jsx'));
const AdminActivity = lazy(() => import('./pages/admin/AdminActivity.jsx'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Header />
      <main>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/propuestas" element={<Proposals />} />
            <Route path="/noticias" element={<News />} />
            <Route path="/noticias/:slug" element={<NewsDetail />} />
            <Route path="/buzon" element={<Mailbox />} />
            <Route path="/equipo" element={<Team />} />
            <Route path="/acceso" element={<Login />} />
            <Route path="/perfil" element={<Profile />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="mensajes" replace />} />
              <Route path="mensajes" element={<AdminMessages />} />
              <Route path="noticias" element={<AdminNews />} />
              <Route path="propuestas" element={<AdminProposals />} />
              <Route path="equipo" element={<AdminTeam />} />
              <Route path="ajustes" element={<AdminSettings />} />
              <Route path="actividad" element={<AdminActivity />} />
            </Route>
            <Route path="*" element={<div className="container section"><h1 className="title">Página no encontrada</h1></div>} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
