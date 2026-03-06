import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { obtenerDocumentoEpisodio } from "@/shared/services/api";

export function VerEpisodioPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Awaited<ReturnType<typeof obtenerDocumentoEpisodio>>>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Falta el ID del episodio.");
      return;
    }
    let cancelled = false;
    obtenerDocumentoEpisodio(id)
      .then((doc) => {
        if (!cancelled) {
          setData(doc);
          if (!doc) setError("No se encontró el documento para este episodio.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Error al cargar el documento.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="container">
        <p>Cargando documento…</p>
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
          {" / Ver"}
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
    : "—";

  return (
    <div className="container">
      <nav aria-label="Migas de pan" className="breadcrumb">
        <Link to="/">Inicio</Link>
        {" / "}
        <Link to="/episodios">Episodios</Link>
        {" / Ver "}
        <code>{data.episodeId}</code>
      </nav>
      <h1 className="page-title">Documento del episodio</h1>
      <p className="page-subtitle">
        ID: <code style={{ wordBreak: "break-all" }}>{data.episodeId}</code>
        {" · "}
        Hash: <code style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>{data.hash}</code>
      </p>

      <div className="card card--elevated" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Paciente</h2>
        <p style={{ margin: 0 }}>
          <strong>Nombre:</strong> {patientLabel}
          {" · "}
          <strong>Identificador:</strong> {doc.patient?.identifier?.[0]?.value ?? "—"}
          {" · "}
          <strong>Nacimiento:</strong> {doc.patient?.birthDate ?? "—"}
        </p>
      </div>

      <div className="card card--elevated" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Encuentro</h2>
        <p style={{ margin: 0 }}>
          <strong>Inicio:</strong> {doc.encounter?.period?.start ?? "—"}
          {doc.encounter?.period?.end && (
            <> · <strong>Fin:</strong> {doc.encounter.period.end}</>
          )}
          {" · "}
          <strong>Estado:</strong> {doc.encounter?.status ?? "—"}
        </p>
      </div>

      <div className="card card--elevated" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Diagnóstico de ingreso</h2>
        <p style={{ margin: 0 }}>
          CIE-10: {doc.diagnosticoIngreso?.code?.coding?.[0]?.code ?? "—"}
          {doc.diagnosticoIngreso?.code?.coding?.[0]?.display && (
            <> ({doc.diagnosticoIngreso.code.coding[0].display})</>
          )}
        </p>
      </div>

      <Link to="/episodios" className="btn btn--secondary">
        Volver a episodios
      </Link>
    </div>
  );
}
