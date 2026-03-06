import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

/** Icono de marca: documento/clipboard con referencia a historia clínica y confianza */
function LogoIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="6"
        y="4"
        width="20"
        height="24"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M10 10h12M10 14h12M10 18h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="22" cy="22" r="6" fill="currentColor" opacity="0.9" />
      <path
        d="M20 22l2 2 4-4"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>
      <header className="app-header" role="banner">
        <div className="app-header__inner">
          <Link to="/" className="app-logo" aria-label="InterHCE Ledger - Inicio">
            <LogoIcon />
            <span>InterHCE Ledger</span>
          </Link>
          <nav className="app-nav" aria-label="Navegación principal">
            <Link to="/">Inicio</Link>
            <Link to="/episodios">Episodios</Link>
            <Link to="/episodios/crear">Crear episodio</Link>
            {isLogin ? (
              <Link to="/">Volver</Link>
            ) : (
              <Link to="/login">Ingresar</Link>
            )}
          </nav>
        </div>
      </header>
      <main id="main-content" className="app-main" role="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
