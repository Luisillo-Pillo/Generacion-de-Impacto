import { Component } from 'react';

// Red de seguridad: si algo falla al dibujar una página, en vez de dejar la pantalla en blanco se muestra un aviso con
// la opción de recargar. El error se reporta (sin datos personales) solo si el monitoreo está configurado.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
    if (import.meta.env.VITE_SENTRY_DSN) import('../monitoring.js').then((m) => m.report(error)).catch(() => {});
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ maxWidth: 560, margin: '4rem auto', padding: '0 1rem', color: '#f1e8db', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, textTransform: 'uppercase' }}>Algo salió mal</h1>
        <p>Ocurrió un error inesperado al mostrar esta página. Tus datos no se perdieron: recarga e inténtalo de nuevo.</p>
        <button className="btn btn-red" onClick={() => window.location.reload()}>Recargar</button>
      </main>
    );
  }
}
