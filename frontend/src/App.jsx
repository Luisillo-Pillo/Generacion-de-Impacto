import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Proposals from './pages/Proposals.jsx';
import News from './pages/News.jsx';
import NewsDetail from './pages/NewsDetail.jsx';
import Mailbox from './pages/Mailbox.jsx';
import Team from './pages/Team.jsx';
import Login from './pages/Login.jsx';
import Admin from './pages/Admin.jsx';

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
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<div className="container section"><h1 className="title">Página no encontrada</h1></div>} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
