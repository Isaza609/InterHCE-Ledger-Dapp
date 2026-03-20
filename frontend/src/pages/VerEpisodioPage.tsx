import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { obtenerDocumentoEpisodio } from "@/shared/services/api";

export function VerEpisodioPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Awaited<ReturnType<typeof obtenerDocumentoEpisodio>>>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    obtenerDocumentoEpisodio(id)
      .then((doc) => {
        if (cancelled) return;
        setData(doc);
        if (!doc) {
          setError("No fue posible recuperar el documento de este episodio.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Ocurrió un error al cargar el documento clínico.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return (
      <div className="container">
        <nav aria-label="Migas de pan" className="breadcrumb">
          <Link to="/">Inicio</Link>
          {" / "}
          <Link to="/episodios">Episodios</Link>
          {" / Documento"}
        </nav>
        <div className="alert alert--error">
          <p style={{ margin: 0 }}>Falta el ID del episodio.</p>
        </div>
        <Link to="/episodios" className="btn btn--secondary" style={{ marginTop: "1rem" }}>
          Volver a episodios
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card card--elevated">
          <p className="empty-state">Cargando documento clínico...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container">
        <nav aria-label="Migas de pan" className="breadcrumb">
          <Link to="/">Inicio</Link>
          {" / "}
          <Link to="/episodios">Episodios</Link>
          {" / Documento"}
        </nav>
        <div className="alert alert--error">
          <p style={{ margin: 0 }}>{error ?? "Documento no encontrado."}</p>
        </div>
        <Link to="/episodios" className="btn btn--secondary" style={{ marginTop: "1rem" }}>
          Volver a episodios
        </Link>
      </div>
    );
  }

  const { document: doc } = data;
  const patientName = doc.patient?.name?.[0];
  const patientLabel = patientName
    ? `${patientName.family ?? ""} ${(patientName.given ?? []).join(" ")}`.trim()
    : "Sin nombre reportado";

  return (
    <div className="container">
      <nav aria-label="Migas de pan" className="breadcrumb">
        <Link to="/">Inicio</Link>
        {" / "}
        <Link to="/episodios">Episodios</Link>
        {" / Documento"}
      </nav>

      <section className="page-banner page-banner--compact">
        <div>
          <p className="eyebrow">Documento clínico</p>
          <h1 className="page-title">{patientLabel}</h1>
          <p className="page-subtitle">
            Revise la información principal del episodio. El contenido clínico permanece off-chain
            y su acceso sigue las reglas de autorización del sistema.
          </p>
        </div>
        <div className="context-note">
          <strong>ID episodio</strong>
          <span>{data.episodeId}</span>
          <small>Hash: {data.hash}</small>
        </div>
      </section>

      <div className="dashboard-grid dashboard-grid--wide">
        <section className="card card--elevated">
          <h2 className="section-title">Identificación del paciente</h2>
          <p><strong>Nombre:</strong> {patientLabel}</p>
          <p><strong>Documento:</strong> {doc.patient?.identifier?.[0]?.value ?? "—"}</p>
          <p style={{ marginBottom: 0 }}>
            <strong>Fecha de nacimiento:</strong> {doc.patient?.birthDate ?? "—"}
          </p>
        </section>

        <section className="card card--elevated">
          <h2 className="section-title">Atención registrada</h2>
          <p><strong>Inicio:</strong> {doc.encounter?.period?.start ?? "—"}</p>
          <p><strong>Fin:</strong> {doc.encounter?.period?.end ?? "En curso"}</p>
          <p style={{ marginBottom: 0 }}>
            <strong>Estado:</strong> {doc.encounter?.status ?? "—"}
          </p>
        </section>

        <section className="card card--elevated">
          <h2 className="section-title">Institución y diagnóstico</h2>
          <p><strong>IPS origen:</strong> {doc.prestadorOrigen?.identifier?.[0]?.value ?? "—"}</p>
          <p style={{ marginBottom: 0 }}>
            <strong>Diagnóstico principal:</strong> {doc.diagnosticoIngreso?.code?.coding?.[0]?.code ?? "—"}
          </p>
        </section>

        <section className="card card--elevated">
          <h2 className="section-title">Auditoría de acceso</h2>
          <p><strong>Consulta registrada:</strong> {data.auditTrace ? "Sí" : "No"}</p>
          <p><strong>Evento:</strong> {data.auditTrace?.eventType ?? "—"}</p>
          <p style={{ marginBottom: 0 }}>
            <strong>Tx / evidencia:</strong> {data.auditTrace?.evidence.transactionHash ?? "—"}
          </p>
        </section>
      </div>
    </div>
  );
}
