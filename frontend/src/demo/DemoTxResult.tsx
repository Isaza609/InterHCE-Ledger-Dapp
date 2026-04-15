/**
 * DemoTxResult.tsx — Card de resultado de operación blockchain para el TX Demo Panel.
 * Diseño "terminal/dark" para contrastar con la UI principal.
 * Solo debe importarse desde src/demo/.
 */
import { useState } from "react";
import type { TraceabilityEvent } from "@/shared/types/episodio";

export type TxStatus = "confirmed" | "pending" | "readonly";

export interface TxDisplayData {
  status: TxStatus;
  operationLabel: string;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  gasPriceWei?: string;
  confirmationMs?: number;
  timestamp?: string;
  explorerUrl?: string;
  ledgerMode?: string;
  network?: string;
  episodeId?: string;
  documentHash?: string;
  // Para operación de solo lectura (historial)
  totalEvents?: number;
  versiones?: number;
  permisosActivos?: number;
  traceEvents?: TraceabilityEvent[];
}

interface Props {
  txData: TxDisplayData;
  rawResponse?: unknown;
}

const STATUS_CONFIG: Record<TxStatus, { bg: string; border: string; text: string; dot: string; label: string }> = {
  confirmed: {
    bg: "rgba(22,163,74,0.12)",
    border: "#16a34a",
    text: "#4ade80",
    dot: "#16a34a",
    label: "Escritura Confirmada"
  },
  pending: {
    bg: "rgba(202,138,4,0.12)",
    border: "#ca8a04",
    text: "#facc15",
    dot: "#ca8a04",
    label: "Pendiente"
  },
  readonly: {
    bg: "rgba(29,78,216,0.12)",
    border: "#1d4ed8",
    text: "#60a5fa",
    dot: "#1d4ed8",
    label: "Solo Lectura · sin gas"
  }
};

function formatGas(gasUsed?: string, gasPriceWei?: string): string {
  if (!gasUsed) return "—";
  const g = parseInt(gasUsed, 10);
  const gasStr = isNaN(g) ? gasUsed : g.toLocaleString("es-CO") + " wei";
  if (!gasPriceWei) return gasStr;
  const price = parseInt(gasPriceWei, 10);
  if (isNaN(price)) return gasStr;
  const gwei = (price / 1e9).toFixed(2);
  return `${isNaN(g) ? gasUsed : g.toLocaleString("es-CO")} wei · ${gwei} Gwei/gas`;
}

function formatTimestamp(ts?: string): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "medium"
    });
  } catch {
    return ts;
  }
}

function shortenHash(hash: string, start = 10, end = 8): string {
  if (hash.length <= start + end + 3) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}

interface FieldProps {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}

function Field({ label, value, mono, highlight }: FieldProps) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: "#6e7681", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{
        color: highlight ? "#f0f6fc" : (mono ? "#79c0ff" : "#c9d1d9"),
        fontSize: 12,
        fontFamily: mono ? "'Courier New', 'Fira Code', monospace" : "inherit",
        wordBreak: "break-all"
      }}>
        {value}
      </div>
    </div>
  );
}

