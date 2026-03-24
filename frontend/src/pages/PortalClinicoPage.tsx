import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSesion } from "@/shared/auth/SessionContext";
import {
  actualizarUsuarioIps,
  consultarDocumentoEpisodio,
  consultarIntegridadEpisodio,
  consultarTrazabilidadEpisodio,
  crearUsuarioIps,
  listarPermisosDocumento,
  listarRolesSistema,
  listarUsuariosIps,
  obtenerCapacidadesActor,
  otorgarPermisoDocumento,
  revocarPermisoDocumento,
  type RolSistema,
  type UsuarioIps
} from "@/shared/services/api";
import { conectarWallet, asegurarCadenaSepolia, enviarTrazaBlockchain } from "@/shared/services/blockchain";

export function PortalClinicoPage() {
  const { sesion } = useSesion();
  const [roles, setRoles] = useState<RolSistema[]>([]);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioIps[]>([]);
  const [episodeIdDoc, setEpisodeIdDoc] = useState("");
  const [docInfo, setDocInfo] = useState<Awaited<ReturnType<typeof consultarDocumentoEpisodio>>["data"]>();
  const [docPerms, setDocPerms] = useState<string[]>([]);
  const [traceInfo, setTraceInfo] = useState<Awaited<ReturnType<typeof consultarTrazabilidadEpisodio>>["data"]>();
  const [integrityInfo, setIntegrityInfo] = useState<Awaited<ReturnType<typeof consultarIntegridadEpisodio>>["data"]>();
  const [targetIps, setTargetIps] = useState("IPS-002");
  const [blockchainFeedback, setBlockchainFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"info" | "error" | "success">("info");
  const [permisosHint, setPermisosHint] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    usuarioId: "",
    nombre: "",
    rol: "profesional_salud"
  });

  const canManageUsers = capabilities.includes("ips.usuarios.gestionar");
  const canManagePermissions = capabilities.includes("ips.permisos.gestionar");
  const canViewDocuments = capabilities.includes("episodios.documento.ver");
  const ultimoEventoTraza = traceInfo?.traceEvents[traceInfo.traceEvents.length - 1];

  const refreshAccess = async () => {
    const [rolesRes, capsRes, usersRes] = await Promise.all([
      listarRolesSistema(sesion),
      obtenerCapacidadesActor(sesion),
      listarUsuariosIps(sesion)
    ]);
    setRoles(rolesRes);
    setCapabilities(capsRes);
    setUsuarios(usersRes);
  };

  useEffect(() => {
    let active = true;

    const loadAccess = async () => {
      const [rolesRes, capsRes, usersRes] = await Promise.all([
        listarRolesSistema(sesion),
        obtenerCapacidadesActor(sesion),
        listarUsuariosIps(sesion)
      ]);

      if (!active) return;
      setRoles(rolesRes);
      setCapabilities(capsRes);
      setUsuarios(usersRes);
    };

    void loadAccess();
    return () => {
      active = false;
    };
  }, [sesion]);

  const cargarResumenEpisodio = async (episodeId: string) => {
    const [docRes, perms, traceRes, integrityRes] = await Promise.all([
      consultarDocumentoEpisodio(episodeId, sesion),
      listarPermisosDocumento(episodeId, sesion),
      consultarTrazabilidadEpisodio(episodeId, sesion),
      consultarIntegridadEpisodio(episodeId, sesion)
    ]);
    setDocInfo(docRes.data);
    setDocPerms(perms);
    setTraceInfo(traceRes.data);
    setIntegrityInfo(integrityRes.data);

    const feedback = [docRes.ok ? null : docRes.message, traceRes.ok ? null : traceRes.message, integrityRes.ok ? null : integrityRes.message]
      .filter(Boolean)
      .join(" ");
    if (feedback) {
      setMessage(feedback);
      setMessageKind("error");
    }
  };

  const onCrearUsuario = async () => {
    if (!canManageUsers) return;
    const result = await crearUsuarioIps(newUser, sesion);
    setMessage(result.message);
    setMessageKind(result.ok ? "success" : "error");
    if (result.ok) {
      setNewUser({ usuarioId: "", nombre: "", rol: "profesional_salud" });
      await refreshAccess();
    }
  };

  const onToggleActivo = async (user: UsuarioIps) => {
    if (!canManageUsers) return;
    const result = await actualizarUsuarioIps(user.usuarioId, { activo: !user.activo }, sesion);
    setMessage(result.message);
    setMessageKind(result.ok ? "success" : "error");
    await refreshAccess();
  };

  const onConsultarDocumento = async () => {
    if (!canViewDocuments) return;
    const id = episodeIdDoc.trim();
    if (!id) {
      setMessage("Ingrese un ID de episodio para consultar continuidad e integridad.");
      setMessageKind("error");
      return;
    }
    setPermisosHint(null);
    await cargarResumenEpisodio(id);
  };

  const onGrant = async () => {
    if (!canManagePermissions) return;
    const id = episodeIdDoc.trim();
    if (!id) {
      setPermisosHint(null);
      setMessage(
        "Indique el ID del episodio en el campo de abajo (o en «Consultar episodio») antes de otorgar permiso."
      );
      setMessageKind("error");
      return;
    }
    const result = await otorgarPermisoDocumento(id, targetIps.trim(), sesion);
    const texto = result.traceEvent
      ? `${result.message} Evidencia: ${result.traceEvent.evidence.transactionHash}`
      : result.message;
    setMessage(texto);
    setMessageKind(result.ok ? "success" : "error");
    setPermisosHint(result.ok ? `Permiso aplicado al episodio ${id}.` : null);
    if (canViewDocuments) {
      await cargarResumenEpisodio(id);
    } else {
      const perms = await listarPermisosDocumento(id, sesion);
      setDocPerms(perms);
    }
  };

  const onRevoke = async () => {
    if (!canManagePermissions) return;
    const id = episodeIdDoc.trim();
    if (!id) {
      setPermisosHint(null);
      setMessage(
        "Indique el ID del episodio en el campo de abajo (o en «Consultar episodio») antes de revocar permiso."
      );
      setMessageKind("error");
      return;
    }
    const result = await revocarPermisoDocumento(id, targetIps.trim(), sesion);
    const texto = result.traceEvent
      ? `${result.message} Evidencia: ${result.traceEvent.evidence.transactionHash}`
      : result.message;
    setMessage(texto);
    setMessageKind(result.ok ? "success" : "error");
    setPermisosHint(result.ok ? `Permiso revocado en el episodio ${id}.` : null);
    if (canViewDocuments) {
      await cargarResumenEpisodio(id);
    } else {
      const perms = await listarPermisosDocumento(id, sesion);
      setDocPerms(perms);
    }
  };

  const onBlockchainTrace = async (action: string) => {
    const wallet = await conectarWallet();
    if (!wallet.ok) {
      setBlockchainFeedback({ kind: "error", message: wallet.message ?? "No se pudo conectar la wallet." });
      return;
    }
    const chain = await asegurarCadenaSepolia();
    if (!chain.ok) {
      setBlockchainFeedback({ kind: "error", message: chain.message ?? "La wallet no está en la red correcta." });
      return;
    }
    const tx = await enviarTrazaBlockchain({
      action,
      episodeId: episodeIdDoc.trim() || undefined,
      actorRole: sesion?.rol,
      ipsId: sesion?.ipsId,
      payload: { source: "portal-clinico-rediseñado" }
    });
    if (!tx.ok) {
      setBlockchainFeedback({ kind: "error", message: tx.message ?? "No fue posible enviar la transacción." });
      return;
    }
    setBlockchainFeedback({
      kind: "success",
      message: tx.explorerUrl ? `Transacción enviada: ${tx.explorerUrl}` : `Transacción enviada: ${tx.txHash}`
    });
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header__row">
          <div>
            <h1 className="page-title">Bienvenido, {sesion?.nombre}</h1>
            <p className="page-subtitle">
              Panel de operaciones clínicas y administrativas de su sesión activa.
            </p>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-card__value">{capabilities.length}</span>
          <span className="stat-card__label">Capacidades</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{usuarios.length}</span>
          <span className="stat-card__label">Usuarios IPS</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{roles.length}</span>
          <span className="stat-card__label">Roles sistema</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{sesion?.ipsId ?? "—"}</span>
          <span className="stat-card__label">Institución</span>
        </div>
      </div>

      {message && (
        <div
          className={`alert ${
            messageKind === "success"
              ? "alert--success"
              : messageKind === "error"
                ? "alert--error"
                : "alert--info"
          }`}
          style={{ marginBottom: 16 }}
        >
          {message}
        </div>
      )}
      {blockchainFeedback && <div className={`alert ${blockchainFeedback.kind === "success" ? "alert--success" : "alert--error"}`} style={{ marginBottom: 16 }}>{blockchainFeedback.message}</div>}

      <div className="dashboard-grid dashboard-grid--wide">
        <section className="card card--elevated">
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Resumen de acceso</h2>
              <p className="section-copy">Perfil reconocido por la plataforma.</p>
            </div>
          </div>
          <div className="stack-list">
            <div className="stack-item">
              <strong>Perfil</strong>
              <span>{sesion?.rol ?? "—"}</span>
            </div>
            <div className="stack-item">
              <strong>Institución</strong>
              <span>{sesion?.ipsId ?? "—"}</span>
            </div>
            <div className="stack-item">
              <strong>Capacidades activas</strong>
              <small>{capabilities.join(" · ") || "No hay capacidades disponibles"}</small>
            </div>
          </div>
        </section>

        {canViewDocuments && (
          <section className="card card--elevated">
            <div className="section-head section-head--tight">
              <div>
                <h2 className="section-title">Consultar episodio</h2>
                <p className="section-copy">Revisar documento, integridad y permisos vigentes.</p>
              </div>
            </div>
            <div className="search-layout">
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">ID del episodio</label>
                <input
                  className="form-input"
                  value={episodeIdDoc}
                  onChange={(e) => setEpisodeIdDoc(e.target.value)}
                  placeholder="Pegue aquí el ID del episodio"
                />
              </div>
              <div className="btn-group">
                <button className="btn btn--primary" onClick={onConsultarDocumento}>Consultar</button>
                <Link to="/episodios/trazabilidad" className="btn btn--ghost">Vista completa</Link>
              </div>
            </div>
            {docInfo && (
              <div className="result-panel" style={{ marginTop: 12 }}>
                <div>
                  <strong>Documento</strong>
                  <code>{docInfo.hash}</code>
                </div>
                <div>
                  <strong>IPS autorizadas</strong>
                  <span>{docPerms.join(", ") || "Solo IPS propietaria"}</span>
                </div>
                <div>
                  <strong>Integridad</strong>
                  <span>{integrityInfo?.isIntegrityValid ? "Íntegra" : "Pendiente / inconsistente"}</span>
                </div>
              </div>
            )}
          </section>
        )}

        {canManagePermissions && (
          <section className="card card--elevated">
            <div className="section-head section-head--tight">
              <div>
                <h2 className="section-title">Compartir acceso</h2>
                <p className="section-copy">
                  Otorgue o revoque acceso a otra IPS sobre un episodio concreto. Debe usar el mismo
                  ID que aparece al crear el episodio (UUID).
                </p>
              </div>
            </div>
            {!canViewDocuments ? (
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label form-label--required">ID del episodio</label>
                <input
                  className="form-input"
                  value={episodeIdDoc}
                  onChange={(e) => setEpisodeIdDoc(e.target.value)}
                  placeholder="Pegue el UUID del episodio"
                />
              </div>
            ) : (
              <p className="form-hint" style={{ marginBottom: 12 }}>
                Use el <strong>ID del episodio</strong> del recuadro «Consultar episodio» de arriba (o
                péguelo allí primero y pulse <strong>Consultar</strong> para ver permisos actuales).
              </p>
            )}
            <div className="search-layout">
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">IPS receptora</label>
                <input
                  className="form-input"
                  value={targetIps}
                  onChange={(e) => setTargetIps(e.target.value)}
                  placeholder="Ej. IPS-002"
                />
              </div>
              <div className="btn-group">
                <button type="button" className="btn btn--primary" onClick={onGrant}>Otorgar</button>
                <button type="button" className="btn btn--ghost" onClick={onRevoke}>Revocar</button>
              </div>
            </div>
            {permisosHint && (
              <p className="section-copy" style={{ marginTop: 8, color: "var(--success)" }}>
                {permisosHint}
              </p>
            )}
            <p className="section-copy" style={{ marginTop: 8, marginBottom: 0 }}>
              <strong>IPS con acceso activo al episodio:</strong>{" "}
              {docPerms.length ? docPerms.join(", ") : "Ninguna aún (solo la propietaria hasta otorgar)"}
            </p>
            <p className="form-hint" style={{ marginTop: 6 }}>
              Requisitos: blockchain real configurada en el backend; como admin de la IPS que creó el
              episodio (o super administrador). No otorgue permiso a la misma IPS propietaria.
            </p>
          </section>
        )}

        {canManageUsers && (
          <section className="card card--elevated">
            <div className="section-head section-head--tight">
              <div>
                <h2 className="section-title">Usuarios de la IPS</h2>
                <p className="section-copy">Active o desactive usuarios de su institución.</p>
              </div>
            </div>
            <div className="form-columns">
              <div className="form-group">
                <label className="form-label">Usuario ID</label>
                <input
                  className="form-input"
                  value={newUser.usuarioId}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, usuarioId: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input
                  className="form-input"
                  value={newUser.nombre}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, nombre: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Rol</label>
                <select
                  className="form-input"
                  value={newUser.rol}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, rol: e.target.value }))}
                >
                  <option value="profesional_salud">Profesional de salud</option>
                  <option value="admin_ips">Administrador IPS</option>
                  <option value="paciente">Paciente</option>
                  <option value="auditor">Auditor</option>
                </select>
              </div>
            </div>
            <div className="btn-group" style={{ marginBottom: 12 }}>
              <button className="btn btn--primary" type="button" onClick={onCrearUsuario}>Crear usuario</button>
            </div>
            <div className="table-wrapper">
              <table className="tabla-clinica">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((user) => (
                    <tr key={user.usuarioId}>
                      <td>{user.usuarioId}</td>
                      <td>{user.correo ?? "—"}</td>
                      <td>{user.rol}</td>
                      <td>
                        <span className={`status-chip${user.activo ? " status-chip--ready" : " status-chip--alert"}`}>
                          {user.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn--ghost btn--sm" onClick={() => onToggleActivo(user)}>
                          {user.activo ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="card card--elevated">
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Estado del episodio</h2>
              <p className="section-copy">Integridad, versiones y último evento trazado.</p>
            </div>
          </div>
          {!traceInfo ? (
            <p className="empty-state">Consulte un episodio para ver su continuidad clínica.</p>
          ) : (
            <div className="stack-list">
              <div className="stack-item">
                <strong>Evento clínico</strong>
                <span>{traceInfo.event.eventoUrgenciasId}</span>
              </div>
              <div className="stack-item">
                <strong>Versiones</strong>
                <span>{traceInfo.versiones.length}</span>
              </div>
              <div className="stack-item">
                <strong>Último evento blockchain</strong>
                <small>{ultimoEventoTraza?.eventType ?? "—"}</small>
              </div>
              <div className="stack-item">
                <strong>Modo evidencia</strong>
                <small>{ultimoEventoTraza?.evidence.ledgerMode ?? "—"}</small>
              </div>
            </div>
          )}
        </section>

        <section className="card card--elevated">
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Roles del sistema</h2>
              <p className="section-copy">Permisos funcionales disponibles en la plataforma.</p>
            </div>
          </div>
          <div className="stack-list">
            {roles.map((item) => (
              <div key={item.rol} className="stack-item">
                <strong>{item.rol}</strong>
                <small>{item.capacidades.join(" · ")}</small>
              </div>
            ))}
          </div>
        </section>

        {sesion?.rol === "auditor" && (
          <section className="card card--elevated">
            <div className="section-head section-head--tight">
              <div>
                <h2 className="section-title">Evaluación</h2>
                <p className="section-copy">Dashboard de interoperabilidad, integridad y documentación.</p>
              </div>
            </div>
            <Link to="/auditoria/evaluacion" className="btn btn--primary">
              Abrir evaluación
            </Link>
          </section>
        )}

        {(sesion?.rol === "admin_ips" || sesion?.rol === "auditor") && (
          <section className="card card--elevated">
            <div className="section-head section-head--tight">
              <div>
                <h2 className="section-title">Registro con wallet</h2>
                <p className="section-copy">Transacción directa en Sepolia para validación manual.</p>
              </div>
            </div>
            <div className="btn-group">
              <button className="btn btn--primary" onClick={() => onBlockchainTrace("DOCUMENT_ACCESS")}>
                Registrar acceso
              </button>
              <button className="btn btn--ghost" onClick={() => onBlockchainTrace("PERMISSION_CHANGE")}>
                Registrar permiso
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
