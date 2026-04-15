/**
 * DemoPage.tsx — TX Demo Panel de InterHCE Ledger.
 * Solo se monta cuando VITE_DEMO_MODE=true (ver router.tsx).
 * Consume endpoints existentes sin reimplementar lógica de negocio.
 * No modifica ningún componente o servicio del sistema principal.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useSesion } from "@/shared/auth/SessionContext";
import {
  registrarEpisodio,
  obtenerDocumentoEpisodio,
  obtenerTrazabilidadEpisodio
} from "@/shared/services/api";
import { DemoTxResult, type TxDisplayData } from "./DemoTxResult";
import { buildDemoEpisodePayload } from "./demoFixtures";

// ─── Constantes de entorno ─────────────────────────────────────────────────
const CONTRACT_ADDRESS = String(import.meta.env.VITE_TRACE_CONTRACT_ADDRESS ?? "").trim() || "0x…no configurado";
const EXPLORER_BASE = String(import.meta.env.VITE_BLOCKCHAIN_EXPLORER_TX_BASE ?? "https://sepolia.etherscan.io/tx/").trim();
const CHAIN_ID = String(import.meta.env.VITE_CHAIN_ID ?? "11155111");

// ─── Tipos internos ─────────────────────────────────────────────────────────
type OperationId = "crear" | "trazabilidad" | "historial";
type OperationState = "idle" | "loading" | "success" | "error";

interface OperationResult {
  txData: TxDisplayData;
  rawResponse: unknown;
  errorMsg?: string;
}

// ─── Descripción de operaciones ─────────────────────────────────────────────
const OPERATIONS: { id: OperationId; index: number; title: string; subtitle: string; method: string; endpoint: string; gasNote: string }[] = [
  {
    id: "crear",
    index: 1,
    title: "Crear Episodio Clínico",
    subtitle: "Registra un nuevo HCE en FHIR y emite una traza en el smart contract.",
    method: "POST",
    endpoint: "/episodes",
    gasNote: "Escritura — gasta gas (EPISODE_CREATED)"
  },
  {
    id: "trazabilidad",
    index: 2,
    title: "Registrar Evento de Trazabilidad",
    subtitle: "Accede al documento clínico y registra un evento AUDITABLE_ACCESS en cadena.",
    method: "GET",
    endpoint: "/episodes/:id/document",
    gasNote: "Escritura — gasta gas (AUDITABLE_ACCESS)"
  },
  {
    id: "historial",
    index: 3,
    title: "Consultar Historial de Episodio",
    subtitle: "Recupera todos los eventos de trazabilidad registrados. Solo lectura, sin gas.",
    method: "GET",
    endpoint: "/episodes/:id/traceability",
    gasNote: "Lectura — sin costo de gas"
  }
];

// ─── Estilos compartidos ─────────────────────────────────────────────────────
const S = {
  page: {
    fontFamily: "'Courier New', 'Fira Code', 'Cascadia Code', monospace",
    background: "#010409",
    minHeight: "100vh",
    padding: "32px 24px",
    color: "#e6edf3"
  } as React.CSSProperties,
  header: {
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 10,
    padding: "20px 24px",
    marginBottom: 24
  } as React.CSSProperties,
  card: {
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 8,
    padding: "18px 20px",
    marginBottom: 14
  } as React.CSSProperties,
  badge: (color: string) => ({
    display: "inline-block",
    background: `${color}22`,
    border: `1px solid ${color}`,
    color: color,
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 4,
    letterSpacing: "0.06em"
  } as React.CSSProperties),
  btn: (disabled: boolean) => ({
    background: disabled ? "#21262d" : "#1f6feb",
    border: `1px solid ${disabled ? "#30363d" : "#388bfd"}`,
    color: disabled ? "#6e7681" : "#ffffff",
    borderRadius: 6,
    padding: "8px 18px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "inherit",
    letterSpacing: "0.04em",
    transition: "all 0.15s",
    whiteSpace: "nowrap" as const
  } as React.CSSProperties)
};

// ─── Componente principal ────────────────────────────────────────────────────
export function DemoPage() {
  const { sesion } = useSesion();

  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");
  const [states, setStates] = useState<Record<OperationId, OperationState>>({
    crear: "idle",
    trazabilidad: "idle",
    historial: "idle"
  });
  const [results, setResults] = useState<Record<OperationId, OperationResult | null>>({
    crear: null,
    trazabilidad: null,
    historial: null
  });
  const [activeResult, setActiveResult] = useState<OperationId | null>(null);

  // ── helpers ──────────────────────────────────────────────────────────────
  function setOpState(id: OperationId, s: OperationState) {
    setStates(prev => ({ ...prev, [id]: s }));
  }

  function setOpResult(id: OperationId, r: OperationResult | null) {
    setResults(prev => ({ ...prev, [id]: r }));
    setActiveResult(id);
  }

  function getTargetEpisodeId(): string | null {
    return manualId.trim() || episodeId;
  }

  // ── Operación 1: Crear episodio ───────────────────────────────────────────
  async function handleCrear() {
    if (!sesion) return;
    if (!sesion.ipsId) {
      setOpResult("crear", {
        txData: { status: "pending", operationLabel: "Crear Episodio Clínico" },
        rawResponse: null,
        errorMsg: "Tu sesión no tiene ipsId. Inicia sesión con un usuario profesional_salud o admin_ips que tenga IPS asignada."
      });
      setOpState("crear", "error");
      return;
    }
    setOpState("crear", "loading");
    try {
      const payload = buildDemoEpisodePayload(sesion.ipsId);
      const result = await registrarEpisodio(payload, sesion);

      if (!result.valid || !result.episodeId) {
        setOpResult("crear", {
          txData: { status: "pending", operationLabel: "Crear Episodio Clínico" },
          rawResponse: result,
          errorMsg: result.message ?? "Error al registrar el episodio"
        });
        setOpState("crear", "error");
        return;
      }

      const ev = result.traceEvent?.evidence;
      setEpisodeId(result.episodeId);

      const txData: TxDisplayData = {
        status: "confirmed",
        operationLabel: "Crear Episodio Clínico",
        txHash: ev?.transactionHash,
        blockNumber: ev?.blockNumber,
        gasUsed: ev?.gasUsed,
        gasPriceWei: ev?.gasPriceWei,
        confirmationMs: ev?.confirmationMs,
        timestamp: ev?.confirmedAt,
        explorerUrl: ev?.explorerUrl ?? (ev?.transactionHash ? `${EXPLORER_BASE}${ev.transactionHash}` : undefined),
        ledgerMode: ev?.ledgerMode,
        network: ev?.network,
        episodeId: result.episodeId,
        documentHash: result.documentHash
      };
      setOpResult("crear", { txData, rawResponse: result });
      setOpState("crear", "success");
    } catch (err) {
      setOpResult("crear", {
        txData: { status: "pending", operationLabel: "Crear Episodio Clínico" },
        rawResponse: null,
        errorMsg: err instanceof Error ? err.message : "Error inesperado"
      });
      setOpState("crear", "error");
    }
  }

  // ── Operación 2: Registrar evento de trazabilidad (doc access) ─────────────
  async function handleTrazabilidad() {
    const target = getTargetEpisodeId();
    if (!sesion || !target) return;
    setOpState("trazabilidad", "loading");
    try {
      const result = await obtenerDocumentoEpisodio(target, sesion);

      if (!result) {
        setOpResult("trazabilidad", {
          txData: { status: "pending", operationLabel: "Registrar Evento de Trazabilidad" },
          rawResponse: null,
          errorMsg: "No se pudo acceder al documento. ¿El episodio existe?"
        });
        setOpState("trazabilidad", "error");
        return;
      }

      const ev = result.auditTrace?.evidence;
      const txData: TxDisplayData = {
        status: ev?.transactionHash ? "confirmed" : "pending",
        operationLabel: "Registrar Evento de Trazabilidad",
        txHash: ev?.transactionHash,
        blockNumber: ev?.blockNumber,
        gasUsed: ev?.gasUsed,
        gasPriceWei: ev?.gasPriceWei,
        confirmationMs: ev?.confirmationMs,
        timestamp: ev?.confirmedAt ?? result.createdAt,
        explorerUrl: ev?.explorerUrl ?? (ev?.transactionHash ? `${EXPLORER_BASE}${ev.transactionHash}` : undefined),
        ledgerMode: ev?.ledgerMode,
        network: ev?.network,
        episodeId: result.episodeId,
        documentHash: result.hash
      };
      setOpResult("trazabilidad", { txData, rawResponse: result });
      setOpState("trazabilidad", "success");
    } catch (err) {
      setOpResult("trazabilidad", {
        txData: { status: "pending", operationLabel: "Registrar Evento de Trazabilidad" },
        rawResponse: null,
        errorMsg: err instanceof Error ? err.message : "Error inesperado"
      });
      setOpState("trazabilidad", "error");
    }
  }

  // ── Operación 3: Consultar historial ──────────────────────────────────────
  async function handleHistorial() {
    const target = getTargetEpisodeId();
    if (!sesion || !target) return;
    setOpState("historial", "loading");
    try {
      const result = await obtenerTrazabilidadEpisodio(target, sesion);

      if (!result) {
        setOpResult("historial", {
          txData: { status: "readonly", operationLabel: "Consultar Historial de Episodio" },
          rawResponse: null,
          errorMsg: "No se encontró trazabilidad para este episodio."
        });
        setOpState("historial", "error");
        return;
      }

      // Último bloque registrado (del traceEvent más reciente)
      const lastTrace = result.traceEvents?.[result.traceEvents.length - 1];
      const txData: TxDisplayData = {
        status: "readonly",
        operationLabel: "Consultar Historial de Episodio",
        txHash: undefined, // lectura pura, sin TX
        network: lastTrace?.evidence?.network ?? "sepolia",
        episodeId: result.episodeId,
        totalEvents: result.traceEvents?.length ?? 0,
        versiones: result.versiones?.length ?? 0,
        permisosActivos: result.permisosActivos?.length ?? 0,
        traceEvents: result.traceEvents
      };
      setOpResult("historial", { txData, rawResponse: result });
      setOpState("historial", "success");
    } catch (err) {
      setOpResult("historial", {
        txData: { status: "readonly", operationLabel: "Consultar Historial de Episodio" },
        rawResponse: null,
        errorMsg: err instanceof Error ? err.message : "Error inesperado"
      });
      setOpState("historial", "error");
    }
  }

  const handlers: Record<OperationId, () => Promise<void>> = {
    crear: handleCrear,
    trazabilidad: handleTrazabilidad,
    historial: handleHistorial
  };

  const needsEpisodeId = (id: OperationId) => id !== "crear";
  const targetId = getTargetEpisodeId();

  // ── Sin sesión ────────────────────────────────────────────────────────────
  if (!sesion) {
    return (
      <div style={S.page}>
        <div style={{ ...S.card, maxWidth: 480, margin: "60px auto", textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔒</div>
          <div style={{ color: "#f0f6fc", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            Autenticación requerida
          </div>
          <div style={{ color: "#8b949e", fontSize: 13, marginBottom: 20 }}>
            El TX Demo Panel requiere una sesión activa para llamar a los endpoints.
          </div>
          <Link
            to="/login"
            style={{
              display: "inline-block",
              background: "#1f6feb",
              color: "#fff",
              borderRadius: 6,
              padding: "8px 20px",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700
            }}
          >
            Ir al Login
          </Link>
        </div>
      </div>
    );
  }

  // ── Panel principal ──────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>

        {/* ── Cabecera ── */}
        <div style={S.header}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>🔗</span>
                <span style={{ color: "#f0f6fc", fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>
                  TX Demo Panel
                </span>
                <span style={S.badge("#f0883e")}>DEMO</span>
              </div>
              <div style={{ color: "#8b949e", fontSize: 12 }}>
                InterHCE Ledger · Red Ethereum Sepolia (chainId: {CHAIN_ID})
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#3fb950", fontSize: 11, marginBottom: 2 }}>
                ● Conectado como: <strong style={{ color: "#e6edf3" }}>{sesion.rol}</strong>
              </div>
              {sesion.ipsId
                ? <div style={{ color: "#79c0ff", fontSize: 10, marginBottom: 2 }}>IPS: {sesion.ipsId}</div>
                : <div style={{ color: "#f85149", fontSize: 10, marginBottom: 2 }}>⚠ Sin IPS asignada (op. 1 bloqueada)</div>
              }
              {CONTRACT_ADDRESS !== "0x…no configurado" && (
                <div style={{ color: "#6e7681", fontSize: 10 }}>
                  Contract: {CONTRACT_ADDRESS.slice(0, 10)}…{CONTRACT_ADDRESS.slice(-6)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Selector de episodio manual ── */}
        <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ color: "#8b949e", fontSize: 11, whiteSpace: "nowrap" }}>Episode ID para ops 2 y 3:</div>
          <input
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            placeholder={episodeId ? `Auto: ${episodeId.slice(0, 18)}…` : "Ejecuta op 1 o pega un ID aquí"}
            style={{
              flex: 1,
              minWidth: 220,
              background: "#161b22",
              border: "1px solid #30363d",
              borderRadius: 5,
              padding: "6px 10px",
              color: "#e6edf3",
              fontSize: 11,
              fontFamily: "inherit",
              outline: "none"
            }}
          />
          {episodeId && !manualId && (
            <span style={S.badge("#3fb950")}>Auto-llenado</span>
          )}
        </div>

        {/* ── Tarjetas de operación ── */}
        {OPERATIONS.map(op => {
          const isLoading = states[op.id] === "loading";
          const isError = states[op.id] === "error";
          const isSuccess = states[op.id] === "success";
          const missingId = needsEpisodeId(op.id) && !targetId;
          const disabled = isLoading || !sesion || missingId;

          const methodColor = op.method === "POST" ? "#f0883e" : "#58a6ff";

          return (
            <div key={op.id} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ color: "#6e7681", fontSize: 12, fontWeight: 700 }}>
                      [{op.index}]
                    </span>
                    <span style={{ color: "#f0f6fc", fontSize: 14, fontWeight: 700 }}>
                      {op.title}
                    </span>
                    {isSuccess && <span style={S.badge("#3fb950")}>✓ OK</span>}
                    {isError && <span style={S.badge("#f85149")}>✗ Error</span>}
                  </div>
                  <div style={{ color: "#8b949e", fontSize: 12, marginBottom: 8, lineHeight: 1.5 }}>
                    {op.subtitle}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <code style={{
                      background: `${methodColor}22`,
                      border: `1px solid ${methodColor}`,
                      color: methodColor,
                      fontSize: 10,
                      padding: "2px 7px",
                      borderRadius: 4
                    }}>
                      {op.method}
                    </code>
                    <code style={{ color: "#79c0ff", fontSize: 11, background: "#161b22", padding: "2px 7px", borderRadius: 4, border: "1px solid #30363d" }}>
                      {op.endpoint}
                    </code>
                    <span style={S.badge(op.gasNote.includes("sin costo") ? "#1d4ed8" : "#16a34a")}>
                      {op.gasNote}
                    </span>
                  </div>
                  {missingId && (
                    <div style={{ color: "#ca8a04", fontSize: 11, marginTop: 8 }}>
                      ⚠ Ejecuta la op. 1 primero o ingresa un Episode ID arriba.
                    </div>
                  )}
                  {isError && results[op.id]?.errorMsg && (
                    <div style={{ color: "#f85149", fontSize: 11, marginTop: 8 }}>
                      ✗ {results[op.id]!.errorMsg}
                    </div>
                  )}
                </div>
                <button
                  disabled={disabled}
                  onClick={() => handlers[op.id]()}
                  style={S.btn(disabled)}
                >
                  {isLoading ? "⏳ Ejecutando…" : "▶ Ejecutar"}
                </button>
              </div>

              {/* Resultado inline de esta operación */}
              {activeResult === op.id && results[op.id] && !results[op.id]!.errorMsg && (
                <DemoTxResult
                  txData={results[op.id]!.txData}
                  rawResponse={results[op.id]!.rawResponse}
                />
              )}

              {/* Lista de eventos para historial */}
              {activeResult === op.id &&
                op.id === "historial" &&
                results.historial?.txData.traceEvents &&
                results.historial.txData.traceEvents.length > 0 && (
                  <div style={{ marginTop: 12, background: "#010409", border: "1px solid #21262d", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ padding: "8px 14px", background: "#161b22", borderBottom: "1px solid #21262d", color: "#6e7681", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Eventos registrados en cadena
                    </div>
                    {results.historial.txData.traceEvents.map((ev, i) => (
                      <div key={ev.traceId ?? i} style={{ padding: "8px 14px", borderBottom: "1px solid #0d1117", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div>
                          <span style={{ color: "#58a6ff", fontSize: 11, marginRight: 10 }}>{ev.eventType}</span>
                          <span style={{ color: "#6e7681", fontSize: 10 }}>{ev.actor?.rol ?? "—"}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {ev.evidence?.transactionHash && (
                            <a
                              href={ev.evidence.explorerUrl ?? `${EXPLORER_BASE}${ev.evidence.transactionHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#58a6ff", fontSize: 10, textDecoration: "none" }}
                            >
                              {ev.evidence.transactionHash.slice(0, 12)}… ↗
                            </a>
                          )}
                          <span style={{ color: "#6e7681", fontSize: 10 }}>
                            {new Date(ev.recordedAt).toLocaleTimeString("es-CO")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          );
        })}

        {/* ── Footer ── */}
        <div style={{ textAlign: "center", marginTop: 16, paddingTop: 16, borderTop: "1px solid #21262d" }}>
          <span style={{ color: "#30363d", fontSize: 10 }}>
            TX Demo Panel · InterHCE Ledger · Solo visible con VITE_DEMO_MODE=true
          </span>
          <span style={{ margin: "0 8px", color: "#30363d" }}>·</span>
          <Link to="/" style={{ color: "#58a6ff", fontSize: 10, textDecoration: "none" }}>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
