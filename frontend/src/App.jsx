import { useEffect } from 'react';
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
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminMessages from './pages/admin/AdminMessages.jsx';
import AdminNews from './pages/admin/AdminNews.jsx';
import AdminProposals from './pages/admin/AdminProposals.jsx';
import AdminTeam from './pages/admin/AdminTeam.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';

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
          </Route>
          <Route path="*" element={<div className="container section"><h1 className="title">Página no encontrada</h1></div>} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
