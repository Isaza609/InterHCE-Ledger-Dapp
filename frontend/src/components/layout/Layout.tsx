import { Link, NavLink, useLocation } from "react-router-dom";
import { Fragment, type ReactNode } from "react";
import { useSesion } from "@/shared/auth/SessionContext";
import { cerrarSesionDapp } from "@/shared/services/api";
import { sesionTieneCapacidad } from "@/shared/auth/capabilities";

interface LayoutProps {
  children: ReactNode;
}

interface SidebarNavItem {
  to: string;
  label: string;
  capability?: string;
}

interface SidebarNavSection {
  title: string;
  items: SidebarNavItem[];
}

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

const NAV_ITEMS: SidebarNavSection[] = [
  {
    title: "Inicio",
    items: [{ to: "/portal", label: "Resumen operativo" }]
  },
  {
    title: "Gestión clínica",
    items: [
      { to: "/pacientes", label: "Pacientes", capability: "episodios.consultar" },
      { to: "/episodios", label: "Episodios", capability: "episodios.consultar" },
      { to: "/episodios/crear", label: "Crear episodio", capability: "episodios.crear" },
      { to: "/episodios/actualizar", label: "Actualizar episodio", capability: "episodios.actualizar" }
    ]
  },
  {
    title: "Control y evidencia",
    items: [
      { to: "/episodios/trazabilidad", label: "Trazabilidad", capability: "trazabilidad.consultar" },
      { to: "/infraestructura", label: "Infraestructura", capability: "ips.usuarios.gestionar" }
    ]
  }
];

const PUBLIC_NAV_ITEMS = [
  { label: "Inicio", target: "inicio" },
  { label: "Servicios", target: "servicios" },
  { label: "Nosotros", target: "nosotros" },
  { label: "Contacto", target: "contacto" }
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { sesion, cerrarSesion } = useSesion();
  const isPublicRoute = location.pathname === "/" || location.pathname === "/login";

  const onCerrarSesion = async () => {
    await cerrarSesionDapp(sesion);
    cerrarSesion();
  };

  const getPublicHref = (target: string) => {
    if (target === "inicio") {
      return location.pathname === "/" ? "#inicio" : "/";
    }
    return location.pathname === "/" ? `#${target}` : `/#${target}`;
  };

  return (
    <div className={`app-shell${isPublicRoute ? " app-shell--public" : ""}`}>
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>
      <header className={`app-header${isPublicRoute ? " public-header" : ""}`} role="banner">
        <div
          className={`${isPublicRoute ? "container" : "container container--app"} app-header__row${
            isPublicRoute ? " public-header__row" : ""
          }`}
        >
          <Link to="/" className="app-brand" aria-label="InterHCE Clínica - Inicio">
            <span className="app-brand__icon">
              <LogoIcon />
            </span>
            <span className="app-brand__text">
              <strong>InterHCE Clínica</strong>
              <small>Interoperabilidad segura entre IPS</small>
            </span>
          </Link>
          {isPublicRoute ? (
            <nav className="public-nav" aria-label="Navegación institucional">
              {PUBLIC_NAV_ITEMS.map((item) => (
                <a key={item.target} href={getPublicHref(item.target)} className="public-nav__link">
                  {item.label}
                </a>
              ))}
              {sesion ? (
                <>
                  <Link to="/portal" className="public-nav__link">
                    Ir al panel
                  </Link>
                  <button type="button" className="btn btn--ghost" onClick={onCerrarSesion}>
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `public-nav__link public-nav__link--cta${isActive ? " public-nav__link--active" : ""}`
                  }
                >
                  Iniciar sesión
                </NavLink>
              )}
            </nav>
          ) : (
            <>
              <div className="app-topbar__session">
                {sesion ? (
                  <>
                    <div className="session-card">
                      <span className="session-pill">
                        {sesion.rol}
                        {sesion.ipsId ? ` · ${sesion.ipsId}` : ""}
                      </span>
                      <strong>{sesion.nombre}</strong>
                      <small>{sesion.correo}</small>
                    </div>
                    <button type="button" className="btn btn--ghost" onClick={onCerrarSesion}>
                      Cerrar sesión
                    </button>
                  </>
                ) : (
                  <Link to="/login" className="btn btn--primary">
                    Iniciar sesión
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </header>
      <main
        id="main-content"
        className={`app-main${isPublicRoute ? " public-main" : ""}`}
        role="main"
        tabIndex={-1}
      >
        {isPublicRoute ? (
          children
        ) : (
          <div className="container container--app app-workspace">
            <aside className="app-sidebar" aria-label="Módulos de la plataforma">
              <div className="app-sidebar__summary">
                <p className="eyebrow">Plataforma administrativa</p>
                <strong>{sesion?.nombre ?? "Sesión activa"}</strong>
                <span>{sesion?.rol ?? "Sin rol"}</span>
                <small>{sesion?.ipsId ?? "Sin institución asignada"}</small>
              </div>
              <nav className="app-sidebar__nav">
                {NAV_ITEMS.map((section) => {
                  const visibleItems = section.items.filter((item) =>
                    item.capability ? sesionTieneCapacidad(sesion, item.capability) : true
                  );
                  if (!visibleItems.length) return null;
                  return (
                    <Fragment key={section.title}>
                      <p className="app-sidebar__heading">{section.title}</p>
                      {visibleItems.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) =>
                            `app-sidebar__link${isActive ? " app-sidebar__link--active" : ""}`
                          }
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </Fragment>
                  );
                })}
              </nav>
              <div className="app-sidebar__footer">
                <Link to="/" className="btn btn--ghost btn--block">
                  Ir a inicio institucional
                </Link>
                <button type="button" className="btn btn--primary btn--block" onClick={onCerrarSesion}>
                  Cerrar sesión
                </button>
              </div>
            </aside>
            <section className="app-content">
              {children}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
