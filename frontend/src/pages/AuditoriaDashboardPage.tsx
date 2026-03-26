/**
 * RF10 — Módulo de evaluación de desempeño de la DApp
 *
 * Estructura de la página:
 *   Sección A — Pruebas de estrés de red (pandoras-box / simulación)
 *               Mide el desempeño de la red blockchain: TPS, latencia, gas y seguridad.
 *   Sección B — Evaluación de interoperabilidad clínica (HU0-HU5)
 *               Mide cómo la DApp gestiona episodios entre múltiples IPS.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSesion } from "@/shared/auth/SessionContext";
import {
  listarAuditMetricas,
  obtenerAuditMetrica,
  ejecutarAuditRun,
  obtenerDashboardEvaluacion,
  iniciarSesionEvaluacion,
  obtenerSesionEvaluacion,
  type AuditMetricResumen,
  type AuditMetricDetalle,
  type AuditRunConfigFrontend,
  type ModoPrueba,
  type BlockSampleFrontend,
  type DashboardEvaluacionPrototipo,
  type EvaluacionSesion
} from "@/shared/services/api";

// ═════════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═════════════════════════════════════════════════════════════════════════════

function fNum(v?: number, d = 2): string {
  if (typeof v !== "number" || isNaN(v)) return "—";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: d }).format(v);
}
function fMs(v?: number): string {
  if (typeof v !== "number" || isNaN(v) || v === 0) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(2)} s`;
  return `${v.toFixed(0)} ms`;
}
function fPct(v?: number): string {
  if (typeof v !== "number" || isNaN(v)) return "—";
  return `${v.toFixed(1)} %`;
}
function fDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}
function fChainId(id: number): string {
  const m: Record<number, string> = {
    1: "Ethereum", 11155111: "Sepolia", 137: "Polygon",
    56: "BSC", 42161: "Arbitrum", 0: "Local / desconocida"
  };
  return m[id] ?? `Chain ${id}`;
}

type Color = "verde" | "amarillo" | "rojo";

// ═════════════════════════════════════════════════════════════════════════════
// GENERACIÓN DE INFORME PDF
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Genera un informe HTML completo y lo abre en una ventana nueva para imprimir
 * (Ctrl+P → "Guardar como PDF" en el diálogo de impresión del navegador).
 * No requiere librerías externas.
 */
