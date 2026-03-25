import { useEffect, useState } from "react";
import { useSesion } from "@/shared/auth/SessionContext";
import {
  listarUsuariosIps,
  listarUsuariosPorIpsId,
  crearUsuarioIps,
  actualizarUsuarioIps,
  resetearPasswordUsuario,
  listarIpsEntidades,
  obtenerRolesCreables,
  sincronizarPacientesDesdeEpisodios,
  type UsuarioIps,
  type IpsEntidad
} from "@/shared/services/api";

interface FormUsuario {
  usuarioId: string;
  nombre: string;
  correo: string;
  password: string;
  rol: string;
  documentoIdentidad: string;
  ipsId: string;
}

const FORM_VACIO: FormUsuario = {
  usuarioId: "",
  nombre: "",
  correo: "",
  password: "",
  rol: "",
  documentoIdentidad: "",
  ipsId: ""
};

const LABEL_ROL: Record<string, string> = {
  super_admin: "Super Administrador",
  admin_ips: "Administrador IPS",
  profesional_salud: "Profesional de salud",
  paciente: "Paciente",
  auditor: "Auditor"
};

export function GestionUsuariosPage() {
  const { sesion } = useSesion();
  const esSuperAdmin = sesion?.rol === "super_admin";

  const [usuarios, setUsuarios] = useState<UsuarioIps[]>([]);
  const [ipsList, setIpsList] = useState<IpsEntidad[]>([]);
  const [rolesCreables, setRolesCreables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormUsuario>(FORM_VACIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);
  const [filtroIps, setFiltroIps] = useState<string>(esSuperAdmin ? "" : (sesion?.ipsId ?? ""));
  const [sincronizandoPacientes, setSincronizandoPacientes] = useState(false);

  const cargarUsuarios = async () => {
    setLoading(true);
    let data: UsuarioIps[];
    if (esSuperAdmin && filtroIps) {
      data = await listarUsuariosPorIpsId(filtroIps, sesion);
    } else if (esSuperAdmin) {
      data = await listarUsuariosIps(sesion);
    } else {
      data = await listarUsuariosIps(sesion);
    }
    setUsuarios(data);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const [roles, ips] = await Promise.all([
        obtenerRolesCreables(sesion),
        esSuperAdmin ? listarIpsEntidades(sesion) : Promise.resolve([])
      ]);
      setRolesCreables(roles);
      setIpsList(ips);
      if (roles.length > 0) {
        setForm((prev) => ({ ...prev, rol: roles[0] }));
      }
    };
    init();
  }, []);

  useEffect(() => {
    cargarUsuarios();
  }, [filtroIps]);

  const limpiar = () => {
    setForm({
      ...FORM_VACIO,
      rol: rolesCreables[0] ?? "",
      ipsId: esSuperAdmin ? "" : (sesion?.ipsId ?? "")
    });
    setMostrarForm(false);
    setMensaje(null);
    setPasswordTemporal(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);
    setPasswordTemporal(null);

    const result = await crearUsuarioIps({
      usuarioId: form.usuarioId,
      nombre: form.nombre,
      correo: form.correo || undefined,
      password: form.password || undefined,
      rol: form.rol,
      documentoIdentidad: form.documentoIdentidad || undefined,
      ipsId: esSuperAdmin ? form.ipsId : undefined
    }, sesion);

    setMensaje({ tipo: result.ok ? "ok" : "error", texto: result.message });
    if (result.ok) {
      await cargarUsuarios();
      limpiar();
    }
  };

  const toggleActivo = async (user: UsuarioIps) => {
    const result = await actualizarUsuarioIps(user.usuarioId, { activo: !user.activo }, sesion);
    setMensaje({ tipo: result.ok ? "ok" : "error", texto: result.message });
    await cargarUsuarios();
  };

  const onSincronizarPacientesDesdeEpisodios = async () => {
    setSincronizandoPacientes(true);
    setMensaje(null);
    setPasswordTemporal(null);
    const body =
      esSuperAdmin && filtroIps.trim()
        ? { ipsId: filtroIps.trim() }
        : undefined;
    const result = await sincronizarPacientesDesdeEpisodios(sesion, body);
    setSincronizandoPacientes(false);
    setMensaje({ tipo: result.ok ? "ok" : "error", texto: result.message });
    if (result.ok) {
      await cargarUsuarios();
    }
  };

  const onResetPassword = async (user: UsuarioIps) => {
    const result = await resetearPasswordUsuario(user.usuarioId, undefined, sesion);
    if (result.ok && result.passwordTemporal) {
      setPasswordTemporal(result.passwordTemporal);
      setMensaje({
        tipo: "ok",
        texto: `Contraseña de ${user.nombre} reseteada. La contraseña temporal se muestra abajo.`
      });
    } else {
      setMensaje({ tipo: "error", texto: result.message });
    }
  };

  return (
    <div className="container">
      <div className="section-head">
        <div>
          <p className="eyebrow">
            {esSuperAdmin ? "Administración del sistema" : `IPS ${sesion?.ipsId ?? ""}`}
          </p>
          <h1 className="page-title">Gestión de usuarios</h1>
          <p className="page-subtitle">
            {esSuperAdmin
              ? "Administre usuarios de todas las IPS del sistema. Los pacientes nuevos se crean al registrar episodios; use «Sincronizar pacientes» para episodios antiguos sin usuario."
              : "Administre los usuarios de su institución. Puede sincronizar pacientes desde episodios ya creados en su IPS."}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => { setMensaje(null); cargarUsuarios(); }}
            disabled={loading}
          >
            {loading ? "Cargando..." : "↻ Actualizar"}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            title={
              esSuperAdmin && !filtroIps.trim()
                ? "Sincroniza todos los episodios del sistema"
                : "Sincroniza episodios de la IPS seleccionada o de la suya"
            }
            onClick={onSincronizarPacientesDesdeEpisodios}
            disabled={loading || sincronizandoPacientes}
          >
            {sincronizandoPacientes ? "Sincronizando…" : "Sincronizar pacientes (episodios)"}
          </button>
          {!mostrarForm && rolesCreables.length > 0 && (
            <button
              className="btn btn--primary"
              onClick={() => {
                setMostrarForm(true);
                setMensaje(null);
                setPasswordTemporal(null);
                setForm({
                  ...FORM_VACIO,
                  rol: rolesCreables[0],
                  ipsId: esSuperAdmin ? "" : (sesion?.ipsId ?? "")
                });
              }}
            >
              + Nuevo usuario
            </button>
          )}
        </div>
      </div>

      {mensaje && (
        <div className={`alert alert--${mensaje.tipo === "ok" ? "success" : "error"}`}>
          {mensaje.texto}
        </div>
      )}

      {passwordTemporal && (
        <div className="alert alert--info" style={{ marginTop: "0.5rem" }}>
          <strong>Contraseña temporal:</strong>{" "}
          <code style={{ fontSize: "0.95rem", background: "var(--bg-hover)", padding: "2px 8px", borderRadius: "4px" }}>
            {passwordTemporal}
          </code>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
            El usuario deberá cambiarla en su próximo ingreso.
          </p>
        </div>
      )}

      {esSuperAdmin && ipsList.length > 0 && (
        <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <label className="form-label" style={{ margin: 0 }}>Filtrar por IPS:</label>
          <select
            className="form-input"
            style={{ width: "auto", minWidth: "220px" }}
            value={filtroIps}
            onChange={(e) => setFiltroIps(e.target.value)}
          >
            <option value="">Todas las IPS</option>
            {ipsList.map((ips) => (
              <option key={ips.ipsId} value={ips.ipsId}>
                {ips.ipsId} — {ips.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      {mostrarForm && (
        <div className="card card--elevated" style={{ marginBottom: "1.5rem" }}>
          <h2 className="section-title">Crear nuevo usuario</h2>
          <form onSubmit={onSubmit} className="form-section form-section--stacked">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label form-label--required">ID de usuario</label>
                <input
                  className="form-input"
                  value={form.usuarioId}
                  onChange={(e) => setForm({ ...form, usuarioId: e.target.value })}
                  placeholder="Ej: profesional-003"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label form-label--required">Nombre completo</label>
                <input
                  className="form-input"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre del usuario"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Correo electrónico</label>
                <input
                  className="form-input"
                  type="email"
                  value={form.correo}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                  placeholder="usuario@institucion.com"
                />
                <span className="form-hint">Si se omite, se genera automáticamente.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input
                  className="form-input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Contraseña inicial"
                />
                <span className="form-hint">Si se omite, se asigna una temporal.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Documento de identidad</label>
                <input
                  className="form-input"
                  value={form.documentoIdentidad}
                  onChange={(e) => setForm({ ...form, documentoIdentidad: e.target.value })}
                  placeholder="Número de documento"
                />
              </div>
              <div className="form-group">
                <label className="form-label form-label--required">Rol</label>
                <select
                  className="form-input"
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  required
                >
                  {rolesCreables.map((r) => (
                    <option key={r} value={r}>{LABEL_ROL[r] ?? r}</option>
                  ))}
                </select>
              </div>
              {esSuperAdmin && (
                <div className="form-group">
                  <label className="form-label form-label--required">IPS destino</label>
                  <select
                    className="form-input"
                    value={form.ipsId}
                    onChange={(e) => setForm({ ...form, ipsId: e.target.value })}
                    required
                  >
                    <option value="">Seleccione IPS</option>
                    {ipsList.filter((i) => i.activa).map((ips) => (
                      <option key={ips.ipsId} value={ips.ipsId}>
                        {ips.ipsId} — {ips.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button className="btn btn--primary" type="submit">Crear usuario</button>
              <button className="btn btn--ghost" type="button" onClick={limpiar}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-secondary">Cargando usuarios...</p>
      ) : usuarios.length === 0 ? (
        <div className="card card--elevated">
          <p className="text-secondary">No se encontraron usuarios.</p>
        </div>
      ) : (
        <div className="card card--elevated" style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.75rem 0.5rem" }}>ID</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Nombre</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Correo</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Rol</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>IPS</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Documento</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Estado</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.usuarioId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600 }}>
                    <code style={{ fontSize: "0.8rem" }}>{u.usuarioId}</code>
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>{u.nombre}</td>
                  <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.8rem" }}>{u.correo ?? "—"}</td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: "var(--accent-subtle)",
                        color: "var(--accent)"
                      }}
                    >
                      {LABEL_ROL[u.rol] ?? u.rol}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>{u.ipsId}</td>
                  <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.8rem" }}>
                    {u.documentoIdentidad ?? "—"}
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: u.activo ? "var(--success-bg)" : "var(--danger-bg)",
                          color: u.activo ? "var(--success)" : "var(--danger)",
                          border: `1px solid ${u.activo ? "var(--success-border)" : "var(--danger-border)"}`
                        }}
                      >
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                      {u.requiereCambioPassword && (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: "12px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            background: "var(--warning-bg)",
                            color: "var(--warning)",
                            border: "1px solid var(--warning-border)"
                          }}
                        >
                          Clave temporal
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        className={`btn btn--sm ${u.activo ? "btn--ghost" : "btn--secondary"}`}
                        onClick={() => toggleActivo(u)}
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        className="btn btn--sm btn--secondary"
                        onClick={() => onResetPassword(u)}
                      >
                        Reset clave
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
