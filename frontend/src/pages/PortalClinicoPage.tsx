import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSesion } from "@/shared/auth/SessionContext";
import {
  actualizarUsuarioIps,
  crearUsuarioIps,
  listarPermisosDocumento,
  listarRolesSistema,
  listarUsuariosIps,
  obtenerCapacidadesActor,
  obtenerDocumentoEpisodio,
  obtenerTrazabilidadEpisodio,
  otorgarPermisoDocumento,
  revocarPermisoDocumento,
  verificarIntegridadEpisodio,
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
  const [docInfo, setDocInfo] = useState<Awaited<ReturnType<typeof obtenerDocumentoEpisodio>>>(null);
  const [docPerms, setDocPerms] = useState<string[]>([]);
  const [traceInfo, setTraceInfo] = useState<Awaited<ReturnType<typeof obtenerTrazabilidadEpisodio>>>(null);
  const [integrityInfo, setIntegrityInfo] = useState<Awaited<ReturnType<typeof verificarIntegridadEpisodio>>>(null);
  const [targetIps, setTargetIps] = useState("IPS-002");
  const [blockchainMsg, setBlockchainMsg] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
    const [doc, perms, trace, integrity] = await Promise.all([
      obtenerDocumentoEpisodio(episodeId, sesion),
      listarPermisosDocumento(episodeId, sesion),
      obtenerTrazabilidadEpisodio(episodeId, sesion),
      verificarIntegridadEpisodio(episodeId, sesion)
    ]);
    setDocInfo(doc);
    setDocPerms(perms);
    setTraceInfo(trace);
    setIntegrityInfo(integrity);
  };

  const onCrearUsuario = async () => {
    if (!canManageUsers) return;
    const result = await crearUsuarioIps(newUser, sesion);
    setMessage(result.message);
    if (result.ok) {
      setNewUser({ usuarioId: "", nombre: "", rol: "profesional_salud" });
      await refreshAccess();
    }
  };

  const onToggleActivo = async (user: UsuarioIps) => {
    if (!canManageUsers) return;
    const result = await actualizarUsuarioIps(user.usuarioId, { activo: !user.activo }, sesion);
    setMessage(result.message);
    await refreshAccess();
  };

  const onConsultarDocumento = async () => {
    if (!canViewDocuments) return;
    const id = episodeIdDoc.trim();
    if (!id) {
      setMessage("Ingrese un ID de episodio para consultar continuidad e integridad.");
      return;
    }
    await cargarResumenEpisodio(id);
  };

  const onGrant = async () => {
    if (!canManagePermissions) return;
    const id = episodeIdDoc.trim();
    if (!id) return;
    const result = await otorgarPermisoDocumento(id, targetIps.trim(), sesion);
    setMessage(
      result.traceEvent
        ? `${result.message} Evidencia: ${result.traceEvent.evidence.transactionHash}`
        : result.message
    );
    await cargarResumenEpisodio(id);
  };

  const onRevoke = async () => {
    if (!canManagePermissions) return;
    const id = episodeIdDoc.trim();
    if (!id) return;
    const result = await revocarPermisoDocumento(id, targetIps.trim(), sesion);
    setMessage(
      result.traceEvent
        ? `${result.message} Evidencia: ${result.traceEvent.evidence.transactionHash}`
        : result.message
    );
    await cargarResumenEpisodio(id);
  };

  const onBlockchainTrace = async (action: string) => {
    const wallet = await conectarWallet();
    if (!wallet.ok) {
      setBlockchainMsg(wallet.message ?? "No se pudo conectar la wallet.");
      return;
    }
    const chain = await asegurarCadenaSepolia();
    if (!chain.ok) {
      setBlockchainMsg(chain.message ?? "La wallet no está en la red correcta.");
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
      setBlockchainMsg(tx.message ?? "No fue posible enviar la transacción.");
      return;
    }
    setBlockchainMsg(`Transacción enviada: ${tx.txHash}`);
  };

  return (
    <div className="container">
      <section className="page-banner">
        <div>
          <p className="eyebrow">Mi jornada</p>
          <h1 className="page-title">Hola, {sesion?.nombre}</h1>
          <p className="page-subtitle">
            Desde aquí puede resolver las tareas más comunes de su rol: revisar continuidad
            del episodio, compartir acceso entre IPS y validar la evidencia del caso.
          </p>
        </div>
        <div className="context-note">
          <strong>{sesion?.rol ?? "Sin sesión"}</strong>
          <span>{sesion?.ipsId ?? "Sin IPS"}</span>
          <small>{capabilities.length} capacidades activas</small>
        </div>
      </section>

      {message && <div className="alert alert--info" style={{ marginBottom: "1rem" }}>{message}</div>}
      {blockchainMsg && <div className="alert alert--success" style={{ marginBottom: "1rem" }}>{blockchainMsg}</div>}

      <div className="dashboard-grid dashboard-grid--wide">
        <section className="card card--elevated">
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Resumen de acceso</h2>
              <p className="section-copy">Así reconoce la plataforma su perfil actual.</p>
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
                <h2 className="section-title">Consultar continuidad del episodio</h2>
                <p className="section-copy">
                  Ingrese un episodio para revisar documento, integridad y permisos vigentes.
                </p>
              </div>
            </div>
            <div className="search-layout">
              <div className="form-group">
                <label className="form-label">ID del episodio</label>
                <input
                  className="form-input"
                  value={episodeIdDoc}
                  onChange={(e) => setEpisodeIdDoc(e.target.value)}
                  placeholder="Pegue aquí el ID del episodio"
                />
              </div>
              <div className="btn-group">
                <button className="btn btn--primary" onClick={onConsultarDocumento}>
                  Consultar episodio
                </button>
                <Link to="/episodios/trazabilidad" className="btn btn--secondary">
                  Vista completa
                </Link>
              </div>
            </div>
            {docInfo && (
              <div className="result-panel" style={{ marginTop: "1rem" }}>
                <div>
                  <strong>Documento disponible</strong>
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
                <h2 className="section-title">Compartir acceso con otra IPS</h2>
                <p className="section-copy">
                  Otorgue o revoque acceso solo cuando la continuidad asistencial lo requiera.
                </p>
              </div>
            </div>
            <div className="search-layout">
              <div className="form-group">
                <label className="form-label">IPS receptora</label>
                <input
                  className="form-input"
                  value={targetIps}
                  onChange={(e) => setTargetIps(e.target.value)}
                  placeholder="Ej. IPS-002"
                />
              </div>
              <div className="btn-group">
                <button className="btn btn--primary" onClick={onGrant}>
                  Otorgar acceso
                </button>
                <button className="btn btn--secondary" onClick={onRevoke}>
                  Revocar acceso
                </button>
              </div>
            </div>
            <p className="section-copy" style={{ marginBottom: 0 }}>
              Estado actual: {docPerms.join(", ") || "Sin IPS adicionales autorizadas"}
            </p>
          </section>
        )}

        {canManageUsers && (
          <section className="card card--elevated">
            <div className="section-head section-head--tight">
              <div>
                <h2 className="section-title">Gestión de usuarios de la IPS</h2>
                <p className="section-copy">Active o desactive usuarios de su institución sin afectar la trazabilidad.</p>
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
            <div className="btn-group" style={{ marginBottom: "1rem" }}>
              <button className="btn btn--primary" type="button" onClick={onCrearUsuario}>
                Crear usuario
              </button>
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
                      <td>{user.activo ? "Activo" : "Inactivo"}</td>
                      <td>
                        <button className="btn btn--ghost" onClick={() => onToggleActivo(user)}>
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
              <h2 className="section-title">Qué está pasando con este episodio</h2>
              <p className="section-copy">Resumen rápido de integridad, versiones y último evento trazado.</p>
            </div>
          </div>
          {!traceInfo ? (
            <p className="empty-state">Consulte un episodio para ver su continuidad clínica.</p>
          ) : (
            <div className="stack-list">
              <div className="stack-item">
                <strong>Evento clínico asociado</strong>
                <span>{traceInfo.event.eventoUrgenciasId}</span>
              </div>
              <div className="stack-item">
                <strong>Versiones registradas</strong>
                <span>{traceInfo.versiones.length}</span>
              </div>
              <div className="stack-item">
                <strong>Último evento blockchain</strong>
                <small>{ultimoEventoTraza?.eventType ?? "—"}</small>
              </div>
              <div className="stack-item">
                <strong>Modo de evidencia</strong>
                <small>{ultimoEventoTraza?.evidence.ledgerMode ?? "—"}</small>
              </div>
            </div>
          )}
        </section>

        <section className="card card--elevated">
          <div className="section-head section-head--tight">
            <div>
              <h2 className="section-title">Roles del sistema</h2>
              <p className="section-copy">Referencia rápida de los permisos funcionales disponibles en la plataforma.</p>
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

        {(sesion?.rol === "admin_ips" || sesion?.rol === "auditor") && (
          <section className="card card--elevated">
            <div className="section-head section-head--tight">
              <div>
                <h2 className="section-title">Registro directo con wallet</h2>
                <p className="section-copy">
                  Si necesita contrastar el flujo del backend con una acción manual desde wallet,
                  puede registrar una transacción directa en Sepolia.
                </p>
              </div>
            </div>
            <div className="btn-group">
              <button className="btn btn--primary" onClick={() => onBlockchainTrace("DOCUMENT_ACCESS")}>
                Registrar acceso
              </button>
              <button className="btn btn--secondary" onClick={() => onBlockchainTrace("PERMISSION_CHANGE")}>
                Registrar cambio de permiso
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
