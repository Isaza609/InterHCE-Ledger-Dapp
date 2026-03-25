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
  type AuditMetricResumen,
  type AuditMetricDetalle,
  type AuditRunConfigFrontend,
  type ModoPrueba,
  type BlockSampleFrontend,
  type DashboardEvaluacionPrototipo
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

        {r.modo !== "EOA" && (
          <MetricCard title="⑥ Interoperabilidad ERC" rows={[
            ["Modo",                r.modo],
            ["Deploy exitoso",      r.deployExitoso ? "✓ Sí" : "✗ No"],
            ["Llamadas exitosas",   fNum(r.llamadasERCExitosas, 0)],
            ["Total llamadas",      fNum(r.llamadasERCTotal, 0)],
            ["Tasa ERC",            r.llamadasERCTotal > 0
              ? fPct((r.llamadasERCExitosas / r.llamadasERCTotal) * 100) : "—"],
            ["Contrato",            r.contractAddress
              ? r.contractAddress.slice(0, 14) + "…" : "Desplegado por pandoras-box"],
          ]} />
        )}
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

const CONFIG_DEFAULT: AuditRunConfigFrontend = {
  rpcUrl: "", modo: "EOA", totalTransacciones: 100, numSubcuentas: 5,
  contractAddress: "", mnemonic: "", batchSize: 20,
  umbralTpsVerde: 10, umbralTpsAmarillo: 5,
  umbralLatenciaVerdeMs: 3000, umbralLatenciaAmarilloMs: 8000,
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
              <span className="form-label">Latencia verde ≤ (ms)</span>
              <input className="form-input" type="number" min={0}
                value={cfg.umbralLatenciaVerdeMs ?? 3000}
                onChange={(e) => set("umbralLatenciaVerdeMs", Number(e.target.value))} />
            </label>
            <label className="form-field">
              <span className="form-label">Latencia amarillo ≤ (ms)</span>
              <input className="form-input" type="number" min={0}
                value={cfg.umbralLatenciaAmarilloMs ?? 8000}
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

  async function cargar() {
    setLoading(true);
    const r = await listarAuditMetricas(sesion);
    setLista(r.data ?? []);
    if (!r.ok) setError(r.message);
    setLoading(false);
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

  useEffect(() => { void cargar(); }, [sesion]);

  const optimos = lista.filter((r) =>
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
              <span>{lista.length} prueba(s)</span>
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
      ) : !lista.length ? (
        <div style={{ color: "#aaa", fontSize: "0.85rem", padding: "12px 0" }}>
          No hay pruebas registradas. Usa el botón <strong>Nueva prueba</strong> para ejecutar la primera.
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
                {lista.map((r) => (
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
          <div><b>Latencia</b> 🟢 ≤ 3 s · 🟡 ≤ 8 s · 🔴 {"> 8 s"}</div>
          <div><b>Seguridad</b> 🟢 tasa ≥ 95 % · 🟡 ≥ 80 % · 🔴 {"< 80 %"}</div>
          <div><b>Interop.</b> 🟢 deploy OK + llamadas ≥ 95 % · 🔴 deploy fallido · (EOA: N/A)</div>
        </div>
      </details>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN B — INTEROPERABILIDAD CLÍNICA (HU0-HU5)
// ═════════════════════════════════════════════════════════════════════════════

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

  function fMs2(v?: number) {
    if (typeof v !== "number") return "—";
    return `${v.toFixed(1)} ms`;
  }

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
        <button type="button" className="btn btn--secondary"
          onClick={cargar} disabled={loading} style={{ alignSelf: "flex-start" }}>
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
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
          {/* Resumen en cards */}
          <div className="dashboard-grid" style={{ marginBottom: 14 }}>
            <article className="metric-card">
              <strong>Escenarios multi-IPS</strong>
              <span>{dash.interoperability.summary.crossIpsScenarios} escenario(s) entre IPS</span>
              <span>{dash.interoperability.summary.episodesWithContinuity} con continuidad asistencial</span>
              <div className={dash.interoperability.multipleIpsReady
                ? "status-chip status-chip--ready" : "status-chip"}>
                {dash.interoperability.multipleIpsReady ? "Multi-IPS activo" : "Single IPS"}
              </div>
            </article>

            <article className="metric-card">
              <strong>Tiempos de acceso</strong>
              <span>Metadatos on-chain: {fMs2(dash.timings.operations.metadataOnChain.averageMs)}</span>
              <span>Documento off-chain: {fMs2(dash.timings.operations.documentOffChain.averageMs)}</span>
              <span>Verificación integridad: {fMs2(dash.timings.operations.integrityVerification.averageMs)}</span>
            </article>

            <article className="metric-card">
              <strong>Integridad y trazabilidad</strong>
              <span>{dash.audit.integrityValidEpisodes} episodio(s) íntegros</span>
              <span>{dash.audit.totalEvents} evento(s) de trazabilidad</span>
              <div className={dash.audit.endToEndTraceability
                ? "status-chip status-chip--ready" : "status-chip status-chip--alert"}>
                {dash.audit.endToEndTraceability ? "Trazabilidad completa" : "Con vacíos"}
              </div>
            </article>

            <article className="metric-card">
              <strong>Cumplimiento modelo HCE</strong>
              <span>{dash.compliance.hceModel.validEpisodes} episodio(s) válidos</span>
              <span>{dash.compliance.hceModel.invalidEpisodes} con observaciones</span>
            </article>
          </div>

          {/* Escenarios */}
          <div className="section-block" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: 8, color: "#555" }}>
              Episodios evaluados
            </div>
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

          {/* Requisitos */}
          <details>
            <summary style={{ fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
              color: "#555", marginBottom: 8 }}>
              Requisitos validados ({dash.compliance.requirements.length})
            </summary>
            <div className="stack-list" style={{ marginTop: 8 }}>
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
          </details>
        </>
      )}

      <div style={{ marginTop: 14, fontSize: "0.78rem", color: "#aaa" }}>
        Ver análisis completo (HU0-HU5, blockchain, documentación) →{" "}
        <Link to="/auditoria/evaluacion" style={{ color: "#4f8ef7" }}>
          Evaluación del prototipo
        </Link>
      </div>
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
