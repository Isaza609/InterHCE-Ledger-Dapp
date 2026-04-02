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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useSesion } from "@/shared/auth/SessionContext";
import {
  listarAuditMetricas,
  listarAuditMetricasComparativas,
  obtenerAuditMetrica,
  ejecutarAuditRun,
  ejecutarAuditRunBatch,
  obtenerDashboardEvaluacion,
  iniciarSesionEvaluacion,
  obtenerSesionEvaluacion,
  type AuditFuente,
  type AuditMetricResumen,
  type AuditMetricDetalle,
  type AuditBatchResultado,
  type AuditRunBatchConfigFrontend,
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


const MODOS_PRUEBA: ModoPrueba[] = ["EOA", "ERC20", "ERC721"];
const MODO_ORDER: Record<ModoPrueba, number> = { EOA: 0, ERC20: 1, ERC721: 2 };
const MODO_COLORS: Record<ModoPrueba, string> = {
  EOA: "#2563eb",
  ERC20: "#22c55e",
  ERC721: "#f97316"
};
const SEMAFORO_COLORS: Record<Color, string> = {
  verde: "#22c55e",
  amarillo: "#eab308",
  rojo: "#ef4444"
};
const CONFIG_BATCH_DEFAULT: AuditRunBatchConfigFrontend = {
  rpcUrl: "",
  totalTransacciones: 100,
  mnemonic: ""
};

type ComparativeChartPoint = {
  totalTransacciones: number;
  [key: string]: number | undefined;
};

function ordenarPorModo(a: { modo: ModoPrueba }, b: { modo: ModoPrueba }): number {
  return MODO_ORDER[a.modo] - MODO_ORDER[b.modo];
}

function ordenarMetricasComparativas(a: AuditMetricResumen, b: AuditMetricResumen): number {
  if (a.totalTransacciones !== b.totalTransacciones) {
    return a.totalTransacciones - b.totalTransacciones;
  }
  const ordenModo = ordenarPorModo(a, b);
  if (ordenModo !== 0) return ordenModo;
  return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
}

function formatFuenteAudit(fuente?: AuditFuente): string {
  if (fuente === "pandoras-box") return "Ejecución real con pandoras-box";
  if (fuente === "pandoras-box-recovery") return "Ejecución real con recuperación de recibos";
  return "Simulación con datos del nodo RPC";
}

function formatFuenteAuditDestacada(fuente?: AuditFuente): string {
  if (fuente === "pandoras-box") return "🔴 Ejecución real con pandoras-box";
  if (fuente === "pandoras-box-recovery") return "🟠 Ejecución real con recuperación de recibos";
  return "🔵 Simulación con datos del nodo RPC";
}

function recortarTexto(value?: string, max = 44): string {
  if (!value) return "—";
  return value.length > max ? value.slice(0, max) + "…" : value;
}

function descargarArchivoDataUrl(dataUrl: string, nombre: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = nombre;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


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
    row("Fuente", formatFuenteAudit(r.fuente)),
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


type UltimoBatchRecordState = {
  modo: ModoPrueba;
  record?: AuditMetricDetalle;
  fuente?: AuditFuente;
  advertencia?: string;
  error?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizarResultadosBatch(
  results?: AuditBatchResultado[],
  fallbackData?: AuditMetricDetalle[]
): UltimoBatchRecordState[] {
  const resultsByModo = new Map<ModoPrueba, AuditBatchResultado>();
  const fallbackByModo = new Map<ModoPrueba, AuditMetricDetalle>();

  for (const item of results ?? []) {
    resultsByModo.set(item.modo, item);
  }
  for (const item of fallbackData ?? []) {
    fallbackByModo.set(item.modo, item);
  }

  return MODOS_PRUEBA.map((modo) => {
    const result = resultsByModo.get(modo);
    const record = result?.record ?? fallbackByModo.get(modo);
    return {
      modo,
      record,
      fuente: result?.fuente ?? result?.record?.fuente ?? record?.fuente,
      advertencia: result?.advertencia,
      error: result?.error ?? (!record && !result ? "Sin resultado devuelto por el backend." : undefined)
    };
  });
}

async function capturarGraficasComparativas(
  objetivos: Array<{ ref: { current: HTMLDivElement | null }; titulo: string; nombre?: string }>
): Promise<Array<{ titulo: string; dataUrl: string; nombre?: string }>> {
  const html2canvasModule = await import("html2canvas");
  const html2canvas = html2canvasModule.default;
  const capturas: Array<{ titulo: string; dataUrl: string; nombre?: string }> = [];

  for (const objetivo of objetivos) {
    if (!objetivo.ref.current) continue;
    const canvas = await html2canvas(objetivo.ref.current, {
      background: "#ffffff",
      useCORS: true
    });
    capturas.push({
      titulo: objetivo.titulo,
      dataUrl: canvas.toDataURL("image/png"),
      nombre: objetivo.nombre
    });
  }

  return capturas;
}

function renderAuditDetallePdfHtml(r: AuditMetricDetalle): string {
  const fN = (v?: number, d = 2) =>
    typeof v === "number" && !isNaN(v) ? v.toFixed(d) : "—";
  const fP = (v?: number) =>
    typeof v === "number" && !isNaN(v) ? `${v.toFixed(1)} %` : "—";
  const fMsR = (v?: number) => {
    if (typeof v !== "number" || isNaN(v) || v === 0) return "—";
    return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v.toFixed(0)} ms`;
  };
  const chainName: Record<number, string> = {
    1: "Ethereum",
    11155111: "Sepolia",
    137: "Polygon",
    56: "BSC",
    42161: "Arbitrum",
    0: "Local"
  };
  const semColor = (s: Color) =>
    s === "verde" ? "#27ae60" : s === "amarillo" ? "#e67e22" : "#c0392b";
  const semLabel = (s: Color) =>
    s === "verde" ? "Óptimo" : s === "amarillo" ? "Aceptable" : "Crítico";
  const row = (k: string, v: string) =>
    `<tr><td style="color:#555;padding:3px 8px 3px 0">${escapeHtml(k)}</td><td style="font-weight:500;padding:3px 0">${v}</td></tr>`;
  const sec = (title: string, rows: string) =>
    `<div style="margin-bottom:20px"><h3 style="font-size:13px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px">${escapeHtml(title)}</h3><table style="width:100%;border-collapse:collapse;font-size:12px">${rows}</table></div>`;
  const badge = (s: Color, label: string, val: string) =>
    `<div style="display:inline-block;margin-right:16px;text-align:center"><div style="background:${semColor(s)};color:#fff;border-radius:12px;padding:2px 10px;font-size:11px">${semLabel(s)}</div><div style="font-size:13px;font-weight:600;margin-top:3px">${escapeHtml(val)}</div><div style="font-size:11px;color:#888">${escapeHtml(label)}</div></div>`;

  const interop = r.interoperabilityDetails;
  const umbral = "Verde ≤ 15 s · Amarillo ≤ 30 s · Rojo > 30 s (1 bloque EVM ≈ 12–15 s)";

  return `
    <div style="margin-bottom:20px;padding:12px 14px;background:#f8fbff;border:1px solid #e4eef8;border-radius:10px">
      <strong style="font-size:14px">${escapeHtml(r.modo)}</strong>
      <div style="font-size:12px;color:#666;margin-top:4px">
        ${escapeHtml(formatFuenteAudit(r.fuente))} · ${escapeHtml(new Date(r.timestamp).toLocaleString("es-CO"))} · ID ${escapeHtml(r.id)}
      </div>
    </div>

    <div style="margin-bottom:20px">
      <h3 style="font-size:13px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:12px">Semáforos de evaluación</h3>
      ${badge(r.semaforoEficiencia, "Eficiencia", `${fN(r.tpsPromedio)} TPS`)}
      ${badge(r.semaforoLatencia, "Latencia", fMsR(r.latenciaPromedioMs))}
      ${badge(r.semaforoSeguridad, "Seguridad", fP(r.tasaExito))}
      ${badge(r.semaforoInteroperabilidad, "Interop. EVM", interop?.nodoAccesible ? "Nodo OK" : "Sin acceso")}
    </div>

    ${sec("1. Resumen", [
      row("ID evaluación", escapeHtml(r.id)),
      row("Fecha y hora", escapeHtml(new Date(r.timestamp).toLocaleString("es-CO"))),
      row("Modo de prueba", escapeHtml(r.modo)),
      row("Red (chainId)", `${escapeHtml(chainName[r.chainId] ?? `Chain ${r.chainId}`)} (${r.chainId})`),
      row("Nodo RPC", escapeHtml(r.rpcUrl)),
      row("Fuente", escapeHtml(formatFuenteAudit(r.fuente))),
      row("Contrato", escapeHtml(r.contractAddress ?? "N/A"))
    ].join(""))}

    ${sec("2. Métricas de eficiencia (TPS)", [
      row("TPS promedio", fN(r.tpsPromedio)),
      row("TPS pico", fN(r.tpsPico)),
      row("Total transacciones", fN(r.totalTransacciones, 0)),
      row("Transacciones exitosas", fN(r.transaccionesExitosas, 0)),
      row("Transacciones fallidas", fN(r.transaccionesFallidas, 0)),
      row("Umbral verde ≥", "10 TPS · Amarillo ≥ 5 TPS")
    ].join(""))}

    ${sec("3. Latencia de confirmación", [
      row("Latencia promedio", fMsR(r.latenciaPromedioMs)),
      row("Latencia mínima", fMsR(r.latenciaMinMs)),
      row("Latencia máxima", fMsR(r.latenciaMaxMs)),
      row("Latencia P95", fMsR(r.latenciaP95Ms)),
      row("Block time promedio", `${r.blockTimePromedioSeg.toFixed(2)} s`),
      row("Bloques observados", String(r.bloquesObservados)),
      row("Umbrales aplicados", escapeHtml(umbral))
    ].join(""))}

    ${sec("4. Gas", [
      row("Gas promedio / tx", fN(r.gasUsadoPromedio, 0)),
      row("Gas máximo / tx", fN(r.gasUsadoMax, 0)),
      row("Gas limit del bloque", fN(r.gasLimit, 0)),
      row("Utilización de bloque", fP(r.gasUtilizacionPct))
    ].join(""))}

    ${sec("5. Seguridad y tasa de éxito", [
      row("Tasa de éxito", fP(r.tasaExito)),
      row("Transacciones revertidas", fN(r.transaccionesRevertidas, 0)),
      row("Out-of-gas", fN(r.transaccionesOutOfGas, 0)),
      row("Tiempo respuesta nodo bajo carga", fMsR(r.tiempoRespuestaNodoMs)),
      row("Umbral verde ≥ 95 % · Amarillo ≥ 80 %", "")
    ].join(""))}

    ${sec("6. Interoperabilidad EVM / HCE", [
      row("Nodo EVM accesible", interop?.nodoAccesible ? "✓ Sí" : "✗ No"),
      row("Contrato accesible", interop?.contratoAccesible ? "✓ Sí" : r.modo === "EOA" ? "N/A (sin contrato)" : "✗ No"),
      row("Llamadas read/view OK", interop?.readCallsOk ? "✓ OK" : "✗ Error"),
      row("Escrituras OK", interop?.writeCallsOk ? "✓ OK" : "✗ Sin confirmar"),
      row("Compatibilidad ERC declarada", escapeHtml(interop?.compatibilidadERC ?? r.modo)),
      row("ChainId verificado", String(interop?.chainId ?? r.chainId)),
      ...(r.modo !== "EOA" ? [
        row("Deploy exitoso", r.deployExitoso ? "✓ Sí" : "✗ No"),
        row("Llamadas ERC exitosas", fN(r.llamadasERCExitosas, 0)),
        row("Total llamadas ERC", fN(r.llamadasERCTotal, 0)),
        row("Tasa ERC", r.llamadasERCTotal > 0 ? fP((r.llamadasERCExitosas / r.llamadasERCTotal) * 100) : "—")
      ] : [])
    ].join(""))}
    ${interop?.nota ? `<p style="font-size:11px;color:#555;background:#f5f5f5;padding:8px;border-radius:4px">${escapeHtml(interop.nota)}</p>` : ""}
  `;
}

function abrirInformeBatchPdf(options: {
  batchId: string;
  generatedAt: string;
  totalTransacciones: number;
  records: UltimoBatchRecordState[];
  graficas: Array<{ titulo: string; dataUrl: string }>;
}): void {
  const semColor = (s: Color) =>
    s === "verde" ? "#27ae60" : s === "amarillo" ? "#e67e22" : "#c0392b";
  const semLabel = (s: Color) =>
    s === "verde" ? "Óptimo" : s === "amarillo" ? "Aceptable" : "Crítico";
  const fN = (v?: number, d = 2) =>
    typeof v === "number" && !isNaN(v) ? v.toFixed(d) : "—";
  const fP = (v?: number) =>
    typeof v === "number" && !isNaN(v) ? `${v.toFixed(1)} %` : "—";
  const fMsR = (v?: number) => {
    if (typeof v !== "number" || isNaN(v) || v === 0) return "—";
    return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v.toFixed(0)} ms`;
  };

  const resumenRows = options.records.map((item) => {
    if (!item.record) {
      return `
        <tr>
          <td>${escapeHtml(item.modo)}</td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
          <td><span class="chip" style="background:${semColor("rojo")}">Crítico</span></td>
          <td><span class="chip" style="background:${semColor("rojo")}">Crítico</span></td>
          <td><span class="chip" style="background:${semColor("rojo")}">Crítico</span></td>
        </tr>`;
    }

    return `
      <tr>
        <td>${escapeHtml(item.record.modo)}</td>
        <td>${escapeHtml(fN(item.record.tpsPromedio))}</td>
        <td>${escapeHtml(fMsR(item.record.latenciaPromedioMs))}</td>
        <td>${escapeHtml(fP(item.record.tasaExito))}</td>
        <td><span class="chip" style="background:${semColor(item.record.semaforoEficiencia)}">${escapeHtml(semLabel(item.record.semaforoEficiencia))}</span></td>
        <td><span class="chip" style="background:${semColor(item.record.semaforoLatencia)}">${escapeHtml(semLabel(item.record.semaforoLatencia))}</span></td>
        <td><span class="chip" style="background:${semColor(item.record.semaforoSeguridad)}">${escapeHtml(semLabel(item.record.semaforoSeguridad))}</span></td>
      </tr>`;
  }).join("");

  const graficasHtml = options.graficas.length > 0
    ? `
      <div style="margin-top:18px">
        <h3 style="font-size:13px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:10px">Gráficas comparativas</h3>
        <div class="chart-grid">
          ${options.graficas.map((grafica) => `
            <figure class="chart-card">
              <img src="${grafica.dataUrl}" alt="${escapeHtml(grafica.titulo)}" />
              <figcaption>${escapeHtml(grafica.titulo)}</figcaption>
            </figure>
          `).join("")}
        </div>
      </div>`
    : "";

  const detalleHtml = options.records.map((item, index) => {
    const heading = `Sección ${index + 3} — Detalle ${item.modo}`;
    if (!item.record) {
      return `
        <section class="page page-break">
          <h1>${escapeHtml(heading)}</h1>
          <p style="color:#666;font-size:12px;margin-top:0">Batch ${escapeHtml(options.batchId)} · ${escapeHtml(new Date(options.generatedAt).toLocaleString("es-CO"))}</p>
          <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:18px 20px;font-size:13px;color:#9f1239">
            <strong>${escapeHtml(item.modo)}</strong><br/>
            ${escapeHtml(item.error ?? "Este modo no generó un registro de auditoría.")}
          </div>
        </section>`;
    }

    return `
      <section class="page page-break">
        <h1>${escapeHtml(heading)}</h1>
        <p style="color:#666;font-size:12px;margin-top:0">Batch ${escapeHtml(options.batchId)} · ${escapeHtml(new Date(item.record.timestamp).toLocaleString("es-CO"))}</p>
        ${item.advertencia ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 12px;font-size:12px;color:#9a3412;margin-bottom:14px">${escapeHtml(item.advertencia)}</div>` : ""}
        ${renderAuditDetallePdfHtml(item.record)}
      </section>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Informe Comparativo de Evaluación Blockchain</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:13px;color:#222;margin:32px;line-height:1.5;background:#fff}
    h1{font-size:18px;margin-bottom:4px}
    h2{font-size:15px;margin:18px 0 8px;border-bottom:2px solid #4f8ef7;padding-bottom:4px;color:#4f8ef7}
    h3{margin-top:0}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#f0f4ff;padding:6px;text-align:left;border-bottom:1px solid #dbe4f0}
    td{padding:6px;border-bottom:1px solid #edf2f7;vertical-align:top}
    .page{page-break-after:always;break-after:page}
    .page:last-of-type{page-break-after:auto;break-after:auto}
    .hero{background:linear-gradient(135deg,#eef6ff,#f8fbff);border:1px solid #dbeafe;border-radius:18px;padding:32px}
    .hero h1{font-size:24px;margin-bottom:6px}
    .hero h2{border:none;color:#1d4ed8;margin:0 0 20px;padding:0;font-size:18px}
    .meta-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:22px}
    .meta-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
    .meta-card strong{display:block;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
    .chip{display:inline-block;color:#fff;border-radius:999px;padding:2px 10px;font-size:11px}
    .chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .chart-card{border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin:0;background:#fff}
    .chart-card img{width:100%;height:auto;display:block}
    .chart-card figcaption{font-size:11px;color:#64748b;margin-top:8px;text-align:center}
    @media print{body{margin:18px}.no-print{display:none}}
  </style>
</head>
<body>
  <div class="no-print" style="background:#eef4ff;padding:10px 16px;border-radius:8px;margin-bottom:20px;font-size:12px">
    <strong>Imprimir como PDF:</strong> Usa Ctrl+P (o Cmd+P) → selecciona "Guardar como PDF" → Guardar.
  </div>

  <section class="page">
    <div class="hero">
      <h1>Informe Comparativo de Evaluación Blockchain</h1>
      <h2>InterHCE Ledger</h2>
      <p style="font-size:13px;color:#475569;max-width:680px">
        Documento consolidado del último batch comparativo ejecutado sobre la red Sepolia.
        Incluye portada, resumen comparativo, gráficas y detalle completo por modo.
      </p>
      <div class="meta-grid">
        <div class="meta-card"><strong>Batch ID</strong>${escapeHtml(options.batchId)}</div>
        <div class="meta-card"><strong>Fecha y hora</strong>${escapeHtml(new Date(options.generatedAt).toLocaleString("es-CO"))}</div>
        <div class="meta-card"><strong>Total transacciones evaluadas</strong>${escapeHtml(String(options.totalTransacciones))}</div>
        <div class="meta-card"><strong>Red</strong>Sepolia (11155111)</div>
        <div class="meta-card"><strong>Modos evaluados</strong>EOA, ERC20, ERC721</div>
        <div class="meta-card"><strong>Registros en el batch</strong>${escapeHtml(String(options.records.length))}</div>
      </div>
    </div>
  </section>

  <section class="page">
    <h1>Sección 2 — Resumen comparativo</h1>
    <p style="color:#666;font-size:12px;margin-top:0">Batch ${escapeHtml(options.batchId)} · ${escapeHtml(new Date(options.generatedAt).toLocaleString("es-CO"))}</p>
    <table>
      <thead>
        <tr>
          <th>Modo</th>
          <th>TPS Prom</th>
          <th>Latencia Prom</th>
          <th>Tasa Éxito</th>
          <th>Semáforo Eficiencia</th>
          <th>Semáforo Latencia</th>
          <th>Semáforo Seguridad</th>
        </tr>
      </thead>
      <tbody>${resumenRows}</tbody>
    </table>
    ${graficasHtml}
  </section>

  ${detalleHtml}
</body>
</html>`;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) {
    alert("No se pudo abrir la ventana del informe. Desbloquea las ventanas emergentes para este sitio.");
    return;
  }
  win.document.write(html);
  win.document.close();
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

function SpinnerInline({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.82rem" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="#cbd5e1" strokeWidth="3" />
        <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round">
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="0 12 12"
            to="360 12 12"
            dur="0.9s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
      <span>{label}</span>
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
          <span style={{ color: "#aaa", fontSize: "0.7rem" }}>{formatFuenteAuditDestacada(r.fuente)}</span>
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
  contractAddress: "", mnemonic: "", batchSize: 10,
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
    const fuenteLabel = formatFuenteAuditDestacada(r.fuente);
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
        r.sesionId === sesionActual.id ||
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
              r.sesionId === sesionActual.id ||
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


function SeccionComparativa() {
  const { sesion } = useSesion();
  const [registros, setRegistros] = useState<AuditMetricResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdfBatch, setExportingPdfBatch] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<AuditRunBatchConfigFrontend>({ ...CONFIG_BATCH_DEFAULT });
  const [ultimoBatchRecords, setUltimoBatchRecords] = useState<UltimoBatchRecordState[]>([]);
  const [ultimoBatchId, setUltimoBatchId] = useState<string | null>(null);
  const [ultimoBatchFecha, setUltimoBatchFecha] = useState<string | null>(null);
  const [ultimoBatchTotalTransacciones, setUltimoBatchTotalTransacciones] = useState<number | null>(null);
  const graficaTpsRef = useRef<HTMLDivElement>(null);
  const graficaLatenciaRef = useRef<HTMLDivElement>(null);
  const graficaExitoRef = useRef<HTMLDivElement>(null);
  const graficaGasRef = useRef<HTMLDivElement>(null);

  function setCampo<K extends keyof AuditRunBatchConfigFrontend>(
    key: K,
    value: AuditRunBatchConfigFrontend[K]
  ) {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }

  async function cargarMetricasComparativas(): Promise<AuditMetricResumen[]> {
    const comparativas = await listarAuditMetricasComparativas(sesion);
    if (comparativas.ok) {
      const todos = [...(comparativas.data ?? [])].sort(ordenarMetricasComparativas);
      setRegistros(todos);
      return todos;
    }
    setRegistros([]);
    setError(comparativas.message);
    return [];
  }

  async function hidratarUltimoBatchDesdeHistorico(comparativasData: AuditMetricResumen[]) {
    let latestId: string | undefined;
    let latestTimestamp = -1;

    for (const record of comparativasData) {
      if (!record.batchId) continue;
      const timestamp = new Date(record.timestamp).getTime();
      if (timestamp >= latestTimestamp) {
        latestTimestamp = timestamp;
        latestId = record.batchId;
      }
    }

    if (!latestId) {
      setUltimoBatchRecords([]);
      setUltimoBatchId(null);
      setUltimoBatchFecha(null);
      setUltimoBatchTotalTransacciones(null);
      return;
    }

    const registrosBatch = comparativasData
      .filter((record) => record.batchId === latestId)
      .sort(ordenarMetricasComparativas);

    const detalles = await Promise.all(
      registrosBatch.map(async (record) => {
        const detalle = await obtenerAuditMetrica(record.id, sesion);
        if (detalle.ok && detalle.data) {
          return {
            modo: record.modo,
            record: detalle.data,
            fuente: detalle.data.fuente
          } satisfies UltimoBatchRecordState;
        }
        return {
          modo: record.modo,
          fuente: record.fuente,
          error: detalle.message
        } satisfies UltimoBatchRecordState;
      })
    );

    setUltimoBatchRecords(detalles.sort(ordenarPorModo));
    setUltimoBatchId(latestId);
    setUltimoBatchFecha(registrosBatch[registrosBatch.length - 1]?.timestamp ?? null);
    setUltimoBatchTotalTransacciones(registrosBatch[0]?.totalTransacciones ?? null);
  }

  async function cargar() {
    setLoading(true);
    setError(null);

    const comparativasData = await cargarMetricasComparativas();
    const metricas = await listarAuditMetricas(sesion);
    await hidratarUltimoBatchDesdeHistorico(comparativasData);

    const ultimaComparativa = comparativasData.length > 0
      ? comparativasData[comparativasData.length - 1]
      : undefined;
    const rpcSugerida =
      ultimaComparativa?.rpcUrl ??
      metricas.data?.[0]?.rpcUrl ??
      "";

    if (rpcSugerida) {
      setCfg((prev) => (prev.rpcUrl.trim() ? prev : { ...prev, rpcUrl: rpcSugerida }));
    }

    setLoading(false);
  }

  async function handleRunBatch() {
    setRunning(true);
    setMensaje(null);
    setError(null);

    const response = await ejecutarAuditRunBatch(
      {
        rpcUrl: cfg.rpcUrl.trim(),
        totalTransacciones: cfg.totalTransacciones,
        mnemonic: cfg.mnemonic?.trim() ? cfg.mnemonic.trim() : undefined
      },
      sesion
    );

    console.log("BATCH response:", JSON.stringify(response, null, 2));

    setRunning(false);

    if (!response.ok) {
      setError(response.message);
      return;
    }

    const advertencias = response.advertencias ?? [];
    const errores = response.errores ?? [];
    const detalleAdvertencias = advertencias.length > 0
      ? " Algunas corridas requirieron fallback: " + advertencias
        .map((item) => item.modo + " (" + formatFuenteAudit(item.fuente) + ")")
        .join(" · ")
      : "";

    const detalleErrores = errores.length > 0
      ? " Errores por modo: " + errores.map((item) => item.modo + " (" + item.error + ")").join(" · ")
      : "";

    const resultadosNormalizados = normalizarResultadosBatch(response.results, response.data);
    const timestamps = resultadosNormalizados
      .flatMap((item) => item.record ? [new Date(item.record.timestamp).getTime()] : []);

    setUltimoBatchRecords(resultadosNormalizados);
    setUltimoBatchId(response.batchId ?? null);
    setUltimoBatchFecha(
      timestamps.length > 0
        ? new Date(Math.max(...timestamps)).toISOString()
        : new Date().toISOString()
    );
    setUltimoBatchTotalTransacciones(cfg.totalTransacciones);

    setMensaje(
      "Prueba comparativa completada. Batch " +
      (response.batchId ? response.batchId.slice(0, 8) + "…" : "sin ID") +
      "." +
      detalleAdvertencias +
      detalleErrores
    );

    await cargarMetricasComparativas();
  }

  async function handleExportarGraficas() {
    const objetivos = [
      { ref: graficaTpsRef, nombre: "grafica_tps_comparativa.png", titulo: "Gráfica 1 — TPS Promedio vs Transacciones" },
      { ref: graficaLatenciaRef, nombre: "grafica_latencia_comparativa.png", titulo: "Gráfica 2 — Latencia Promedio vs Transacciones" },
      { ref: graficaExitoRef, nombre: "grafica_tasa_exito_comparativa.png", titulo: "Gráfica 3 — Tasa de Éxito vs Transacciones" },
      { ref: graficaGasRef, nombre: "grafica_gas_comparativa.png", titulo: "Gráfica 4 — Gas Promedio vs Transacciones" }
    ];

    setExporting(true);
    setError(null);

    try {
      const capturas = await capturarGraficasComparativas(objetivos);
      for (const captura of capturas) {
        if (!captura.nombre) continue;
        descargarArchivoDataUrl(captura.dataUrl, captura.nombre);
      }
    } catch {
      setError("No se pudieron exportar las gráficas PNG.");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportarPdfBatch() {
    if (ultimoBatchRecords.length !== 3) return;

    const batchId = ultimoBatchId
      ?? ultimoBatchRecords.find((item) => item.record?.batchId)?.record?.batchId
      ?? null;

    if (!batchId) {
      setError("No se encontró el Batch ID del último lote para generar el PDF.");
      return;
    }

    setExportingPdfBatch(true);
    setError(null);

    try {
      const graficas = await capturarGraficasComparativas([
        { ref: graficaTpsRef, titulo: "Gráfica 1 — TPS Promedio vs Transacciones" },
        { ref: graficaLatenciaRef, titulo: "Gráfica 2 — Latencia Promedio vs Transacciones" },
        { ref: graficaExitoRef, titulo: "Gráfica 3 — Tasa de Éxito vs Transacciones" },
        { ref: graficaGasRef, titulo: "Gráfica 4 — Gas Promedio vs Transacciones" }
      ]);

      abrirInformeBatchPdf({
        batchId,
        generatedAt: ultimoBatchFecha ?? new Date().toISOString(),
        totalTransacciones: ultimoBatchTotalTransacciones
          ?? ultimoBatchRecords.find((item) => item.record)?.record?.totalTransacciones
          ?? cfg.totalTransacciones,
        records: ultimoBatchRecords,
        graficas: graficas.map(({ titulo, dataUrl }) => ({ titulo, dataUrl }))
      });
    } catch {
      setError("No se pudo generar el PDF consolidado del batch.");
    } finally {
      setExportingPdfBatch(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, [sesion]);

  const registrosOrdenados = [...registros].sort(ordenarMetricasComparativas);
  const agrupados = new Map<number, ComparativeChartPoint>();

  for (const record of registrosOrdenados) {
    const total = record.totalTransacciones;
    const point = agrupados.get(total) ?? { totalTransacciones: total };
    point["tps_" + record.modo] = record.tpsPromedio;
    point["latencia_" + record.modo] = Number((record.latenciaPromedioMs / 1000).toFixed(2));
    point["tasa_" + record.modo] = Number(record.tasaExito.toFixed(2));
    point["gas_" + record.modo] = Number(record.gasUsadoPromedio.toFixed(2));
    agrupados.set(total, point);
  }

  const chartData = Array.from(agrupados.values()).sort(
    (a, b) => a.totalTransacciones - b.totalTransacciones
  );
  const batchIds = Array.from(
    new Set(registrosOrdenados.map((record) => record.batchId).filter((id): id is string => Boolean(id)))
  );

  let latestHistoricalBatchId: string | undefined;
  let latestHistoricalTimestamp = -1;
  for (const record of registrosOrdenados) {
    if (!record.batchId) continue;
    const timestamp = new Date(record.timestamp).getTime();
    if (timestamp >= latestHistoricalTimestamp) {
      latestHistoricalTimestamp = timestamp;
      latestHistoricalBatchId = record.batchId;
    }
  }

  const resumenUltimoBatch: Array<{
    modo: ModoPrueba;
    record?: AuditMetricResumen;
    fuente?: AuditFuente;
    advertencia?: string;
    error?: string;
  }> = ultimoBatchRecords.length > 0
    ? ultimoBatchRecords
    : latestHistoricalBatchId
      ? registrosOrdenados
        .filter((record) => record.batchId === latestHistoricalBatchId)
        .sort(ordenarMetricasComparativas)
        .map((record) => ({ modo: record.modo, record, fuente: record.fuente }))
      : [];

  const latestBatchId = ultimoBatchId ?? latestHistoricalBatchId;
  const latestBatchTimestamp = ultimoBatchFecha
    ? new Date(ultimoBatchFecha).getTime()
    : latestHistoricalTimestamp;
  const latestBatchRecords = resumenUltimoBatch
    .flatMap((item) => item.record ? [item.record] : [])
    .sort(ordenarMetricasComparativas);
  const tieneDatos = chartData.length > 0;
  const resumenPuntos = chartData.map((point) => String(point.totalTransacciones)).join(", ");
  const ultimaMuestra = latestBatchRecords[0];
  const tieneBatchCompleto = ultimoBatchRecords.length === 3;

  return (
    <section className="card card--elevated" style={{ marginBottom: 16 }}>
      <div className="section-head section-head--tight" style={{ marginBottom: 0 }}>
        <div>
          <h2 className="section-title">Sección comparativa — Batch EOA / ERC20 / ERC721</h2>
          <p className="section-copy" style={{ maxWidth: 720 }}>
            Ejecuta una <strong>prueba comparativa secuencial</strong> sobre Sepolia con el mismo
            volumen de transacciones para los tres modos de auditoría. La salida se consolida en
            gráficas listas para análisis y exportación en la monografía.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignSelf: "flex-start" }}>
          {tieneDatos && (
            <button
              type="button"
              className="btn btn--ghost"
              style={{ fontSize: "0.8rem", padding: "4px 12px", whiteSpace: "nowrap" }}
              onClick={() => void handleExportarGraficas()}
              disabled={exporting}
            >
              {exporting ? "Exportando PNG…" : "Exportar gráficas PNG"}
            </button>
          )}
          <button type="button" className="btn btn--secondary" onClick={() => void cargar()} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "14px 0" }} />

      <section className="card" style={{ background: "#f8fbff", border: "1px solid #e1ebf5", marginBottom: 16 }}>
        <div style={{ background: "#eef6ff", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: "0.83rem", lineHeight: 1.55 }}>
          <strong>¿Qué hace esta sección?</strong><br />
          Ejecuta la misma carga de trabajo en <strong>EOA, ERC20 y ERC721</strong> para comparar
          TPS, latencia, tasa de éxito y gas promedio con el mismo tamaño de muestra.
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void handleRunBatch(); }}>
          <h3 style={{ fontSize: "0.92rem", fontWeight: 600, marginBottom: 12 }}>
            Formulario de batch comparativo
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label className="form-field">
              <span className="form-label">Total de transacciones</span>
              <input
                className="form-input"
                type="number"
                min={1}
                max={10000}
                step={1}
                required
                value={cfg.totalTransacciones}
                onChange={(e) => setCampo("totalTransacciones", Number(e.target.value))}
              />
              <small style={{ color: "#888", fontSize: "0.72rem" }}>
                Valores típicos: 50, 100, 150, 200… hasta 500 o más.
              </small>
            </label>

            <label className="form-field">
              <span className="form-label">RPC URL</span>
              <input
                className="form-input"
                type="url"
                required
                placeholder="https://eth-sepolia.g.alchemy.com/v2/&lt;key&gt;"
                value={cfg.rpcUrl}
                onChange={(e) => setCampo("rpcUrl", e.target.value)}
              />
              <small style={{ color: "#888", fontSize: "0.72rem" }}>
                Se precarga con la última RPC usada en auditoría cuando existe historial.
              </small>
            </label>

            <label className="form-field" style={{ gridColumn: "1 / -1" }}>
              <span className="form-label">Mnemonic BIP-39 (opcional)</span>
              <input
                className="form-input"
                type="password"
                placeholder="word1 word2 word3 … word12"
                value={cfg.mnemonic ?? ""}
                onChange={(e) => setCampo("mnemonic", e.target.value)}
              />
              <small style={{ color: "#888", fontSize: "0.72rem" }}>
                Si no se envía, el backend puede caer en simulación con datos del nodo RPC.
              </small>
            </label>
          </div>

          <div className="btn-group">
            <button type="submit" className="btn btn--primary" disabled={running}>
              {running
                ? "Ejecutando prueba comparativa…"
                : "Ejecutar prueba comparativa (3 modos)"}
            </button>
          </div>
        </form>
      </section>

      {running && (
        <div className="alert alert--info" style={{ marginBottom: 12 }}>
          <SpinnerInline label="Ejecutando EOA... ERC20... ERC721... (puede tardar varios minutos)" />
        </div>
      )}
      {mensaje && <div className="alert alert--info" style={{ marginBottom: 12 }}>{mensaje}</div>}
      {error && <div className="alert alert--error" style={{ marginBottom: 12 }}>{error}</div>}

      {loading && !registrosOrdenados.length ? (
        <div style={{ color: "#888", fontSize: "0.85rem" }}>Cargando métricas comparativas…</div>
      ) : !tieneDatos ? (
        <div className="result-panel" style={{ marginBottom: 16 }}>
          <div>
            <strong>Ejecuta tu primera prueba comparativa</strong>
            <span>No hay datos batch con batchId disponibles todavía para construir las gráficas.</span>
          </div>
        </div>
      ) : (
        <>
          <div className="dashboard-grid" style={{ marginBottom: 14 }}>
            <MetricCard
              title="Cobertura comparativa"
              rows={[
                ["Batches ejecutados", String(batchIds.length)],
                ["Registros comparativos", String(registrosOrdenados.length)],
                ["Puntos del eje X", resumenPuntos || "—"]
              ]}
            />
            <MetricCard
              title="Último batch"
              rows={[
                ["Batch ID", latestBatchId ? latestBatchId.slice(0, 8) + "…" : "—"],
                ["Fecha", latestBatchTimestamp > 0 ? fDate(new Date(latestBatchTimestamp).toISOString()) : "—"],
                ["RPC", recortarTexto(ultimaMuestra?.rpcUrl ?? cfg.rpcUrl)]
              ]}
            />
            <MetricCard
              title="Última muestra"
              rows={[
                ["Transacciones", ultimaMuestra ? String(ultimaMuestra.totalTransacciones) : "—"],
                ["Modos presentes", resumenUltimoBatch.map((item) => item.modo).join(", ") || "—"],
                ["Fuente", ultimaMuestra ? formatFuenteAudit(ultimaMuestra.fuente) : "—"]
              ]}
            />
          </div>

          {!!resumenUltimoBatch.length && (
            <div style={{
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              background: "#f8fbff",
              border: "1px solid #e4eef8",
              borderRadius: 10,
              padding: "12px 18px",
              marginBottom: 16,
              alignItems: "center"
            }}>
              <div style={{ minWidth: 150, color: "#556", fontSize: "0.8rem" }}>
                <strong>Semáforos del último batch</strong><br />
                <span style={{ color: "#889", fontSize: "0.72rem" }}>Eficiencia por modo</span>
              </div>
              {resumenUltimoBatch.map((item) => (
                <SemaforoBadge
                  key={item.modo}
                  color={item.record?.semaforoEficiencia ?? "rojo"}
                  label={item.modo + " · eficiencia"}
                  valor={item.record ? fNum(item.record.tpsPromedio) + " TPS" : "Error"}
                />
              ))}
            </div>
          )}

          {!!ultimoBatchRecords.length && (
            <section className="card" style={{ background: "#f8fbff", border: "1px solid #dbeafe", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: "0.92rem", fontWeight: 600, marginBottom: 4 }}>
                    Detalle por modo — Último batch
                  </h3>
                  <p style={{ fontSize: "0.78rem", color: "#667085", margin: 0 }}>
                    Vista consolidada del último batch con el mismo detalle técnico de la Sección A.
                  </p>
                </div>
                {tieneBatchCompleto && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ fontSize: "0.8rem", padding: "4px 12px", whiteSpace: "nowrap" }}
                    onClick={() => void handleExportarPdfBatch()}
                    disabled={exportingPdfBatch}
                  >
                    {exportingPdfBatch ? "Preparando PDF…" : "Exportar PDF del batch"}
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                {ultimoBatchRecords.map((item) => (
                  <article
                    key={item.modo}
                    style={{
                      background: "#fff",
                      border: "1px solid #e5eef5",
                      borderRadius: 10,
                      overflow: "hidden"
                    }}
                  >
                    {item.advertencia && (
                      <div style={{
                        background: "#fff7ed",
                        borderBottom: "1px solid #fed7aa",
                        color: "#9a3412",
                        fontSize: "0.76rem",
                        padding: "10px 14px"
                      }}>
                        {item.advertencia}
                      </div>
                    )}
                    {item.record ? (
                      <PanelDetalle r={item.record} />
                    ) : (
                      <div style={{ padding: "16px 18px" }}>
                        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
                          <div style={{ fontSize: "0.78rem", color: "#555", flex: 1, minWidth: 160 }}>
                            <strong>{item.modo}</strong> · Sepolia<br />
                            <span style={{ color: "#aa6f00", fontSize: "0.7rem" }}>{item.fuente ? formatFuenteAuditDestacada(item.fuente) : "Sin fuente disponible"}</span>
                          </div>
                          <SemaforoBadge color="rojo" label="Estado" valor="Error" />
                        </div>
                        <div className="alert alert--error" style={{ marginBottom: 0 }}>
                          {item.error ?? "No se generó un registro para este modo en el último batch."}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 16 }}>
            <article ref={graficaTpsRef} style={{ background: "#fff", border: "1px solid #e5eef5", borderRadius: 10, padding: 16 }}>
              <strong style={{ display: "block", marginBottom: 4 }}>Gráfica 1 — TPS Promedio vs Transacciones</strong>
              <p style={{ fontSize: "0.76rem", color: "#778", margin: "0 0 12px" }}>
                Compara el throughput promedio por modo a medida que aumenta el volumen transaccional.
              </p>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5eef5" />
                    <XAxis dataKey="totalTransacciones" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      labelFormatter={(value) => String(value) + " transacciones"}
                      formatter={(value, name) => [fNum(Number(value)) + " TPS", String(name)]}
                    />
                    <Legend />
                    {MODOS_PRUEBA.map((modo) => (
                      <Line
                        key={modo}
                        type="monotone"
                        dataKey={"tps_" + modo}
                        name={modo}
                        stroke={MODO_COLORS[modo]}
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article ref={graficaLatenciaRef} style={{ background: "#fff", border: "1px solid #e5eef5", borderRadius: 10, padding: 16 }}>
              <strong style={{ display: "block", marginBottom: 4 }}>Gráfica 2 — Latencia Promedio vs Transacciones</strong>
              <p style={{ fontSize: "0.76rem", color: "#778", margin: "0 0 12px" }}>
                Latencia promedio en segundos por modo con referencia objetivo de 15 s.
              </p>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5eef5" />
                    <XAxis dataKey="totalTransacciones" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => String(value) + " s"} />
                    <Tooltip
                      labelFormatter={(value) => String(value) + " transacciones"}
                      formatter={(value, name) => [Number(value).toFixed(2) + " s", String(name)]}
                    />
                    <Legend />
                    <ReferenceLine
                      y={15}
                      stroke={SEMAFORO_COLORS.verde}
                      strokeDasharray="6 4"
                      label={{ value: "15 s", fill: SEMAFORO_COLORS.verde, fontSize: 12, position: "insideTopRight" }}
                    />
                    {MODOS_PRUEBA.map((modo) => (
                      <Line
                        key={modo}
                        type="monotone"
                        dataKey={"latencia_" + modo}
                        name={modo}
                        stroke={MODO_COLORS[modo]}
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article ref={graficaExitoRef} style={{ background: "#fff", border: "1px solid #e5eef5", borderRadius: 10, padding: 16 }}>
              <strong style={{ display: "block", marginBottom: 4 }}>Gráfica 3 — Tasa de Éxito vs Transacciones</strong>
              <p style={{ fontSize: "0.76rem", color: "#778", margin: "0 0 12px" }}>
                Tasa de éxito por modo, con línea de referencia de 95 % para desempeño óptimo.
              </p>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5eef5" />
                    <XAxis dataKey="totalTransacciones" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} tickFormatter={(value) => String(value) + "%"} />
                    <Tooltip
                      labelFormatter={(value) => String(value) + " transacciones"}
                      formatter={(value, name) => [Number(value).toFixed(1) + " %", String(name)]}
                    />
                    <Legend />
                    <ReferenceLine
                      y={95}
                      stroke={SEMAFORO_COLORS.verde}
                      strokeDasharray="6 4"
                      label={{ value: "95 %", fill: SEMAFORO_COLORS.verde, fontSize: 12, position: "insideTopRight" }}
                    />
                    {MODOS_PRUEBA.map((modo) => (
                      <Line
                        key={modo}
                        type="monotone"
                        dataKey={"tasa_" + modo}
                        name={modo}
                        stroke={MODO_COLORS[modo]}
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article ref={graficaGasRef} style={{ background: "#fff", border: "1px solid #e5eef5", borderRadius: 10, padding: 16 }}>
              <strong style={{ display: "block", marginBottom: 4 }}>Gráfica 4 — Gas Promedio vs Transacciones</strong>
              <p style={{ fontSize: "0.76rem", color: "#778", margin: "0 0 12px" }}>
                Consumo promedio de gas por modo para cada tamaño de prueba comparativa.
              </p>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5eef5" />
                    <XAxis dataKey="totalTransacciones" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => fNum(Number(value), 0)} />
                    <Tooltip
                      labelFormatter={(value) => String(value) + " transacciones"}
                      formatter={(value, name) => [fNum(Number(value), 0) + " gas", String(name)]}
                    />
                    <Legend />
                    {MODOS_PRUEBA.map((modo) => (
                      <Bar key={modo} dataKey={"gas_" + modo} name={modo} fill={MODO_COLORS[modo]} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: 8, color: "#555" }}>
              Tabla resumen de corridas batch
            </div>
            <div className="table-wrapper">
              <table className="tabla-clinica">
                <thead>
                  <tr>
                    <th>Transacciones</th>
                    <th>Modo</th>
                    <th>TPS Prom</th>
                    <th>TPS Pico</th>
                    <th>Latencia Prom</th>
                    <th>P95</th>
                    <th>Tasa Éxito</th>
                    <th>Semáforo Eficiencia</th>
                    <th>Semáforo Latencia</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosOrdenados.map((record) => (
                    <tr key={record.id}>
                      <td>{record.totalTransacciones}</td>
                      <td><code>{record.modo}</code></td>
                      <td>{fNum(record.tpsPromedio)}</td>
                      <td>{fNum(record.tpsPico)}</td>
                      <td>{fMs(record.latenciaPromedioMs)}</td>
                      <td>{fMs(record.latenciaP95Ms)}</td>
                      <td>{fPct(record.tasaExito)}</td>
                      <td><Pill color={record.semaforoEficiencia} /></td>
                      <td><Pill color={record.semaforoLatencia} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {tieneBatchCompleto && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ fontSize: "0.8rem", padding: "4px 12px", whiteSpace: "nowrap" }}
                onClick={() => void handleExportarPdfBatch()}
                disabled={exportingPdfBatch}
              >
                {exportingPdfBatch ? "Preparando PDF…" : "Exportar PDF del batch"}
              </button>
            </div>
          )}
        </>
      )}
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
      <SeccionComparativa />
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