export function DemoTxResult({ txData, rawResponse }: Props) {
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const cfg = STATUS_CONFIG[txData.status];

  const copyHash = async () => {
    if (!txData.txHash) return;
    try {
      await navigator.clipboard.writeText(txData.txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div style={{
      fontFamily: "'Courier New', 'Fira Code', 'Cascadia Code', monospace",
      background: "#0d1117",
      border: `1px solid ${cfg.border}`,
      borderRadius: 10,
      padding: "20px 24px",
      marginTop: 20,
      boxShadow: `0 0 20px ${cfg.bg}`
    }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #21262d" }}>
        <div>
          <div style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
            RESULTADO DE OPERACIÓN
          </div>
          <div style={{ color: "#e6edf3", fontSize: 14, fontWeight: 700 }}>
            {txData.operationLabel}
          </div>
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: 20,
          padding: "4px 12px"
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, display: "inline-block", boxShadow: `0 0 6px ${cfg.dot}` }} />
          <span style={{ color: cfg.text, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* ── TX Hash ── */}
      {txData.txHash && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "#161b22", borderRadius: 6, border: "1px solid #30363d" }}>
          <div style={{ color: "#6e7681", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
            TX HASH
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <code style={{ color: "#58a6ff", fontSize: 12, flex: 1, minWidth: 0, wordBreak: "break-all" }}>
              {txData.txHash}
            </code>
            <button
              onClick={copyHash}
              style={{
                background: copied ? "rgba(63,185,80,0.15)" : "#21262d",
                border: `1px solid ${copied ? "#3fb950" : "#30363d"}`,
                color: copied ? "#3fb950" : "#8b949e",
                borderRadius: 5,
                padding: "3px 10px",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                transition: "all 0.15s"
              }}
            >
              {copied ? "✓ Copiado" : "📋 Copiar"}
            </button>
          </div>
        </div>
      )}

      {/* ── Write fields (txHash present) ── */}
      {txData.txHash && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px 24px", marginBottom: 16 }}>
          <Field label="Bloque" value={txData.blockNumber != null ? `#${txData.blockNumber.toLocaleString()}` : "—"} highlight />
          <Field label="Gas Usado" value={formatGas(txData.gasUsed, txData.gasPriceWei)} />
          <Field label="Confirmación" value={txData.confirmationMs != null ? `${txData.confirmationMs.toLocaleString()} ms` : "—"} />
          <Field label="Timestamp" value={formatTimestamp(txData.timestamp)} />
          <Field label="Red" value={txData.network ?? "—"} />
          <Field label="Ledger Mode" value={txData.ledgerMode ?? "—"} />
          {txData.episodeId && (
            <Field label="Episode ID" value={shortenHash(txData.episodeId, 8, 6)} mono />
          )}
          {txData.documentHash && (
            <Field label="Document Hash" value={shortenHash(txData.documentHash, 10, 8)} mono />
          )}
        </div>
      )}

      {/* ── Read-only fields (no txHash) ── */}
      {!txData.txHash && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px 24px", marginBottom: 16 }}>
          {txData.episodeId && <Field label="Episode ID" value={shortenHash(txData.episodeId, 8, 6)} mono />}
          {txData.totalEvents != null && <Field label="Eventos de Traza" value={`${txData.totalEvents} evento(s)`} highlight />}
          {txData.versiones != null && <Field label="Versiones" value={`v${txData.versiones}`} />}
          {txData.permisosActivos != null && <Field label="Permisos Activos" value={`${txData.permisosActivos} IPS`} />}
          {txData.network && <Field label="Red" value={txData.network} />}
        </div>
      )}

      {/* ── Etherscan link ── */}
      {txData.explorerUrl && (
        <div style={{ paddingTop: 12, borderTop: "1px solid #21262d", marginBottom: 4 }}>
          <a
            href={txData.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#58a6ff",
              fontSize: 13,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 0"
            }}
          >
            <span>🔍</span>
            <span>Ver transacción en Sepolia Etherscan</span>
            <span style={{ opacity: 0.6 }}>↗</span>
          </a>
        </div>
      )}

      {/* ── Raw JSON toggle ── */}
      {rawResponse !== undefined && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #161b22" }}>
          <button
            onClick={() => setShowRaw(!showRaw)}
            style={{
              background: "transparent",
              border: "none",
              color: "#6e7681",
              fontSize: 11,
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit"
            }}
          >
            {showRaw ? "▾ Ocultar JSON completo" : "▸ Ver respuesta completa (JSON)"}
          </button>
          {showRaw && (
            <pre style={{
              marginTop: 8,
              background: "#010409",
              border: "1px solid #21262d",
              borderRadius: 6,
              padding: "12px 14px",
              color: "#e6edf3",
              fontSize: 11,
              overflow: "auto",
              maxHeight: 320,
              lineHeight: 1.5
            }}>
              {JSON.stringify(rawResponse, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
