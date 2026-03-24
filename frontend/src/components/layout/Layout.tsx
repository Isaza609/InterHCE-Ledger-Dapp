import { Link, NavLink, useLocation } from "react-router-dom";
import { Fragment, useState, type ReactNode } from "react";
import { useSesion } from "@/shared/auth/SessionContext";
import { cerrarSesionDapp } from "@/shared/services/api";
import { sesionTieneCapacidad } from "@/shared/auth/capabilities";

interface LayoutProps {
  children: ReactNode;
}

interface SidebarNavItem {
  to: string;
  label: string;
  icon: string;
  capability?: string;
}

interface SidebarNavSection {
  title: string;
  items: SidebarNavItem[];
}

const NAV_ITEMS: SidebarNavSection[] = [
  {
    title: "Principal",
    items: [
      { to: "/portal", label: "Panel de inicio", icon: "⊞" }
    ]
  },
  {
    title: "Gestión clínica",
    items: [
      { to: "/pacientes", label: "Pacientes", icon: "👤", capability: "episodios.consultar" },
      { to: "/episodios", label: "Episodios", icon: "📋", capability: "episodios.consultar" },
      { to: "/episodios/crear", label: "Nuevo episodio", icon: "＋", capability: "episodios.crear" },
      { to: "/episodios/actualizar", label: "Actualizar", icon: "✎", capability: "episodios.actualizar" }
    ]
  },
  {
    title: "Administración",
    items: [
      { to: "/gestion/ips", label: "Gestión IPS", icon: "🏥", capability: "ips.crear" },
      { to: "/gestion/usuarios", label: "Usuarios", icon: "👥", capability: "ips.usuarios.gestionar" }
    ]
  },
  {
    title: "Auditoría",
    items: [
      { to: "/episodios/trazabilidad", label: "Trazabilidad", icon: "⛓", capability: "trazabilidad.consultar" },
      { to: "/auditoria/evaluacion", label: "Evaluación", icon: "📊", capability: "evaluacion.consultar" },
      { to: "/infraestructura", label: "Infraestructura", icon: "⚙", capability: "ips.usuarios.gestionar" }
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  if (isPublicRoute) {
    return (
      <div className="app-shell app-shell--public">
        <a href="#main-content" className="skip-link">Saltar al contenido principal</a>
        <header className="public-header" role="banner">
          <div className="container public-header__row">
            <Link to="/" className="app-brand" aria-label="InterHCE Clínica - Inicio">
              <span className="app-brand__icon">✚</span>
              <span className="app-brand__text">
                <strong>InterHCE</strong>
                <small>Interoperabilidad clínica</small>
              </span>
            </Link>
            <nav className="public-nav" aria-label="Navegación institucional">
              {PUBLIC_NAV_ITEMS.map((item) => (
                <a key={item.target} href={getPublicHref(item.target)} className="public-nav__link">
                  {item.label}
                </a>
              ))}
              {sesion ? (
                <>
                  <Link to="/portal" className="public-nav__link public-nav__link--cta">
                    Ir al panel
                  </Link>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={onCerrarSesion}>
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
          </div>
        </header>
        <main id="main-content" className="public-main" role="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>

      <aside className={`sidebar${sidebarCollapsed ? " sidebar--collapsed" : ""}`}>
        <div className="sidebar__header">
          <Link to="/portal" className="sidebar__brand">
            <span className="sidebar__brand-icon">✚</span>
            {!sidebarCollapsed && (
              <span className="sidebar__brand-text">
                <strong>InterHCE</strong>
                <small>Plataforma clínica</small>
              </span>
            )}
          </Link>
          <button
            type="button"
            className="sidebar__toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        <nav className="sidebar__nav">
          {NAV_ITEMS.map((section) => {
            const visibleItems = section.items.filter((item) =>
              item.capability ? sesionTieneCapacidad(sesion, item.capability) : true
            );
            if (!visibleItems.length) return null;
            return (
              <Fragment key={section.title}>
                {!sidebarCollapsed && (
                  <p className="sidebar__section-title">{section.title}</p>
                )}
                {sidebarCollapsed && <div className="sidebar__divider" />}
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `sidebar__link${isActive ? " sidebar__link--active" : ""}`
                    }
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <span className="sidebar__link-icon">{item.icon}</span>
                    {!sidebarCollapsed && <span className="sidebar__link-label">{item.label}</span>}
                  </NavLink>
                ))}
              </Fragment>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          {!sidebarCollapsed && sesion && (
            <div className="sidebar__user">
              <div className="sidebar__user-avatar">
                {sesion.nombre?.charAt(0).toUpperCase() ?? "U"}
              </div>
              <div className="sidebar__user-info">
                <strong>{sesion.nombre}</strong>
                <small>{sesion.rol} · {sesion.ipsId ?? "Sin IPS"}</small>
              </div>
            </div>
          )}
          {sidebarCollapsed && sesion && (
            <div className="sidebar__user-avatar sidebar__user-avatar--center" title={sesion.nombre}>
              {sesion.nombre?.charAt(0).toUpperCase() ?? "U"}
            </div>
          )}
          <button
            type="button"
            className={`sidebar__logout${sidebarCollapsed ? " sidebar__logout--icon" : ""}`}
            onClick={onCerrarSesion}
            title="Cerrar sesión"
          >
            {sidebarCollapsed ? "⏻" : "Cerrar sesión"}
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="topbar">
          <div className="topbar__left">
            <button
              type="button"
              className="topbar__menu-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label="Alternar menú"
            >
              ☰
            </button>
          </div>
          <div className="topbar__right">
            {sesion && (
              <div className="topbar__session">
                <span className="topbar__role-badge">{sesion.rol}</span>
                <span className="topbar__user-name">{sesion.nombre}</span>
                {sesion.ipsId && <span className="topbar__ips">{sesion.ipsId}</span>}
              </div>
            )}
          </div>
        </header>

        <main id="main-content" className="admin-content" role="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
