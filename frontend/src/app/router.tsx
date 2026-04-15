import { Routes, Route, Navigate, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useSesion } from "@/shared/auth/SessionContext";
import { sesionTieneCapacidad } from "@/shared/auth/capabilities";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { PacientesPage } from "../pages/PacientesPage";
import { EpisodiosPage } from "../pages/EpisodiosPage";
import { CrearEpisodioPage } from "../pages/CrearEpisodioPage";
import { ActualizarEpisodioPage } from "../pages/ActualizarEpisodioPage";
import { VerEpisodioPage } from "../pages/VerEpisodioPage";
import { TrazabilidadEpisodioPage } from "../pages/TrazabilidadEpisodioPage";
import { InfraestructuraPage } from "../pages/InfraestructuraPage";
import { PortalClinicoPage } from "../pages/PortalClinicoPage";
import { EvaluacionPrototipoPage } from "../pages/EvaluacionPrototipoPage";
import { AuditoriaDashboardPage } from "../pages/AuditoriaDashboardPage";
import { GestionIpsPage } from "../pages/GestionIpsPage";
import { GestionUsuariosPage } from "../pages/GestionUsuariosPage";
// DEMO — solo se usa cuando VITE_DEMO_MODE=true; eliminar import + ruta para quitar el panel
import { DemoPage } from "@/demo/DemoPage";

function RequireSession({ children }: { children: JSX.Element }) {
  const { sesion } = useSesion();
  if (!sesion) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RequireCapability({
  capability,
  children
}: {
  capability: string;
  children: JSX.Element;
}) {
  const { sesion } = useSesion();
  if (!sesion) {
    return <Navigate to="/login" replace />;
  }
  if (!sesionTieneCapacidad(sesion, capability)) {
    return (
      <div className="container">
        <div className="card card--elevated">
          <h1 className="page-title">Acceso restringido</h1>
          <p className="page-subtitle">
            Su rol autenticado no tiene permisos para acceder a esta funcionalidad.
          </p>
          <Link to="/portal" className="btn btn--secondary">
            Volver al portal
          </Link>
        </div>
      </div>
    );
  }
  return children;
}

export function AppRouter() {
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/portal" element={<RequireSession><PortalClinicoPage /></RequireSession>} />
        <Route
          path="/pacientes"
          element={
            <RequireCapability capability="episodios.consultar">
              <PacientesPage />
            </RequireCapability>
          }
        />
        <Route
          path="/episodios"
          element={
            <RequireCapability capability="episodios.consultar">
              <EpisodiosPage />
            </RequireCapability>
          }
        />
        <Route
          path="/episodios/crear"
          element={
            <RequireCapability capability="episodios.crear">
              <CrearEpisodioPage />
            </RequireCapability>
          }
        />
        <Route
          path="/episodios/actualizar"
          element={
            <RequireCapability capability="episodios.actualizar">
              <ActualizarEpisodioPage />
            </RequireCapability>
          }
        />
        <Route
          path="/episodios/ver/:id"
          element={
            <RequireCapability capability="episodios.documento.ver">
              <VerEpisodioPage />
            </RequireCapability>
          }
        />
        <Route
          path="/episodios/trazabilidad"
          element={
            <RequireCapability capability="trazabilidad.consultar">
              <TrazabilidadEpisodioPage />
            </RequireCapability>
          }
        />
        <Route
          path="/auditoria/evaluacion"
          element={
            <RequireCapability capability="evaluacion.consultar">
              <EvaluacionPrototipoPage />
            </RequireCapability>
          }
        />
        <Route
          path="/auditoria/metricas"
          element={
            <RequireCapability capability="evaluacion.consultar">
              <AuditoriaDashboardPage />
            </RequireCapability>
          }
        />
        <Route
          path="/gestion/ips"
          element={
            <RequireCapability capability="ips.crear">
              <GestionIpsPage />
            </RequireCapability>
          }
        />
        <Route
          path="/gestion/usuarios"
          element={
            <RequireCapability capability="ips.usuarios.gestionar">
              <GestionUsuariosPage />
            </RequireCapability>
          }
        />
        <Route path="/infraestructura" element={<RequireSession><InfraestructuraPage /></RequireSession>} />
        {import.meta.env.VITE_DEMO_MODE === "true" && (
          <Route path="/demo" element={<DemoPage />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