function descargarInformePDF(r: AuditMetricDetalle): void {
  const fN = (v?: number, d = 2) =>
    typeof v === "number" && !isNaN(v) ? v.toFixed(d) : "—";
  const fP = (v?: number) => (typeof v === "number" && !isNaN(v) ? `${v.toFixed(1)} %` : "—");
  const fMsR = (v?: number) => {
    if (typeof v !== "number" || isNaN(v) || v === 0) return "—";
    return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v.toFixed(0)} ms`;
  };
  const fDateR = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("es-CO") : "—";
  const chainName: Record<number, string> = {
    1: "Ethereum", 11155111: "Sepolia", 137: "Polygon", 56: "BSC", 42161: "Arbitrum", 0: "Local"
  };
  const semColor = (s: Color) =>
    s === "verde" ? "#27ae60" : s === "amarillo" ? "#e67e22" : "#c0392b";
  const semLabel = (s: Color) =>
    s === "verde" ? "Óptimo" : s === "amarillo" ? "Aceptable" : "Crítico";

  const row = (k: string, v: string) =>
    `<tr><td style="color:#555;padding:3px 8px 3px 0">${k}</td><td style="font-weight:500;padding:3px 0">${v}</td></tr>`;
  const sec = (title: string, rows: string) =>
    `<div style="margin-bottom:20px"><h3 style="font-size:13px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px">${title}</h3><table style="width:100%;border-collapse:collapse;font-size:12px">${rows}</table></div>`;
  const badge = (s: Color, label: string, val: string) =>
    `<div style="display:inline-block;margin-right:16px;text-align:center"><div style="background:${semColor(s)};color:#fff;border-radius:12px;padding:2px 10px;font-size:11px">${semLabel(s)}</div><div style="font-size:13px;font-weight:600;margin-top:3px">${val}</div><div style="font-size:11px;color:#888">${label}</div></div>`;

  const interop = r.interoperabilityDetails;
  const umbral = `Verde ≤ 15 s · Amarillo ≤ 30 s · Rojo > 30 s (1 bloque EVM ≈ 12–15 s)`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Informe de Evaluación — ${r.id.slice(0, 8)}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:13px;color:#222;margin:32px;line-height:1.5}
    h1{font-size:18px;margin-bottom:4px}
    h2{font-size:15px;margin:24px 0 8px;border-bottom:2px solid #4f8ef7;padding-bottom:4px;color:#4f8ef7}
    @media print{body{margin:20px}.no-print{display:none}}
  </style>
</head>
<body>
  <div class="no-print" style="background:#eef4ff;padding:10px 16px;border-radius:8px;margin-bottom:20px;font-size:12px">
    <strong>Imprimir como PDF:</strong> Usa Ctrl+P (o Cmd+P) → selecciona "Guardar como PDF" → Guardar.
  </div>

  <h1>Informe de Evaluación de Desempeño Blockchain</h1>
  <p style="color:#666;font-size:12px;margin-top:0">
    InterHCE Ledger · Generado el ${new Date().toLocaleString("es-CO")} · ID: ${r.id}
  </p>

  <h2>1. Resumen</h2>
  ${sec("Identificación", [
    row("ID evaluación", r.id),
    row("Fecha y hora", fDateR(r.timestamp)),
    row("Modo de prueba", r.modo),
    row("Red (chainId)", `${chainName[r.chainId] ?? `Chain ${r.chainId}`} (${r.chainId})`),
    row("Nodo RPC", r.rpcUrl),
    row("Fuente", r.fuente === "pandoras-box" ? "Ejecución real con pandoras-box" : "Simulación con datos del nodo RPC"),
    row("Contrato", r.contractAddress ?? "N/A"),
  ].join(""))}

  <div style="margin-bottom:20px">
    <h3 style="font-size:13px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:12px">Semáforos de evaluación</h3>
    ${badge(r.semaforoEficiencia, "Eficiencia", `${fN(r.tpsPromedio)} TPS`)}
    ${badge(r.semaforoLatencia, "Latencia", fMsR(r.latenciaPromedioMs))}
    ${badge(r.semaforoSeguridad, "Seguridad", fP(r.tasaExito))}
    ${badge(r.semaforoInteroperabilidad, "Interop. EVM", interop?.nodoAccesible ? "Nodo OK" : "Sin acceso")}
  </div>

  <h2>2. Métricas de eficiencia (TPS)</h2>
  ${sec("Throughput", [
    row("TPS promedio", fN(r.tpsPromedio)),
    row("TPS pico", fN(r.tpsPico)),
    row("Total transacciones", fN(r.totalTransacciones, 0)),
    row("Transacciones exitosas", fN(r.transaccionesExitosas, 0)),
    row("Transacciones fallidas", fN(r.transaccionesFallidas, 0)),
    row("Umbral verde ≥", "10 TPS · Amarillo ≥ 5 TPS"),
  ].join(""))}

  <h2>3. Latencia de confirmación</h2>
  ${sec("Tiempos de confirmación en bloque", [
    row("Latencia promedio", fMsR(r.latenciaPromedioMs)),
    row("Latencia mínima", fMsR(r.latenciaMinMs)),
    row("Latencia máxima", fMsR(r.latenciaMaxMs)),
    row("Latencia P95", fMsR(r.latenciaP95Ms)),
    row("Block time promedio", `${r.blockTimePromedioSeg?.toFixed(2)} s`),
    row("Bloques observados", String(r.bloquesObservados)),
    row("Umbrales aplicados", umbral),
  ].join(""))}

  <h2>4. Gas</h2>
  ${sec("Consumo de gas", [
    row("Gas promedio / tx", fN(r.gasUsadoPromedio, 0)),
    row("Gas máximo / tx", fN(r.gasUsadoMax, 0)),
    row("Gas limit del bloque", fN(r.gasLimit, 0)),
    row("Utilización de bloque", fP(r.gasUtilizacionPct)),
  ].join(""))}

  <h2>5. Seguridad y tasa de éxito</h2>
  ${sec("Resultados de transacciones", [
    row("Tasa de éxito", fP(r.tasaExito)),
    row("Transacciones revertidas", fN(r.transaccionesRevertidas, 0)),
    row("Out-of-gas", fN(r.transaccionesOutOfGas, 0)),
    row("Tiempo respuesta nodo bajo carga", fMsR(r.tiempoRespuestaNodoMs)),
    row("Umbral verde ≥ 95 % · Amarillo ≥ 80 %", ""),
  ].join(""))}

  <h2>6. Interoperabilidad EVM / HCE</h2>
  ${sec("Verificación de compatibilidad", [
    row("Nodo EVM accesible", interop?.nodoAccesible ? "✓ Sí" : "✗ No"),
    row("Contrato accesible", interop?.contratoAccesible ? "✓ Sí" : r.modo === "EOA" ? "N/A (sin contrato)" : "✗ No"),
    row("Llamadas read/view OK", interop?.readCallsOk ? "✓ OK" : "✗ Error"),
    row("Escrituras OK", interop?.writeCallsOk ? "✓ OK" : "✗ Sin confirmar"),
    row("Compatibilidad ERC declarada", interop?.compatibilidadERC ?? r.modo),
    row("ChainId verificado", String(interop?.chainId ?? r.chainId)),
    ...(r.modo !== "EOA" ? [
      row("Deploy exitoso", r.deployExitoso ? "✓ Sí" : "✗ No"),
      row("Llamadas ERC exitosas", fN(r.llamadasERCExitosas, 0)),
      row("Total llamadas ERC", fN(r.llamadasERCTotal, 0)),
      row("Tasa ERC", r.llamadasERCTotal > 0 ? fP((r.llamadasERCExitosas / r.llamadasERCTotal) * 100) : "—"),
    ] : []),
  ].join(""))}
  ${interop?.nota ? `<p style="font-size:11px;color:#555;background:#f5f5f5;padding:8px;border-radius:4px">${interop.nota}</p>` : ""}

  <div style="margin-top:32px;border-top:1px solid #ddd;padding-top:12px;font-size:11px;color:#aaa">
    Generado por InterHCE Ledger — Sistema de interoperabilidad de HCE sobre blockchain EVM.<br/>
    Este informe corresponde a la evaluación ID <strong>${r.id}</strong> ejecutada el ${fDateR(r.timestamp)}.
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("No se pudo abrir la ventana del informe. Desbloquea las ventanas emergentes para este sitio.");
    return;
  }
  win.document.write(html);
  win.document.close();
  // Pequeño delay para que el navegador termine de renderizar antes del diálogo de impresión
  setTimeout(() => win.print(), 500);
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTES BASE
// ═════════════════════════════════════════════════════════════════════════════

function SemaforoBadge({
  color, label, valor
}: { color: Color; label: string; valor: string }) {
  const cls =
    color === "verde" ? "status-chip status-chip--ready" :
    color === "amarillo" ? "status-chip status-chip--alert" :
    "status-chip status-chip--error";
  const dot = color === "verde" ? "🟢" : color === "amarillo" ? "🟡" : "🔴";
  return (
    <div style={{ textAlign: "center", minWidth: 90 }}>
      <div className={cls} style={{ fontSize: "0.75rem", marginBottom: 4 }}>
        {dot} {color === "verde" ? "Óptimo" : color === "amarillo" ? "Aceptable" : "Crítico"}
      </div>
      <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{valor}</div>
      <div style={{ fontSize: "0.72rem", color: "#888", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MiniBarChart({
  data, valueKey, label, color = "#4f8ef7"
}: {
  data: BlockSampleFrontend[];
  valueKey: keyof BlockSampleFrontend;
  label: string;
  color?: string;
}) {
  if (!data.length) return null;
  const values = data.map((d) => Number(d[valueKey]));
  const max = Math.max(...values, 0.001);
  const W = 220; const H = 52;
  const bw = Math.max(2, Math.floor((W - data.length) / data.length));
  return (
    <div>
      <div style={{ fontSize: "0.7rem", color: "#888", marginBottom: 3 }}>{label}</div>
      <svg width={W} height={H}>
        {values.map((v, i) => {
          const h = Math.max(2, (v / max) * (H - 4));
          return (
            <rect key={i} x={i * (bw + 1)} y={H - h - 2}
              width={bw} height={h} fill={color} opacity={0.8} />
          );
        })}
      </svg>
    </div>
  );
}

function MetricCard({
  title, rows, note
}: { title: string; rows: [string, string][]; note?: string }) {
  return (
    <article className="metric-card">
      <strong style={{ fontSize: "0.82rem", marginBottom: 6, display: "block" }}>{title}</strong>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between",
          fontSize: "0.82rem", gap: 8, borderBottom: "1px solid #f0f0f0", padding: "3px 0" }}>
          <span style={{ color: "#666" }}>{k}</span>
          <span style={{ fontWeight: 500 }}>{v}</span>
        </div>
      ))}
      {note && <p style={{ fontSize: "0.72rem", color: "#aaa", marginTop: 6 }}>{note}</p>}
    </article>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PANEL DETALLE DE UNA EVALUACIÓN (expandible en la tabla)
// ═════════════════════════════════════════════════════════════════════════════

function PanelDetalle({ r }: { r: AuditMetricDetalle }) {
  return (
    <div style={{ padding: "12px 0" }}>

      {/* Semáforos resumen */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap",
        background: "#f8f9fa", borderRadius: 8, padding: "14px 20px",
        marginBottom: 14, alignItems: "center" }}>
        <div style={{ fontSize: "0.78rem", color: "#555", flex: 1, minWidth: 160 }}>
          <strong>{r.modo}</strong> · {fChainId(r.chainId)} · {fDate(r.timestamp)}<br/>
          <span style={{ color: "#aaa", fontSize: "0.7rem" }}>{r.fuente === "pandoras-box" ? "🔴 Ejecución real con pandoras-box" : "🔵 Simulación con datos del nodo RPC"}</span>
        </div>
        <SemaforoBadge color={r.semaforoEficiencia}   label="Eficiencia"      valor={`${fNum(r.tpsPromedio)} TPS`} />
        <SemaforoBadge color={r.semaforoLatencia}     label="Latencia"        valor={fMs(r.latenciaPromedioMs)} />
        <SemaforoBadge color={r.semaforoSeguridad}    label="Seguridad"       valor={fPct(r.tasaExito)} />
        <SemaforoBadge color={r.semaforoInteroperabilidad} label="Interop. ERC" valor={r.modo === "EOA" ? "N/A" : r.deployExitoso ? "Deploy OK" : "Deploy ✗"} />
        <button
          type="button"
          className="btn btn--ghost"
          style={{ fontSize: "0.78rem", padding: "4px 12px", alignSelf: "center", whiteSpace: "nowrap" }}
          onClick={() => descargarInformePDF(r)}
        >
          ⬇ Descargar informe PDF
        </button>
      </div>

      {/* Tarjetas de métricas agrupadas por eje */}
      <div className="dashboard-grid" style={{ marginBottom: 14 }}>
        <MetricCard title="① Eficiencia (TPS)" rows={[
          ["TPS promedio", fNum(r.tpsPromedio)],
          ["TPS pico",     fNum(r.tpsPico)],
          ["Duración de prueba", r.blockTimePromedioSeg > 0
            ? `${(r.totalTransacciones / r.tpsPromedio).toFixed(1)} s` : "—"],
          ["Transacciones totales", fNum(r.totalTransacciones, 0)],
        ]} />

        <MetricCard title="② Latencia de confirmación" rows={[
          ["Promedio",  fMs(r.latenciaPromedioMs)],
          ["Mínima",    fMs(r.latenciaMinMs)],
          ["Máxima",    fMs(r.latenciaMaxMs)],
          ["P95",       fMs(r.latenciaP95Ms)],
        ]} note="Tiempo desde que se envía la tx hasta que queda en bloque." />

        <MetricCard title="③ Seguridad" rows={[
          ["Tasa de éxito",           fPct(r.tasaExito)],
          ["Tx exitosas",             fNum(r.transaccionesExitosas, 0)],
          ["Tx fallidas",             fNum(r.transaccionesFallidas, 0)],
          ["Revertidas (revert)",     fNum(r.transaccionesRevertidas, 0)],
          ["Out-of-gas",              fNum(r.transaccionesOutOfGas, 0)],
          ["Resp. nodo bajo carga",   fMs(r.tiempoRespuestaNodoMs)],
        ]} />

        <MetricCard title="④ Gas" rows={[
          ["Gas promedio / tx",  fNum(r.gasUsadoPromedio, 0)],
          ["Gas máximo / tx",    fNum(r.gasUsadoMax, 0)],
          ["Utilización de bloque", fPct(r.gasUtilizacionPct)],
        ]} />

        <MetricCard title="⑤ Bloques" rows={[
          ["Blocktime promedio", `${r.blockTimePromedioSeg.toFixed(2)} s`],
          ["Bloques observados", String(r.bloquesObservados)],
          ["Red (chainId)",      fChainId(r.chainId)],
          ["Nodo RPC",           r.rpcUrl.length > 35 ? r.rpcUrl.slice(0, 35) + "…" : r.rpcUrl],
        ]} />

        {/* Interoperabilidad — visible para todos los modos */}
        <MetricCard
          title="⑥ Interoperabilidad EVM / HCE"
          rows={[
            ["Modo",                r.modo],
            ["Nodo accesible",      r.interoperabilityDetails?.nodoAccesible ? "✓ Sí" : "✗ No"],
            ["Contrato accesible",  r.interoperabilityDetails?.contratoAccesible ? "✓ Sí"
              : r.modo === "EOA" ? "N/A (sin contrato)" : "✗ No"],
            ["Lecturas (read/view)", r.interoperabilityDetails?.readCallsOk ? "✓ OK" : "✗ Error"],
            ["Escrituras (write)",  r.interoperabilityDetails?.writeCallsOk ? "✓ OK" : "✗ Sin confirmar"],
            ...(r.modo !== "EOA" ? ([
              ["Deploy exitoso",    r.deployExitoso ? "✓ Sí" : "✗ No"] as [string, string],
              ["Llamadas ERC OK",   fNum(r.llamadasERCExitosas, 0)] as [string, string],
              ["Total llamadas ERC",fNum(r.llamadasERCTotal, 0)] as [string, string],
              ["Tasa ERC",          r.llamadasERCTotal > 0
                ? fPct((r.llamadasERCExitosas / r.llamadasERCTotal) * 100) : "—"] as [string, string],
            ] as [string, string][]) : []),
            ["Compatibilidad",      r.interoperabilityDetails?.compatibilidadERC ?? r.modo],
          ]}
          note={r.interoperabilityDetails?.nota ?? (
            r.modo === "EOA"
              ? "EOA: solo transferencias ETH. Para evaluar compatibilidad con InterHCELedger use modo ERC20/ERC721."
              : undefined
          )}
        />
      </div>

      {/* Gráficas por bloque */}
      {r.blockSamples.length > 0 && (
        <div>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: 10, color: "#555" }}>
            Evolución por bloque
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <MiniBarChart data={r.blockSamples} valueKey="tps"                label="TPS / bloque"          color="#4f8ef7" />
            <MiniBarChart data={r.blockSamples} valueKey="tx_count"           label="Tx / bloque"           color="#bb6fef" />
            <MiniBarChart data={r.blockSamples} valueKey="gas_used"           label="Gas usado / bloque"    color="#f7a74f" />
            <MiniBarChart data={r.blockSamples} valueKey="block_time_seconds" label="Blocktime (s) / bloque" color="#6fcf97" />
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FORMULARIO DE NUEVA EVALUACIÓN
// ═════════════════════════════════════════════════════════════════════════════

// Umbrales de latencia realistas para redes EVM (PoA/PoS ≈ 12 s por bloque):
//   Verde ≤ 15 000 ms (1 bloque típico), Amarillo ≤ 30 000 ms (≤ 2 bloques).
const CONFIG_DEFAULT: AuditRunConfigFrontend = {
  rpcUrl: "", modo: "EOA", totalTransacciones: 100, numSubcuentas: 5,
  contractAddress: "", mnemonic: "", batchSize: 20,
  umbralTpsVerde: 10, umbralTpsAmarillo: 5,
  umbralLatenciaVerdeMs: 15_000, umbralLatenciaAmarilloMs: 30_000,
  umbralTasaExitoVerde: 95
};

function FormularioEvaluacion({
  onSubmit, running, onCancelar
}: {
  onSubmit: (c: AuditRunConfigFrontend) => void;
  running: boolean;
  onCancelar: () => void;
}) {
  const [cfg, setCfg] = useState<AuditRunConfigFrontend>({ ...CONFIG_DEFAULT });
  const [mostrarAvanzado, setMostrarAvanzado] = useState(false);

  function set<K extends keyof AuditRunConfigFrontend>(k: K, v: AuditRunConfigFrontend[K]) {
    setCfg((p) => ({ ...p, [k]: v }));
  }

  return (
    <section className="card card--elevated" style={{ marginBottom: 16 }}>
      {/* Explicación */}
      <div style={{ background: "#eef4ff", borderRadius: 8, padding: "10px 14px",
        marginBottom: 14, fontSize: "0.83rem", lineHeight: 1.55 }}>
        <strong>¿Qué hace esta prueba?</strong><br/>
        Envía transacciones reales a la red blockchain usando <strong>pandoras-box</strong>
        {" "}(si se configura un mnemonic con fondos en Sepolia) o genera una simulación realista
        consultando el nodo RPC para medir TPS, latencia y gas en la red objetivo.
        El resultado queda guardado en el historial de evaluaciones.
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onSubmit(cfg); }}>
        <h3 style={{ fontSize: "0.92rem", fontWeight: 600, marginBottom: 12 }}>
          Configurar nueva prueba de estrés
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <label className="form-field">
            <span className="form-label">URL del nodo RPC *</span>
            <input className="form-input" type="url" required
              placeholder="https://rpc.sepolia.org"
              value={cfg.rpcUrl}
              onChange={(e) => set("rpcUrl", e.target.value)} />
            <small style={{ color: "#888", fontSize: "0.72rem" }}>
              Ejemplo Sepolia: https://eth-sepolia.g.alchemy.com/v2/&lt;key&gt;
            </small>
          </label>

          <label className="form-field">
            <span className="form-label">Modo de prueba *</span>
            <select className="form-input" value={cfg.modo}
              onChange={(e) => set("modo", e.target.value as ModoPrueba)}>
              <option value="EOA">EOA — transferencias ETH simples</option>
              <option value="ERC20">ERC20 — token fungible (requiere fondos)</option>
              <option value="ERC721">ERC721 — NFT / token no fungible (requiere fondos)</option>
            </select>
          </label>

          <label className="form-field">
            <span className="form-label">Total de transacciones *</span>
            <input className="form-input" type="number" min={1} max={10000} required
              value={cfg.totalTransacciones}
              onChange={(e) => set("totalTransacciones", Number(e.target.value))} />
          </label>

          <label className="form-field">
            <span className="form-label">Número de subcuentas *</span>
            <input className="form-input" type="number" min={1} max={100} required
              value={cfg.numSubcuentas}
              onChange={(e) => set("numSubcuentas", Number(e.target.value))} />
            <small style={{ color: "#888", fontSize: "0.72rem" }}>
              Cuentas que enviarán transacciones en paralelo.
            </small>
          </label>

          <label className="form-field" style={{ gridColumn: "1 / -1" }}>
            <span className="form-label">
              Mnemonic BIP-39 (12 palabras){" "}
              <span style={{ color: "#4f8ef7", fontSize: "0.72rem" }}>
                — requerido para ejecución real con pandoras-box
              </span>
            </span>
            <input className="form-input" type="password"
              placeholder="word1 word2 word3 … word12"
              value={cfg.mnemonic ?? ""}
              onChange={(e) => set("mnemonic", e.target.value || undefined)} />
            <small style={{ color: "#888", fontSize: "0.72rem" }}>
              La primera dirección del mnemonic debe tener ETH en la red seleccionada
              para distribuirlo a las subcuentas. Sin mnemonic se usará la simulación.
            </small>
          </label>
        </div>

        {/* Opciones avanzadas */}
        <div style={{ marginBottom: 12 }}>
          <button type="button" className="btn btn--ghost"
            style={{ fontSize: "0.8rem", padding: "4px 10px" }}
            onClick={() => setMostrarAvanzado((v) => !v)}>
            {mostrarAvanzado ? "▲ Ocultar opciones avanzadas" : "▼ Mostrar opciones avanzadas"}
          </button>
        </div>

        {mostrarAvanzado && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10,
            marginBottom: 14, background: "#fafafa", padding: 12, borderRadius: 8 }}>
            {cfg.modo !== "EOA" && (
              <label className="form-field" style={{ gridColumn: "1 / -1" }}>
                <span className="form-label">Dirección del contrato (ERC20/ERC721)</span>
                <input className="form-input" type="text" placeholder="0x... (opcional, pandoras-box lo despliega automáticamente)"
                  value={cfg.contractAddress ?? ""}
                  onChange={(e) => set("contractAddress", e.target.value || undefined)} />
              </label>
            )}
            <label className="form-field">
              <span className="form-label">Tamaño de lote JSON-RPC</span>
              <input className="form-input" type="number" min={1} max={5000}
                value={cfg.batchSize ?? 20}
                onChange={(e) => set("batchSize", Number(e.target.value))} />
            </label>
            <label className="form-field">
              <span className="form-label">Umbral TPS verde ≥</span>
              <input className="form-input" type="number" min={0}
                value={cfg.umbralTpsVerde ?? 10}
                onChange={(e) => set("umbralTpsVerde", Number(e.target.value))} />
            </label>
            <label className="form-field">
              <span className="form-label">Umbral TPS amarillo ≥</span>
              <input className="form-input" type="number" min={0}
                value={cfg.umbralTpsAmarillo ?? 5}
                onChange={(e) => set("umbralTpsAmarillo", Number(e.target.value))} />
            </label>
            <label className="form-field">
              <span className="form-label">Latencia verde ≤ (ms) <span style={{color:"#888",fontSize:"0.7rem"}}>— 1 bloque EVM ≈ 15 000</span></span>
              <input className="form-input" type="number" min={0}
                value={cfg.umbralLatenciaVerdeMs ?? 15_000}
                onChange={(e) => set("umbralLatenciaVerdeMs", Number(e.target.value))} />
            </label>
            <label className="form-field">
              <span className="form-label">Latencia amarillo ≤ (ms) <span style={{color:"#888",fontSize:"0.7rem"}}>— 2 bloques ≈ 30 000</span></span>
              <input className="form-input" type="number" min={0}
                value={cfg.umbralLatenciaAmarilloMs ?? 30_000}
                onChange={(e) => set("umbralLatenciaAmarilloMs", Number(e.target.value))} />
            </label>
            <label className="form-field">
              <span className="form-label">Tasa de éxito verde ≥ (%)</span>
              <input className="form-input" type="number" min={0} max={100}
                value={cfg.umbralTasaExitoVerde ?? 95}
                onChange={(e) => set("umbralTasaExitoVerde", Number(e.target.value))} />
            </label>
          </div>
        )}

        <div className="btn-group">
          <button type="submit" className="btn btn--primary" disabled={running}>
            {running ? "Ejecutando prueba… (puede tardar varios minutos en Sepolia)" : "Ejecutar prueba"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancelar} disabled={running}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PANEL DE SESIÓN DE EVALUACIÓN
// ═════════════════════════════════════════════════════════════════════════════

function PanelSesion({
  sesionActual,
  onNuevaSesion,
  iniciando
}: {
  sesionActual: EvaluacionSesion | null;
  onNuevaSesion: () => void;
  iniciando: boolean;
}) {
  return (
    <div style={{
      background: "#f0f4ff", borderRadius: 8, padding: "10px 16px",
      marginBottom: 14, display: "flex", alignItems: "center",
      gap: 16, flexWrap: "wrap", fontSize: "0.82rem"
    }}>
      <div style={{ flex: 1 }}>
        <strong>Sesión de evaluación activa: </strong>
        {sesionActual ? (
          <span>
            <code style={{ background: "#e8eeff", padding: "1px 6px", borderRadius: 4 }}>
              {sesionActual.label}
            </code>
            {" "}— iniciada el {fDate(sesionActual.startedAt)}
            <span style={{ color: "#aaa", fontSize: "0.72rem", marginLeft: 8 }}>
              (ID: {sesionActual.id.slice(0, 8)}…)
            </span>
          </span>
        ) : (
          <span style={{ color: "#999" }}>Sin sesión activa — se muestran todas las métricas.</span>
        )}
      </div>
      <button
        type="button"
        className="btn btn--secondary"
        style={{ fontSize: "0.78rem", padding: "4px 12px" }}
        onClick={onNuevaSesion}
        disabled={iniciando}
        title="Marca el momento actual como inicio de nueva sesión. Las pruebas ejecutadas a partir de ahora quedarán asociadas a esta sesión."
      >
        {iniciando ? "Iniciando…" : "Iniciar nueva sesión"}
      </button>
      <span style={{ color: "#888", fontSize: "0.7rem", maxWidth: 260 }}>
        ℹ️ Inicia un punto de partida sin borrar el historial. Filtra las métricas por sesión con el selector de abajo.
      </span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN A — PRUEBAS DE ESTRÉS DE RED (RF10)
// ═════════════════════════════════════════════════════════════════════════════

function SeccionRedBlockchain() {
  const { sesion } = useSesion();
  const [lista, setLista] = useState<AuditMetricResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<AuditMetricDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // Sesión de evaluación
  const [sesionActual, setSesionActual] = useState<EvaluacionSesion | null>(null);
  const [iniciandoSesion, setIniciandoSesion] = useState(false);
  const [filtroSesion, setFiltroSesion] = useState<"todas" | "actual">("todas");

  async function cargar() {
    setLoading(true);
    const r = await listarAuditMetricas(sesion);
    setLista(r.data ?? []);
    if (!r.ok) setError(r.message);
    setLoading(false);
  }

  async function cargarSesion() {
    const r = await obtenerSesionEvaluacion(sesion);
    if (r.ok) setSesionActual(r.data ?? null);
  }

  async function handleNuevaSesion() {
    setIniciandoSesion(true);
    const r = await iniciarSesionEvaluacion(sesion);
    setIniciandoSesion(false);
    if (r.ok && r.data) {
      setSesionActual(r.data);
      setFiltroSesion("actual");
    }
  }

  async function toggleDetalle(id: string) {
    if (expandedId === id) { setExpandedId(null); setDetalle(null); return; }
    setExpandedId(id);
    setLoadingDetalle(true);
    setDetalle(null);
    const r = await obtenerAuditMetrica(id, sesion);
    if (r.ok && r.data) setDetalle(r.data);
    setLoadingDetalle(false);
  }

  async function handleRun(cfg: AuditRunConfigFrontend) {
    setRunning(true);
    setRunMsg(null);
    setRunError(null);
    const r = await ejecutarAuditRun(cfg, sesion);
    setRunning(false);
    if (!r.ok) { setRunError(r.message); return; }
    const fuenteLabel = r.fuente === "pandoras-box"
      ? "🔴 ejecución real con pandoras-box"
      : "🔵 simulación (datos del nodo RPC)";
    const advertenciaMsg = r.advertencia
      ? `\n⚠️ pandoras-box no pudo ejecutarse → se usó simulación.\nDetalle: ${r.advertencia}`
      : "";
    setRunMsg(`Prueba completada · ${fuenteLabel} · ID guardado en historial.${advertenciaMsg}`);
    setMostrarForm(false);
    await cargar();
    if (r.data) {
      setExpandedId(r.data.id);
      setDetalle(r.data);
      // Scroll al resultado
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    }
  }

  useEffect(() => { void cargar(); void cargarSesion(); }, [sesion]);

  // Aplicar filtro de sesión sobre la lista cargada
  const listaFiltrada = filtroSesion === "actual" && sesionActual
    ? lista.filter((r) =>
        (r as AuditMetricResumen & { sesionId?: string }).sesionId === sesionActual.id ||
        new Date(r.timestamp) >= new Date(sesionActual.startedAt)
      )
    : lista;

  const optimos = listaFiltrada.filter((r) =>
    r.semaforoEficiencia === "verde" && r.semaforoSeguridad === "verde").length;

  return (
    <section className="card card--elevated" style={{ marginBottom: 16 }}>
      {/* Cabecera de la sección */}
      <div className="section-head section-head--tight" style={{ marginBottom: 0 }}>
        <div>
          <h2 className="section-title">
            Sección A — Pruebas de estrés de la red blockchain
          </h2>
          <p className="section-copy" style={{ maxWidth: 680 }}>
            Mide el <strong>rendimiento real de la red</strong> enviando transacciones con
            <strong> pandoras-box</strong>. Evalúa los tres ejes del RF10:
            eficiencia (TPS), latencia de confirmación y seguridad (tasa de éxito, reverts, gas).
            Cada prueba queda registrada con semáforos automáticos.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          {lista.length > 0 && (
            <div className="context-note" style={{ fontSize: "0.8rem" }}>
              <span>{listaFiltrada.length} prueba(s)</span>
              {optimos > 0 && <span style={{ color: "var(--color-success, #27ae60)" }}>🟢 {optimos} óptima(s)</span>}
            </div>
          )}
          <div className="btn-group">
            <button type="button" className="btn btn--primary"
              onClick={() => setMostrarForm((v) => !v)}>
              {mostrarForm ? "Cerrar formulario" : "Nueva prueba"}
            </button>
            <button type="button" className="btn btn--ghost"
              onClick={cargar} disabled={loading} style={{ fontSize: "0.82rem" }}>
              {loading ? "…" : "↺"}
            </button>
          </div>
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "14px 0" }} />

      {/* Panel de sesión */}
      <PanelSesion
        sesionActual={sesionActual}
        onNuevaSesion={() => void handleNuevaSesion()}
        iniciando={iniciandoSesion}
      />

      {/* Filtro por sesión */}
      {sesionActual && lista.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center",
          marginBottom: 10, fontSize: "0.82rem" }}>
          <span style={{ color: "#666" }}>Mostrar:</span>
          <button type="button"
            className={filtroSesion === "todas" ? "btn btn--secondary" : "btn btn--ghost"}
            style={{ padding: "2px 10px", fontSize: "0.78rem" }}
            onClick={() => setFiltroSesion("todas")}>
            Todas ({lista.length})
          </button>
          <button type="button"
            className={filtroSesion === "actual" ? "btn btn--secondary" : "btn btn--ghost"}
            style={{ padding: "2px 10px", fontSize: "0.78rem" }}
            onClick={() => setFiltroSesion("actual")}>
            Sesión actual ({lista.filter((r) =>
              (r as AuditMetricResumen & { sesionId?: string }).sesionId === sesionActual.id ||
              new Date(r.timestamp) >= new Date(sesionActual.startedAt)
            ).length})
          </button>
        </div>
      )}

      {/* Formulario */}
      {mostrarForm && (
        <FormularioEvaluacion
          onSubmit={handleRun}
          running={running}
          onCancelar={() => setMostrarForm(false)}
        />
      )}

      {runMsg && <div className="alert alert--info" style={{ marginBottom: 10 }}>{runMsg}</div>}
      {runError && <div className="alert alert--error" style={{ marginBottom: 10 }}>{runError}</div>}
      {error && !lista.length && <div className="alert alert--error">{error}</div>}

      {/* Historial */}
      {loading && !lista.length ? (
        <div style={{ color: "#888", fontSize: "0.85rem" }}>Cargando historial…</div>
      ) : !listaFiltrada.length ? (
        <div style={{ color: "#aaa", fontSize: "0.85rem", padding: "12px 0" }}>
          {lista.length > 0
            ? "No hay pruebas en la sesión actual. Ejecuta una nueva prueba o cambia el filtro a 'Todas'."
            : <>No hay pruebas registradas. Usa el botón <strong>Nueva prueba</strong> para ejecutar la primera.</>}
        </div>
      ) : (
        <div ref={resultRef}>
          <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: 8, color: "#555" }}>
            Historial de evaluaciones
          </div>
          <div className="table-wrapper">
            <table className="tabla-clinica">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Modo</th>
                  <th>Red</th>
                  <th>TPS prom.</th>
                  <th>Latencia prom.</th>
                  <th>Tasa éxito</th>
                  <th>Eficiencia</th>
                  <th>Latencia</th>
                  <th>Seguridad</th>
                  <th>Interop.</th>
                  <th>Fuente</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((r) => (
                  <>
                    <tr key={r.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{fDate(r.timestamp)}</td>
                      <td><code>{r.modo}</code></td>
                      <td>{fChainId(r.chainId)}</td>
                      <td><b>{fNum(r.tpsPromedio)}</b></td>
                      <td>{fMs(r.latenciaPromedioMs)}</td>
                      <td>{fPct(r.tasaExito)}</td>
                      <td><Pill color={r.semaforoEficiencia} /></td>
                      <td><Pill color={r.semaforoLatencia} /></td>
                      <td><Pill color={r.semaforoSeguridad} /></td>
                      <td><Pill color={r.semaforoInteroperabilidad} /></td>
                      <td style={{ fontSize: "0.75rem", color: "#999" }}>{r.fuente}</td>
                      <td>
                        <button type="button" className="btn btn--ghost"
                          style={{ padding: "2px 10px", fontSize: "0.78rem" }}
                          onClick={() => void toggleDetalle(r.id)}>
                          {expandedId === r.id ? "▲ Cerrar" : "▼ Detalle"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === r.id && (
                      <tr key={`${r.id}-d`}>
                        <td colSpan={12} style={{ background: "#fafafa", borderTop: "1px solid #eee" }}>
                          {loadingDetalle
                            ? <div style={{ padding: 12, color: "#888" }}>Cargando detalle…</div>
                            : detalle
                            ? <PanelDetalle r={detalle} />
                            : <div style={{ padding: 12, color: "#c00" }}>No se pudo cargar el detalle.</div>
                          }
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leyenda compacta */}
      <details style={{ marginTop: 14 }}>
        <summary style={{ fontSize: "0.78rem", color: "#888", cursor: "pointer" }}>
          ¿Cómo interpretar los semáforos?
        </summary>
        <div style={{ fontSize: "0.78rem", color: "#666", marginTop: 8, display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div><b>Eficiencia</b> 🟢 TPS ≥ 10 · 🟡 ≥ 5 · 🔴 {"< 5"}</div>
          <div><b>Latencia</b> 🟢 ≤ 15 s · 🟡 ≤ 30 s · 🔴 {"> 30 s"} <span style={{color:"#aaa"}}>(1 bloque EVM ≈ 12–15 s)</span></div>
          <div><b>Seguridad</b> 🟢 tasa ≥ 95 % · 🟡 ≥ 80 % · 🔴 {"< 80 %"}</div>
          <div><b>Interop.</b> 🟢 nodo responde + contrato activo · 🟡 solo nodo · 🔴 sin respuesta / deploy fallido</div>
        </div>
      </details>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN B — INTEROPERABILIDAD CLÍNICA (HU0-HU5)
// ═════════════════════════════════════════════════════════════════════════════

/** Catálogo de HUs con descripción y qué indica cada resultado */
const HU_CATALOGO: Record<string, { titulo: string; descripcion: string; interpretacion: string }> = {
  "HU0-E6": {
    titulo: "Evaluar el flujo de interoperabilidad entre múltiples IPS",
    descripcion: "Valida escenarios multi-IPS desde el dashboard consolidado: continuidad asistencial, permisos controlados y consistencia de episodios entre organizaciones.",
    interpretacion: "Un resultado positivo indica que los episodios clínicos pueden crearse, compartirse y mantenerse coherentes entre al menos dos IPS simuladas."
  },
  "HU1-E6": {
    titulo: "Medir tiempos de acceso y verificación de información clínica",
    descripcion: "Mide tiempos objetivos de consulta de metadatos on-chain, acceso a documentos clínicos off-chain y verificación de integridad SHA-256.",
    interpretacion: "Tiempos sub-segundo indican que el prototipo responde adecuadamente en entornos de memoria/mock. Con FHIR real y blockchain Sepolia se esperan latencias mayores."
  },
  "HU2-E6": {
    titulo: "Evaluar el costo y rendimiento de las transacciones blockchain",
    descripcion: "Expone métricas de confirmación, gas y costo promedio por tipo de evento de trazabilidad; distingue entre estimaciones mock y mediciones reales.",
    interpretacion: "En modo simulación los costos son estimados. En modo real (Sepolia), los valores reflejan el gas efectivamente consumido por cada operación del smart contract."
  },
  "HU3-E6": {
    titulo: "Validar la integridad y trazabilidad del sistema",
    descripcion: "Permite al auditor verificar eventos, hashes, historial de versiones y consistencia on-chain/off-chain desde la vista de evaluación consolidada.",
    interpretacion: "Trazabilidad 'completa' significa que cada episodio tiene eventos registrados para todo su ciclo de vida. 'Con vacíos' indica episodios sin trazas."
  },
  "HU4-E6": {
    titulo: "Validar el cumplimiento del modelo HCE y los requisitos del sistema",
    descripcion: "Verifica que los episodios visibles cumplen con el modelo HCE definido y los requisitos funcionales clave (RF8, RF9, RF10, RF11).",
    interpretacion: "Episodios 'válidos' pasan todas las validaciones Zod del modelo HCE. Las 'observaciones' indican campos opcionales faltantes o limitaciones del prototipo."
  },
  "HU5-E6": {
    titulo: "Documentar los resultados y conclusiones del prototipo",
    descripcion: "Consolida documentación con resultados, conclusiones, aportes, limitaciones y trabajo futuro bajo el perfil auditor.",
    interpretacion: "Esta HU se valida verificando que la vista de evaluación presenta la documentación generada a partir de los datos reales del sistema."
  }
};

/** Descripción, umbral y nota para cada métrica de timing de la Sección B */
const TIMING_META: Record<string, {
  descripcion: string;
  umbralReferencia: string;
  interpretacion: (v: number, samples: number) => string;
}> = {
  metadataOnChain: {
    descripcion: "Tiempo de lectura del registro de trazabilidad (hash, eventId, versión) para cada episodio. En modo mock es una lectura de archivo local; en blockchain real incluye latencia RPC (~12-15 s/bloque).",
    umbralReferencia: "Mock: < 1 ms | FHIR+mock: < 5 ms | Blockchain real (Sepolia): 12 000–15 000 ms",
    interpretacion: (v, samples) => {
      if (samples === 0) return "Sin muestras — no hay episodios con trazas. Ejecute seed:eval-demo con SEED_ALL_TRACE_EVENTS=1.";
      if (v < 1) return "Tiempos sub-milisegundo: lectura en memoria/mock, esperable en el prototipo sin blockchain real.";
      if (v < 100) return "Tiempos bajos: lectura local eficiente, adecuada para el entorno de desarrollo.";
      return "Tiempos elevados: podría indicar latencia de red RPC o carga en el servidor FHIR.";
    }
  },
  documentOffChain: {
    descripcion: "Tiempo de recuperar el documento clínico desde HAPI FHIR o el almacén en memoria. Sin FHIR real (docker compose up -d) los tiempos son sub-milisegundo.",
    umbralReferencia: "Memoria: < 1 ms | FHIR local: 5–50 ms | FHIR remoto: 50–500 ms",
    interpretacion: (v, samples) => {
      if (samples === 0) return "Sin muestras — los episodios no tienen DocumentReference almacenado.";
      if (v < 1) return "Acceso en memoria: ultra rápido, confirma que el almacén in-memory está activo.";
      if (v < 50) return "Acceso local eficiente al servidor FHIR.";
      return "Latencia significativa: verificar la conexión con el servidor FHIR.";
    }
  },
  integrityVerification: {
    descripcion: "Tiempo de calcular el hash SHA-256 del documento off-chain y compararlo con el hash registrado en trazabilidad. El cálculo siempre ocurre localmente.",
    umbralReferencia: "Esperado: < 5 ms (cálculo SHA-256 local) | > 50 ms indica documentos muy grandes",
    interpretacion: (v, samples) => {
      if (samples === 0) return "Sin muestras — los episodios no tienen trazas con hash. Ejecute seed:eval-demo con SEED_ALL_TRACE_EVENTS=1.";
      if (v < 5) return "Cálculo SHA-256 rápido: documentos de tamaño normal, verificación instantánea.";
      if (v < 50) return "Verificación adecuada: documentos de tamaño moderado.";
      return "Verificación lenta: documentos excepcionalmente grandes o procesamiento concurrente.";
    }
  }
};

const TIMING_LABELS: Record<string, string> = {
  metadataOnChain: "Consulta de metadatos on-chain",
  documentOffChain: "Acceso a documento off-chain",
  integrityVerification: "Verificación de integridad"
};

/**
 * Genera un informe HTML de la Sección B (interoperabilidad clínica) y lo abre
 * para imprimir como PDF.
 */
function descargarInformeSeccionBPDF(d: DashboardEvaluacionPrototipo): void {
  const fMsR = (v?: number) => {
    if (typeof v !== "number" || isNaN(v)) return "—";
    return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v.toFixed(2)} ms`;
  };
  const fN = (v?: number) => typeof v === "number" ? String(v) : "—";

  const row = (k: string, v: string) =>
    `<tr><td style="color:#555;padding:3px 8px 3px 0">${k}</td><td style="font-weight:500;padding:3px 0">${v}</td></tr>`;
  const sec = (title: string, body: string) =>
    `<div style="margin-bottom:20px"><h3 style="font-size:13px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px">${title}</h3>${body}</div>`;

  // Timing rows with interpretation
  const timingRows = (Object.keys(TIMING_META) as Array<keyof typeof TIMING_META>).map((key) => {
    const meta = TIMING_META[key];
    const op = key === "metadataOnChain" ? d.timings.operations.metadataOnChain
      : key === "documentOffChain" ? d.timings.operations.documentOffChain
      : d.timings.operations.integrityVerification;
    return `
      <tr><td colspan="2" style="padding:8px 0 4px;font-weight:600;color:#333">${TIMING_LABELS[key]}</td></tr>
      ${row("Promedio", fMsR(op.averageMs))}
      ${row("Mín / Máx", `${fMsR(op.minMs)} / ${fMsR(op.maxMs)}`)}
      ${row("Muestras", fN(op.samples))}
      ${row("Consistencia", op.consistency)}
      ${row("Umbral de referencia", meta.umbralReferencia)}
      <tr><td colspan="2" style="font-size:11px;color:#666;padding:2px 0 10px;border-bottom:1px solid #eee">
        ${meta.interpretacion(op.averageMs, op.samples)}</td></tr>`;
  }).join("");

  // Scenarios table
  const scenarioRows = d.interoperability.scenarios.map((s) =>
    `<tr>
      <td style="padding:3px 6px"><code style="font-size:11px">${s.episodeId}</code></td>
      <td style="padding:3px 6px">${s.ipsInvolucradas.join(", ") || s.ownerIpsId || "—"}</td>
      <td style="padding:3px 6px;text-align:center">${s.versionCount}</td>
      <td style="padding:3px 6px;text-align:center">${s.activePermissions}</td>
      <td style="padding:3px 6px">${s.integrityStatus}</td>
      <td style="padding:3px 6px">${s.consistencyStatus}</td>
    </tr>`
  ).join("");

  // Blockchain operations table
  const blockchainRows = d.blockchainPerformance.operations.map((op) =>
    `<tr>
      <td style="padding:3px 6px">${op.label}</td>
      <td style="padding:3px 6px;text-align:center">${op.count}</td>
      <td style="padding:3px 6px">${fMsR(op.averageConfirmationMs)}</td>
      <td style="padding:3px 6px">${typeof op.averageGasUsed === "number" ? op.averageGasUsed.toLocaleString("es-CO") : "—"}</td>
      <td style="padding:3px 6px">${op.emitters.join(", ")}</td>
    </tr>`
  ).join("");

  // Requirements
  const reqRows = d.compliance.requirements.map((r) =>
    `<tr>
      <td style="padding:3px 6px;font-weight:500">${r.requirementId}</td>
      <td style="padding:3px 6px">${r.label}</td>
      <td style="padding:3px 6px;font-size:11px">${r.detail}</td>
      <td style="padding:3px 6px"><span style="background:${r.status === "cumple" ? "#27ae60" : r.status === "parcial" ? "#e67e22" : "#999"};color:#fff;padding:1px 8px;border-radius:8px;font-size:11px">${r.status}</span></td>
    </tr>`
  ).join("");

  // HU catalog
  const huSections = Object.entries(HU_CATALOGO).map(([id, hu]) =>
    `<div style="margin-bottom:12px;padding:8px 12px;background:#f8f9fa;border-radius:6px;border-left:3px solid #4f8ef7">
      <strong style="font-size:12px">${id} — ${hu.titulo}</strong>
      <p style="font-size:11px;color:#555;margin:4px 0 2px">${hu.descripcion}</p>
      <p style="font-size:11px;color:#888;margin:0"><em>${hu.interpretacion}</em></p>
    </div>`
  ).join("");

  // Actors
  const actorRows = d.audit.observedActors.map((a) =>
    `<tr>
      <td style="padding:3px 6px">${a.rol}</td>
      <td style="padding:3px 6px;text-align:center">${a.totalEventos}</td>
      <td style="padding:3px 6px">${a.ipsIds.join(", ") || "—"}</td>
    </tr>`
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Informe Sección B — Interoperabilidad Clínica</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:13px;color:#222;margin:32px;line-height:1.5}
    h1{font-size:18px;margin-bottom:4px}
    h2{font-size:15px;margin:24px 0 8px;border-bottom:2px solid #4f8ef7;padding-bottom:4px;color:#4f8ef7}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#f0f4ff;padding:4px 6px;text-align:left;font-size:11px;border-bottom:1px solid #ddd}
    td{border-bottom:1px solid #f0f0f0}
    @media print{body{margin:20px}.no-print{display:none}}
  </style>
</head>
<body>
  <div class="no-print" style="background:#eef4ff;padding:10px 16px;border-radius:8px;margin-bottom:20px;font-size:12px">
    <strong>Imprimir como PDF:</strong> Usa Ctrl+P (o Cmd+P) → selecciona "Guardar como PDF" → Guardar.
  </div>

  <h1>Informe de Evaluación — Sección B: Interoperabilidad Clínica</h1>
  <p style="color:#666;font-size:12px;margin-top:0">
    InterHCE Ledger · Generado el ${new Date().toLocaleString("es-CO")} · ${d.overview.totalEpisodes} episodio(s) evaluado(s)
  </p>

  <h2>1. Resumen general</h2>
  ${sec("Panorama", `<table>
    ${row("Episodios totales", fN(d.overview.totalEpisodes))}
    ${row("Eventos de trazabilidad", fN(d.overview.totalTraceEvents))}
    ${row("IPS simuladas", fN(d.overview.totalIpsSimuladas))}
    ${row("Modo blockchain", d.blockchainPerformance.mode)}
    ${row("Trazabilidad extremo a extremo", d.audit.endToEndTraceability ? "Completa" : "Con vacíos")}
    ${row("Episodios íntegros", fN(d.audit.integrityValidEpisodes))}
    ${row("Episodios válidos HCE", fN(d.compliance.hceModel.validEpisodes))}
  </table>`)}

  <h2>2. Historias de usuario evaluadas (HU0-HU5)</h2>
  ${huSections}

  <h2>3. Tiempos de acceso y verificación (HU1-E6)</h2>
  <p style="font-size:11px;color:#666;margin-bottom:8px">${d.timings.conclusion}</p>
  <table>${timingRows}</table>

  <h2>4. Escenarios de interoperabilidad (HU0-E6)</h2>
  <p style="font-size:11px;color:#666;margin-bottom:8px">${d.interoperability.conclusion}</p>
  <table>
    <thead><tr><th>Episodio</th><th>IPS involucradas</th><th>Versiones</th><th>Permisos</th><th>Integridad</th><th>Consistencia</th></tr></thead>
    <tbody>${scenarioRows}</tbody>
  </table>

  <h2>5. Costo y rendimiento blockchain (HU2-E6)</h2>
  <p style="font-size:11px;color:#666;margin-bottom:8px">${d.blockchainPerformance.conclusion}</p>
  <table>
    <thead><tr><th>Operación</th><th>Cantidad</th><th>Confirmación prom.</th><th>Gas promedio</th><th>Emisor</th></tr></thead>
    <tbody>${blockchainRows}</tbody>
  </table>

  <h2>6. Integridad y trazabilidad (HU3-E6)</h2>
  ${sec("Actores observados", `<table>
    <thead><tr><th>Rol</th><th>Eventos</th><th>IPS observadas</th></tr></thead>
    <tbody>${actorRows}</tbody>
  </table>`)}
  ${d.audit.episodesWithIssues.length > 0 ? sec("Hallazgos que requieren revisión",
    d.audit.episodesWithIssues.map((i) =>
      `<div style="padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:12px"><strong>${i.episodeId}</strong> — ${i.issue}</div>`
    ).join("")) : ""}

  <h2>7. Cumplimiento del modelo HCE (HU4-E6)</h2>
  <table>
    <thead><tr><th>Requisito</th><th>Nombre</th><th>Detalle</th><th>Estado</th></tr></thead>
    <tbody>${reqRows}</tbody>
  </table>

  <div style="margin-top:32px;border-top:1px solid #ddd;padding-top:12px;font-size:11px;color:#aaa">
    Generado por InterHCE Ledger — Sección B: Evaluación de interoperabilidad clínica.<br/>
    Fecha de generación: ${new Date().toLocaleString("es-CO")}.
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("No se pudo abrir la ventana del informe. Desbloquea las ventanas emergentes para este sitio.");
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

/** Tarjeta de timing enriquecida con descripción, umbral e interpretación */
function TimingCardEnriquecida({ metricKey, op }: {
  metricKey: string;
  op: { averageMs: number; minMs: number; maxMs: number; standardDeviationMs: number; samples: number; consistency: string };
}) {
  const meta = TIMING_META[metricKey];
  const label = TIMING_LABELS[metricKey];
  if (!meta || !label) return null;
  const interp = meta.interpretacion(op.averageMs, op.samples);
  const chipClass = op.consistency === "alta" ? "status-chip status-chip--ready"
    : op.consistency === "media" ? "status-chip status-chip--alert" : "status-chip";
  return (
    <article className="metric-card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <strong style={{ fontSize: "0.85rem" }}>{label}</strong>
      <p style={{ fontSize: "0.75rem", color: "#666", margin: "2px 0 6px", lineHeight: 1.4 }}>
        {meta.descripcion}
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", borderBottom: "1px solid #f0f0f0", padding: "2px 0" }}>
        <span style={{ color: "#666" }}>Promedio</span>
        <span style={{ fontWeight: 600 }}>
          {op.samples > 0 ? `${op.averageMs.toFixed(2)} ms` : "— sin datos"}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", borderBottom: "1px solid #f0f0f0", padding: "2px 0" }}>
        <span style={{ color: "#666" }}>Mín / Máx</span>
        <span>{op.samples > 0 ? `${op.minMs.toFixed(2)} / ${op.maxMs.toFixed(2)} ms` : "—"}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", borderBottom: "1px solid #f0f0f0", padding: "2px 0" }}>
        <span style={{ color: "#666" }}>Desviación</span>
        <span>{op.samples > 0 ? `${op.standardDeviationMs.toFixed(2)} ms` : "—"}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", borderBottom: "1px solid #f0f0f0", padding: "2px 0" }}>
        <span style={{ color: "#666" }}>Muestras</span>
        <span style={{ color: op.samples > 0 ? "#333" : "#c00" }}>
          {op.samples > 0 ? op.samples : "0 — sin datos"}
        </span>
      </div>
      <div className={chipClass} style={{ alignSelf: "flex-start", marginTop: 4 }}>
        Consistencia {op.consistency}
      </div>
      <div style={{ marginTop: 6, padding: "6px 8px", background: "#f5f8ff", borderRadius: 4, fontSize: "0.72rem", color: "#555", lineHeight: 1.4 }}>
        <strong>Umbral de referencia:</strong> {meta.umbralReferencia}
      </div>
      <p style={{ fontSize: "0.72rem", color: "#888", margin: "4px 0 0", lineHeight: 1.4 }}>
        {interp}
      </p>
    </article>
  );
}

function SeccionInteroperabilidadClinica() {
  const { sesion } = useSesion();
  const [dash, setDash] = useState<DashboardEvaluacionPrototipo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    const r = await obtenerDashboardEvaluacion(sesion, 3);
    if (r.ok && r.data) setDash(r.data);
    else setError(r.message);
    setLoading(false);
  }

  useEffect(() => { void cargar(); }, [sesion]);

  return (
    <section className="card card--elevated" style={{ marginBottom: 16 }}>
      <div className="section-head section-head--tight">
        <div>
          <h2 className="section-title">
            Sección B — Evaluación de interoperabilidad clínica
          </h2>
          <p className="section-copy" style={{ maxWidth: 680 }}>
            Mide cómo la DApp gestiona episodios clínicos <strong>entre múltiples IPS</strong>:
            continuidad asistencial, permisos de acceso, integridad de documentos y
            tiempos de acceso a registros off-chain y metadatos on-chain.
            Se basa en los episodios registrados actualmente en el sistema.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignSelf: "flex-start" }}>
          {dash && (
            <button type="button" className="btn btn--ghost"
              style={{ fontSize: "0.78rem", padding: "4px 12px", whiteSpace: "nowrap" }}
              onClick={() => descargarInformeSeccionBPDF(dash)}>
              ⬇ Descargar PDF Sección B
            </button>
          )}
          <button type="button" className="btn btn--secondary"
            onClick={cargar} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "14px 0" }} />

      {loading && !dash && (
        <div style={{ color: "#888", fontSize: "0.85rem" }}>Generando evaluación…</div>
      )}
      {error && !dash && (
        <div className="alert alert--error">{error}</div>
      )}

      {dash && (
        <>
          {/* ── HU Catalog ── */}
          <div className="section-block" style={{ marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: "0.88rem", marginBottom: 10 }}>
              Historias de usuario evaluadas
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
              {Object.entries(HU_CATALOGO).map(([id, hu]) => (
                <article key={id} style={{
                  padding: "10px 14px", background: "#f8f9fa", borderRadius: 8,
                  borderLeft: "3px solid #4f8ef7", fontSize: "0.82rem"
                }}>
                  <strong>{id} — {hu.titulo}</strong>
                  <p style={{ fontSize: "0.75rem", color: "#555", margin: "4px 0 2px", lineHeight: 1.4 }}>
                    {hu.descripcion}
                  </p>
                  <p style={{ fontSize: "0.72rem", color: "#888", margin: 0, fontStyle: "italic", lineHeight: 1.4 }}>
                    {hu.interpretacion}
                  </p>
                </article>
              ))}
            </div>
          </div>

          {/* ── Summary cards ── */}
          <div className="dashboard-grid" style={{ marginBottom: 14 }}>
            <article className="metric-card">
              <strong>HU0-E6 · Escenarios multi-IPS</strong>
              <span>{dash.interoperability.summary.crossIpsScenarios} escenario(s) entre IPS</span>
              <span>{dash.interoperability.summary.episodesWithContinuity} con continuidad asistencial</span>
              <span>{dash.interoperability.summary.episodesWithPermissionFlow} con flujo de permisos</span>
              <span>{dash.interoperability.summary.consistentEpisodes} consistente(s)</span>
              <div className={dash.interoperability.multipleIpsReady
                ? "status-chip status-chip--ready" : "status-chip"}>
                {dash.interoperability.multipleIpsReady ? "Multi-IPS activo" : "Single IPS"}
              </div>
            </article>

            <article className="metric-card">
              <strong>HU3-E6 · Integridad y trazabilidad</strong>
              <span>{dash.audit.integrityValidEpisodes} episodio(s) íntegros</span>
              <span>{dash.audit.totalEvents} evento(s) de trazabilidad</span>
              <span>Historial de versiones: {dash.audit.versionHistoryComplete ? "Completo" : "Incompleto"}</span>
              <div className={dash.audit.endToEndTraceability
                ? "status-chip status-chip--ready" : "status-chip status-chip--alert"}>
                {dash.audit.endToEndTraceability ? "Trazabilidad completa" : "Con vacíos"}
              </div>
            </article>

            <article className="metric-card">
              <strong>HU4-E6 · Cumplimiento modelo HCE</strong>
              <span>{dash.compliance.hceModel.validEpisodes} episodio(s) válidos</span>
              <span>{dash.compliance.hceModel.invalidEpisodes} con observaciones</span>
            </article>

            <article className="metric-card">
              <strong>HU2-E6 · Blockchain</strong>
              <span>Modo: {dash.blockchainPerformance.mode}</span>
              <span>{dash.blockchainPerformance.mostExpensiveOperation ?? "Sin operación destacada"}</span>
              <span>{dash.blockchainPerformance.metricKind} como origen métrico</span>
            </article>

            <article className="metric-card">
              <strong>Estado del entorno</strong>
              {dash.overview.fhir ? (
                <div className={
                  dash.overview.fhir.disponible
                    ? "status-chip status-chip--ready"
                    : dash.overview.fhir.configurado
                      ? "status-chip status-chip--alert"
                      : "status-chip"
                } style={{ marginBottom: 4 }}>
                  FHIR: {
                    dash.overview.fhir.disponible
                      ? `activo (${dash.overview.fhir.almacenamiento})`
                      : dash.overview.fhir.configurado
                        ? "caído — docker compose up -d"
                        : `memoria (${dash.overview.fhir.almacenamiento})`
                  }
                </div>
              ) : (
                <span style={{ color: "#999", fontSize: "0.78rem" }}>FHIR: no detectado</span>
              )}
              <div className={dash.overview.blockchainMode === "real"
                ? "status-chip status-chip--ready" : "status-chip"}>
                Blockchain: {dash.overview.blockchainMode === "real"
                  ? "Sepolia real"
                  : "simulación · datos del nodo RPC"}
              </div>
              {dash.overview.blockchainMode !== "real" && (
                <span style={{ fontSize: "0.72rem", color: "#888", lineHeight: 1.3 }}>
                  La simulación usa bloques reales de Sepolia para parametrizar las métricas.
                </span>
              )}
            </article>
          </div>

          {/* ── Conclusions panel ── */}
          <div className="result-panel" style={{ marginBottom: 16 }}>
            <div>
              <strong>Interoperabilidad (HU0-E6)</strong>
              <span>{dash.interoperability.conclusion}</span>
            </div>
            <div>
              <strong>Tiempos (HU1-E6)</strong>
              <span>{dash.timings.conclusion}</span>
            </div>
            <div>
              <strong>Blockchain (HU2-E6)</strong>
              <span>{dash.blockchainPerformance.conclusion}</span>
            </div>
          </div>

          {/* ── Enriched Timing Cards (HU1-E6) ── */}
          <div className="section-block" style={{ marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: "0.88rem", marginBottom: 10 }}>
              HU1-E6 · Tiempos de acceso y verificación
            </h3>
            <div className="dashboard-grid">
              <TimingCardEnriquecida metricKey="metadataOnChain" op={dash.timings.operations.metadataOnChain} />
              <TimingCardEnriquecida metricKey="documentOffChain" op={dash.timings.operations.documentOffChain} />
              <TimingCardEnriquecida metricKey="integrityVerification" op={dash.timings.operations.integrityVerification} />
            </div>
          </div>

          {/* ── Scenarios table (HU0-E6) ── */}
          <div className="section-block" style={{ marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: "0.88rem", marginBottom: 10 }}>
              HU0-E6 · Escenarios de interoperabilidad observados
            </h3>
            <div className="table-wrapper">
              <table className="tabla-clinica">
                <thead>
                  <tr>
                    <th>Episodio</th>
                    <th>IPS involucradas</th>
                    <th>Versiones</th>
                    <th>Permisos activos</th>
                    <th>Integridad</th>
                    <th>Consistencia</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.interoperability.scenarios.map((s) => (
                    <tr key={s.episodeId}>
                      <td><code>{s.episodeId}</code></td>
                      <td>{s.ipsInvolucradas.join(", ") || s.ownerIpsId || "—"}</td>
                      <td>{s.versionCount}</td>
                      <td>{s.activePermissions}</td>
                      <td>
                        <span className={s.integrityStatus === "integro"
                          ? "status-chip status-chip--ready"
                          : "status-chip status-chip--alert"}>
                          {s.integrityStatus}
                        </span>
                      </td>
                      <td>
                        <span className={s.consistencyStatus === "consistente"
                          ? "status-chip status-chip--ready"
                          : "status-chip status-chip--alert"}>
                          {s.consistencyStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Blockchain operations (HU2-E6) ── */}
          <div className="section-block" style={{ marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: "0.88rem", marginBottom: 10 }}>
              HU2-E6 · Costo y rendimiento por tipo de transacción
            </h3>
            <div className="table-wrapper">
              <table className="tabla-clinica">
                <thead>
                  <tr>
                    <th>Operación</th>
                    <th>Cantidad</th>
                    <th>Confirmación promedio</th>
                    <th>Gas promedio</th>
                    <th>Costo promedio (wei)</th>
                    <th>Emisor técnico</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.blockchainPerformance.operations.map((op) => (
                    <tr key={op.eventType}>
                      <td>{op.label}</td>
                      <td>{op.count}</td>
                      <td>{typeof op.averageConfirmationMs === "number" ? `${op.averageConfirmationMs.toFixed(2)} ms` : "—"}</td>
                      <td>{typeof op.averageGasUsed === "number" ? op.averageGasUsed.toLocaleString("es-CO") : "—"}</td>
                      <td>{typeof op.averageTransactionCostWei === "number" ? op.averageTransactionCostWei.toLocaleString("es-CO") : "—"}</td>
                      <td>{op.emitters.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Actors observed (HU3-E6) ── */}
          <div className="section-block" style={{ marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: "0.88rem", marginBottom: 10 }}>
              HU3-E6 · Actores observados en la auditoría
            </h3>
            <div className="table-wrapper">
              <table className="tabla-clinica">
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th>Eventos</th>
                    <th>IPS observadas</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.audit.observedActors.map((a) => (
                    <tr key={a.rol}>
                      <td>{a.rol}</td>
                      <td>{a.totalEventos}</td>
                      <td>{a.ipsIds.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Issues (HU3-E6) ── */}
          {!!dash.audit.episodesWithIssues.length && (
            <div className="section-block" style={{ marginBottom: 16 }}>
              <h3 className="section-title" style={{ fontSize: "0.88rem", marginBottom: 10 }}>
                Hallazgos que requieren revisión
              </h3>
              <div className="stack-list">
                {dash.audit.episodesWithIssues.map((item) => (
                  <article key={`${item.episodeId}-${item.issue}`} className="stack-item">
                    <strong>{item.episodeId}</strong>
                    <span>{item.issue}</span>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* ── Requirements (HU4-E6) ── */}
          <div className="section-block" style={{ marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: "0.88rem", marginBottom: 10 }}>
              HU4-E6 · Requisitos validados ({dash.compliance.requirements.length})
            </h3>
            <div className="stack-list">
              {dash.compliance.requirements.map((req) => (
                <article key={req.requirementId} className="stack-item">
                  <strong>{req.requirementId} · {req.label}</strong>
                  <span style={{ fontSize: "0.82rem" }}>{req.detail}</span>
                  <span className={
                    req.status === "cumple" ? "status-chip status-chip--ready" :
                    req.status === "parcial" ? "status-chip status-chip--alert" : "status-chip"
                  }>{req.status}</span>
                </article>
              ))}
            </div>
          </div>

          {/* ── IPS simuladas ── */}
          {dash.interoperability.simulatedIps.length > 0 && (
            <div className="section-block" style={{ marginBottom: 16 }}>
              <h3 className="section-title" style={{ fontSize: "0.88rem", marginBottom: 10 }}>
                IPS simuladas
              </h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {dash.interoperability.simulatedIps.map((ips) => (
                  <div key={typeof ips === "string" ? ips : JSON.stringify(ips)} style={{
                    padding: "6px 12px", background: "#f0f4ff", borderRadius: 6,
                    fontSize: "0.82rem", border: "1px solid #e0e8ff"
                  }}>
                    {typeof ips === "string" ? ips : JSON.stringify(ips)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════

export function AuditoriaDashboardPage() {
  const { sesion } = useSesion();

  return (
    <>
      <nav aria-label="Migas de pan" className="breadcrumb">
        <Link to="/portal">Panel</Link>{" / Auditoría / Evaluación de desempeño"}
      </nav>

      {/* Encabezado */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header__row">
          <div>
            <h1 className="page-title">RF10 — Evaluación de desempeño</h1>
            <p className="page-subtitle" style={{ maxWidth: 700 }}>
              Este módulo evalúa el tercer objetivo del proyecto desde dos perspectivas
              complementarias. La <strong>Sección A</strong> mide el rendimiento de la
              red blockchain con pruebas de estrés (TPS, latencia, gas, seguridad).
              La <strong>Sección B</strong> evalúa la interoperabilidad clínica de la DApp
              a partir de los episodios registrados entre IPS.
            </p>
          </div>
          <div className="context-note">
            <strong>{sesion?.nombre ?? "Auditor"}</strong>
            <span>Rol: {sesion?.rol}</span>
          </div>
        </div>
      </div>

      <SeccionRedBlockchain />
      <SeccionInteroperabilidadClinica />
    </>
  );
}

// Badge compacto para la tabla
function Pill({ color }: { color: Color }) {
  const cls =
    color === "verde" ? "status-chip status-chip--ready" :
    color === "amarillo" ? "status-chip status-chip--alert" :
    "status-chip status-chip--error";
  const t = { verde: "🟢", amarillo: "🟡", rojo: "🔴" };
  return <span className={cls} style={{ fontSize: "0.7rem", padding: "2px 6px" }}>{t[color]}</span>;
}
