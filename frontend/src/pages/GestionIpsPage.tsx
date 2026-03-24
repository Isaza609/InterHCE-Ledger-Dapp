import { useEffect, useState } from "react";
import { useSesion } from "@/shared/auth/SessionContext";
import {
  listarIpsEntidades,
  crearIpsEntidad,
  actualizarIpsEntidad,
  type IpsEntidad
} from "@/shared/services/api";

interface FormIps {
  ipsId: string;
  nombre: string;
  repsCodigo: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  telefono: string;
  correoContacto: string;
}

const FORM_VACIO: FormIps = {
  ipsId: "",
  nombre: "",
  repsCodigo: "",
  direccion: "",
  ciudad: "",
  departamento: "",
  telefono: "",
  correoContacto: ""
};

export function GestionIpsPage() {
  const { sesion } = useSesion();
  const [ipsList, setIpsList] = useState<IpsEntidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormIps>(FORM_VACIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargar = async () => {
    setLoading(true);
    const data = await listarIpsEntidades(sesion);
    setIpsList(data);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const limpiar = () => {
    setForm(FORM_VACIO);
    setEditando(null);
    setMostrarForm(false);
    setMensaje(null);
  };

  const editarIps = (ips: IpsEntidad) => {
    setForm({
      ipsId: ips.ipsId,
      nombre: ips.nombre,
      repsCodigo: ips.repsCodigo,
      direccion: ips.direccion,
      ciudad: ips.ciudad,
      departamento: ips.departamento,
      telefono: ips.telefono,
      correoContacto: ips.correoContacto
    });
    setEditando(ips.ipsId);
    setMostrarForm(true);
    setMensaje(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    if (editando) {
      const result = await actualizarIpsEntidad(editando, {
        nombre: form.nombre,
        repsCodigo: form.repsCodigo,
        direccion: form.direccion,
        ciudad: form.ciudad,
        departamento: form.departamento,
        telefono: form.telefono,
        correoContacto: form.correoContacto
      }, sesion);
      setMensaje({ tipo: result.ok ? "ok" : "error", texto: result.message });
    } else {
      const result = await crearIpsEntidad({
        ipsId: form.ipsId,
        nombre: form.nombre,
        repsCodigo: form.repsCodigo,
        direccion: form.direccion,
        ciudad: form.ciudad,
        departamento: form.departamento,
        telefono: form.telefono,
        correoContacto: form.correoContacto
      }, sesion);
      setMensaje({ tipo: result.ok ? "ok" : "error", texto: result.message });
    }
    await cargar();
    if (!editando) limpiar();
  };

  const toggleActiva = async (ips: IpsEntidad) => {
    const result = await actualizarIpsEntidad(ips.ipsId, { activa: !ips.activa }, sesion);
    setMensaje({ tipo: result.ok ? "ok" : "error", texto: result.message });
    await cargar();
  };

  return (
    <div className="container">
      <div className="section-head">
        <div>
          <p className="eyebrow">Administración del sistema</p>
          <h1 className="page-title">Gestión de IPS</h1>
          <p className="page-subtitle">
            Registre y administre las Instituciones Prestadoras de Salud del sistema.
          </p>
        </div>
        {!mostrarForm && (
          <button
            className="btn btn--primary"
            onClick={() => { setMostrarForm(true); setEditando(null); setForm(FORM_VACIO); }}
          >
            + Nueva IPS
          </button>
        )}
      </div>

      {mensaje && (
        <div className={`alert alert--${mensaje.tipo === "ok" ? "success" : "error"}`}>
          {mensaje.texto}
        </div>
      )}

      {mostrarForm && (
        <div className="card card--elevated" style={{ marginBottom: "1.5rem" }}>
          <h2 className="section-title">{editando ? "Editar IPS" : "Registrar nueva IPS"}</h2>
          <form onSubmit={onSubmit} className="form-section form-section--stacked">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label form-label--required">Código IPS</label>
                <input
                  className="form-input"
                  value={form.ipsId}
                  onChange={(e) => setForm({ ...form, ipsId: e.target.value })}
                  placeholder="Ej: IPS-003"
                  disabled={!!editando}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label form-label--required">Nombre</label>
                <input
                  className="form-input"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre de la institución"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label form-label--required">Código REPS</label>
                <input
                  className="form-input"
                  value={form.repsCodigo}
                  onChange={(e) => setForm({ ...form, repsCodigo: e.target.value })}
                  placeholder="Código REPS del prestador"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ciudad</label>
                <input
                  className="form-input"
                  value={form.ciudad}
                  onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                  placeholder="Ciudad"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Departamento</label>
                <input
                  className="form-input"
                  value={form.departamento}
                  onChange={(e) => setForm({ ...form, departamento: e.target.value })}
                  placeholder="Departamento"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Dirección</label>
                <input
                  className="form-input"
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  placeholder="Dirección"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input
                  className="form-input"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="Teléfono de contacto"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Correo de contacto</label>
                <input
                  className="form-input"
                  type="email"
                  value={form.correoContacto}
                  onChange={(e) => setForm({ ...form, correoContacto: e.target.value })}
                  placeholder="correo@institucion.com"
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button className="btn btn--primary" type="submit">
                {editando ? "Guardar cambios" : "Crear IPS"}
              </button>
              <button className="btn btn--ghost" type="button" onClick={limpiar}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-secondary">Cargando instituciones...</p>
      ) : ipsList.length === 0 ? (
        <div className="card card--elevated">
          <p className="text-secondary">No hay IPS registradas en el sistema.</p>
        </div>
      ) : (
        <div className="card card--elevated" style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.75rem 0.5rem" }}>Código</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Nombre</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>REPS</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Ciudad</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Estado</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ipsList.map((ips) => (
                <tr key={ips.ipsId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600 }}>{ips.ipsId}</td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>{ips.nombre}</td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    <code style={{ fontSize: "0.8rem" }}>{ips.repsCodigo}</code>
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>{ips.ciudad || "—"}</td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: ips.activa ? "var(--success-bg)" : "var(--danger-bg)",
                        color: ips.activa ? "var(--success)" : "var(--danger)",
                        border: `1px solid ${ips.activa ? "var(--success-border)" : "var(--danger-border)"}`
                      }}
                    >
                      {ips.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => editarIps(ips)}
                      >
                        Editar
                      </button>
                      <button
                        className={`btn btn--sm ${ips.activa ? "btn--ghost" : "btn--secondary"}`}
                        onClick={() => toggleActiva(ips)}
                      >
                        {ips.activa ? "Desactivar" : "Activar"}
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
