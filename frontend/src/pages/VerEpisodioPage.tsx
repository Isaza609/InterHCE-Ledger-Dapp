import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSesion } from "@/shared/auth/SessionContext";
import {
  consultarDocumentoEpisodio,
  consultarIntegridadEpisodio,
  consultarTrazabilidadEpisodio
} from "@/shared/services/api";

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function shortHash(value?: string) {
  if (!value) return "—";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export function VerEpisodioPage() {
  const { id } = useParams<{ id: string }>();
  const { sesion } = useSesion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [documento, setDocumento] = useState<Awaited<ReturnType<typeof consultarDocumentoEpisodio>>["data"]>();
  const [traceData, setTraceData] = useState<Awaited<ReturnType<typeof consultarTrazabilidadEpisodio>>["data"]>();
  const [integrityData, setIntegrityData] = useState<Awaited<ReturnType<typeof consultarIntegridadEpisodio>>["data"]>();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    Promise.all([
      consultarDocumentoEpisodio(id, sesion),
      consultarTrazabilidadEpisodio(id, sesion),
      consultarIntegridadEpisodio(id, sesion)
    ])
      .then(([docRes, traceRes, integrityRes]) => {
        if (cancelled) return;
        setDocumento(docRes.data);
        setTraceData(traceRes.data);
        setIntegrityData(integrityRes.data);

        if (!docRes.ok) {
          setError(docRes.message);
          return;
        }

        const notes = [traceRes.ok ? null : traceRes.message, integrityRes.ok ? null : integrityRes.message]
          .filter(Boolean)
          .join(" ");
        setMessage(notes || docRes.message);
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
  }, [id, sesion]);

  const doc = documento?.document;
  const patientName = useMemo(() => {
    const patient = doc?.patient?.name?.[0];
    if (!patient) return "Sin nombre reportado";
    return `${patient.family ?? ""} ${(patient.given ?? []).join(" ")}`.trim() || "Sin nombre reportado";
  }, [doc]);

  if (!id) {
    return (
      <>
        <div className="alert alert--error">Falta el ID del episodio.</div>
        <Link to="/episodios" className="btn btn--secondary" style={{ marginTop: 12 }}>Volver</Link>
      </>
    );
  }

  if (loading) {
    return (
      <div className="card card--elevated">
        <p className="empty-state">Cargando documento clínico...</p>
      </div>
    );
  }

  if (error || !documento || !doc) {
    return (
      <>
        <nav aria-label="Migas de pan" className="breadcrumb">
          <Link to="/portal">Panel</Link>{" / "}
          <Link to="/episodios">Episodios</Link>{" / Documento"}
        </nav>
        <div className="alert alert--error">{error ?? "Documento no encontrado."}</div>
        <Link to="/episodios" className="btn btn--secondary" style={{ marginTop: 12 }}>Volver</Link>
      </>
    );
  }

  return (
    <>
      <nav aria-label="Migas de pan" className="breadcrumb">
        <Link to="/portal">Panel</Link>{" / "}
        <Link to="/episodios">Episodios</Link>{" / Documento"}
      </nav>

      <div className="page-header">
        <div className="page-header__row">
          <div>
            <h1 className="page-title">{patientName}</h1>
            <p className="page-subtitle">Documento clínico off-chain con evidencia de integridad.</p>
          </div>
          <div className="context-note">
            <strong>Episodio</strong>
            <span style={{ fontSize: 12 }}>{documento.episodeId}</span>
            <small>Hash: {shortHash(documento.hash)}</small>
          </div>
        </div>
      </div>

      {message && <div className="alert alert--info" style={{ marginBottom: 16 }}>{message}</div>}

      <div className="dashboard-grid dashboard-grid--wide">
        <section className="card card--elevated">
          <h2 className="section-title">Paciente</h2>
          <div className="stack-list" style={{ marginTop: 10 }}>
            <div className="stack-item">
              <strong>Nombre</strong><span>{patientName}</span>
            </div>
            <div className="stack-item">
              <strong>Documento</strong><span>{doc.patient?.identifier?.[0]?.value ?? "—"}</span>
            </div>
            <div className="stack-item">
              <strong>Nacimiento</strong><span>{doc.patient?.birthDate ?? "—"}</span>
            </div>
            <div className="stack-item">
              <strong>Sexo</strong><span>{doc.patient?.gender ?? "—"}</span>
            </div>
          </div>
        </section>

        <section className="card card--elevated">
          <h2 className="section-title">Atención</h2>
          <div className="stack-list" style={{ marginTop: 10 }}>
            <div className="stack-item">
              <strong>Inicio</strong><span>{formatDate(doc.encounter?.period?.start)}</span>
            </div>
            <div className="stack-item">
              <strong>Fin</strong><span>{doc.encounter?.period?.end ? formatDate(doc.encounter.period.end) : "En curso"}</span>
            </div>
            <div className="stack-item">
              <strong>Estado</strong><span>{doc.encounter?.status ?? "—"}</span>
            </div>
            <div className="stack-item">
              <strong>Tipo</strong><span>{traceData?.event.tipoAtencion ?? doc.encounter?.class?.coding?.[0]?.display ?? "—"}</span>
            </div>
          </div>
        </section>

        <section className="card card--elevated">
          <h2 className="section-title">Diagnóstico e instituciones</h2>
          <div className="stack-list" style={{ marginTop: 10 }}>
            <div className="stack-item">
              <strong>IPS origen</strong><span>{doc.prestadorOrigen?.identifier?.[0]?.value ?? "—"}</span>
            </div>
            <div className="stack-item">
              <strong>IPS destino</strong><span>{doc.prestadorDestino?.identifier?.[0]?.value ?? "No aplica"}</span>
            </div>
            <div className="stack-item">
              <strong>Dx ingreso</strong><span>{doc.diagnosticoIngreso?.code?.coding?.[0]?.code ?? "—"}</span>
            </div>
            <div className="stack-item">
              <strong>Dx egreso</strong><span>{doc.diagnosticoEgreso?.code?.coding?.[0]?.code ?? "No registrado"}</span>
            </div>
          </div>
        </section>

        <section className="card card--elevated">
          <h2 className="section-title">Integridad y auditoría</h2>
          <div className="stack-list" style={{ marginTop: 10 }}>
            <div className="stack-item">
              <strong>Consulta auditada</strong><span>{documento.auditTrace ? "Sí" : "No"}</span>
            </div>
            <div className="stack-item">
              <strong>Evento</strong><span>{documento.auditTrace?.eventType ?? "—"}</span>
            </div>
            <div className="stack-item">
              <strong>Integridad</strong>
              <span>{integrityData ? (integrityData.isIntegrityValid ? "Íntegra" : "Revisión requerida") : "No disponible"}</span>
            </div>
            <div className="stack-item">
              <strong>Tx evidencia</strong><span>{shortHash(documento.auditTrace?.evidence.transactionHash)}</span>
            </div>
          </div>
        </section>
      </div>

      <section className="card card--elevated" style={{ marginTop: 16 }}>
        <div className="section-head section-head--tight">
          <div>
            <h2 className="section-title">Continuidad del episodio</h2>
            <p className="section-copy">Participación institucional y acceso vigente.</p>
          </div>
          <Link to={`/episodios/trazabilidad?episodeId=${documento.episodeId}`} className="btn btn--secondary btn--sm">
            Ver trazabilidad
          </Link>
        </div>
        <div className="key-value-grid">
          <div>
            <strong>Evento urgencias</strong>
            <span>{traceData?.event.eventoUrgenciasId ?? "—"}</span>
          </div>
          <div>
            <strong>IPS propietaria</strong>
            <span>{traceData?.continuidad?.ownerIpsId ?? traceData?.event.ipsOrigenId ?? "—"}</span>
          </div>
          <div>
            <strong>IPS involucradas</strong>
            <span>{traceData?.continuidad?.ipsInvolucradas.join(", ") ?? traceData?.event.ipsOrigenId ?? "—"}</span>
          </div>
        </div>
      </section>

      <section className="card card--elevated" style={{ marginTop: 16 }}>
        <div className="section-head section-head--tight">
          <div>
            <h2 className="section-title">Datos clínicos clave</h2>
            <p className="section-copy">Resumen estructurado según el modelo HCE.</p>
          </div>
        </div>
        <div className="key-value-grid">
          <div>
            <strong>EPS/EAPB</strong>
            <span>{doc.cobertura?.payor?.[0]?.display ?? doc.cobertura?.payor?.[0]?.identifier?.value ?? "—"}</span>
          </div>
          <div>
            <strong>Documento soporte</strong>
            <span>{doc.documentoSoporte?.content?.[0]?.attachment?.title ?? "No registrado"}</span>
          </div>
          <div>
            <strong>Profesional alta</strong>
            <span>{doc.profesionalAlta?.identifier?.[0]?.value ?? "No registrado"}</span>
          </div>
          <div>
            <strong>Hash clínico</strong>
            <code>{shortHash(documento.hash)}</code>
          </div>
        </div>
      </section>
    </>
  );
}
