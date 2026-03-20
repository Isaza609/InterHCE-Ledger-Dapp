import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  configurarIpsInfra,
  desplegarContratosMock,
  obtenerEstadoInfraestructura,
  type EstadoInfraestructura
} from "@/shared/services/api";

const IPS_DEFAULT = [
  { ipsId: "IPS-001", nombre: "Hospital Central", repsCodigo: "110010001" },
  { ipsId: "IPS-002", nombre: "Clínica Norte", repsCodigo: "110010002" }
];

export function InfraestructuraPage() {
  const [estado, setEstado] = useState<EstadoInfraestructura | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refrescar = async () => {
    setLoading(true);
    const res = await obtenerEstadoInfraestructura();
    setEstado(res);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    obtenerEstadoInfraestructura()
      .then((res) => {
        if (!active) return;
        setEstado(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const setupIps = async () => {
    setLoading(true);
    const result = await configurarIpsInfra(IPS_DEFAULT);
    setMessage(result.message);
    await refrescar();
  };

  const setupContracts = async () => {
    setLoading(true);
    const result = await desplegarContratosMock();
    setMessage(result.message);
    await refrescar();
  };

  return (
    <div className="container">
      <nav aria-label="Migas de pan" className="breadcrumb">
        <Link to="/">Inicio</Link>
        {" / Infraestructura"}
      </nav>

      <section className="page-banner page-banner--compact">
        <div>
          <p className="eyebrow">Estado técnico</p>
          <h1 className="page-title">Infraestructura del entorno</h1>
          <p className="page-subtitle">
            Revise si el backend, el almacenamiento off-chain y la red blockchain están listos
            para operar los flujos interinstitucionales.
          </p>
        </div>
        <div className="page-banner__actions">
          <button className="btn btn--secondary" onClick={setupIps} disabled={loading}>
            Preparar IPS de prueba
          </button>
          <button className="btn btn--primary" onClick={setupContracts} disabled={loading}>
            Activar modo blockchain
          </button>
          <button className="btn btn--ghost" onClick={refrescar} disabled={loading}>
            {loading ? "Consultando..." : "Actualizar estado"}
          </button>
        </div>
      </section>

      {message && (
        <div className="alert alert--info" style={{ marginBottom: "1rem" }}>
          {message}
        </div>
      )}

      {estado && (
        <div className="dashboard-grid dashboard-grid--wide">
          <section className="card card--elevated">
            <div className="section-head section-head--tight">
              <div>
                <h2 className="section-title">Blockchain</h2>
                <p className="section-copy">
                  Estado del registro de evidencia desde el backend hacia la testnet.
                </p>
              </div>
              <div
                className={
                  estado.blockchain.modo === "real" && estado.blockchain.rpcReachable
                    ? "status-chip status-chip--ready"
                    : "status-chip"
                }
              >
                {estado.blockchain.modo === "real" ? "Modo real" : "Modo simulado"}
              </div>
            </div>
            <div className="stack-list">
              <div className="stack-item">
                <strong>Red y contrato</strong>
                <span>{estado.blockchain.red} · Chain ID {estado.blockchain.chainId}</span>
                <small>{estado.blockchain.contractAddress ?? "Contrato no disponible"}</small>
              </div>
              <div className="stack-item">
                <strong>Preparación del backend</strong>
                <span>
                  RPC {estado.blockchain.backendRpcConfigured ? "configurada" : "pendiente"} · Firma{" "}
                  {estado.blockchain.backendSignerConfigured ? "configurada" : "pendiente"}
                </span>
                <small>
                  {estado.blockchain.contratosOperativos
                    ? "Los contratos están disponibles para registrar eventos."
                    : "La evidencia solo está disponible en modo simulado."}
                </small>
              </div>
              <div className="stack-item">
                <strong>Salud de la conexión RPC</strong>
                <span>
                  {estado.blockchain.rpcReachable === undefined
                    ? "Sin chequeo disponible"
                    : estado.blockchain.rpcReachable
                      ? "Conectada"
                      : "No disponible"}
                </span>
                <small>
                  {estado.blockchain.rpcReachable
                    ? `Último bloque consultado: ${estado.blockchain.lastBlockNumber ?? "—"}`
                    : estado.blockchain.healthMessage ?? "Configure una RPC para validar conectividad."}
                </small>
              </div>
            </div>
          </section>

          <section className="card card--elevated">
            <h2 className="section-title">Almacenamiento clínico</h2>
            <p><strong>FHIR configurado:</strong> {estado.offChain.fhirConfigurado ? "Sí" : "No"}</p>
            <p style={{ marginBottom: 0 }}>
              <strong>Tipo de almacenamiento:</strong> {estado.offChain.almacenamiento}
            </p>
          </section>

          <section className="card card--elevated">
            <h2 className="section-title">IPS disponibles</h2>
            <p><strong>Total:</strong> {estado.simulacionIps.total}</p>
            <p><strong>Modo multi-IPS:</strong> {estado.simulacionIps.multipleIpsActivo ? "Activo" : "Pendiente"}</p>
            <div className="stack-list">
              {estado.simulacionIps.ips.map((ips) => (
                <div key={ips.ipsId} className="stack-item">
                  <strong>{ips.nombre}</strong>
                  <span>{ips.ipsId}</span>
                  <small>REPS {ips.repsCodigo}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="card card--elevated">
            <h2 className="section-title">Alistamiento general</h2>
            <p style={{ marginBottom: "0.75rem" }}>
              {estado.cumpleHu1E5
                ? "El entorno está listo para ejecutar flujos clínicos, permisos e integridad."
                : "Todavía faltan componentes para dejar el entorno operativo completo."}
            </p>
            <div className={estado.cumpleHu1E5 ? "status-chip status-chip--ready" : "status-chip"}>
              {estado.cumpleHu1E5 ? "Entorno listo" : "Pendiente de configuración"}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
